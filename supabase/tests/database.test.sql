begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

insert into auth.users (id, email, aud, role, instance_id) values
  ('11111111-1111-1111-1111-111111111111', 'editor@pgtap.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('22222222-2222-2222-2222-222222222222', 'viewer@pgtap.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.editors (user_id) values ('11111111-1111-1111-1111-111111111111');

select is((select public from storage.buckets where id = 'photos'), false, 'photos bucket is private');

select is(has_table_privilege('authenticated', 'public.plants', 'select'), true, 'authenticated has an explicit select grant on plants');
select is(has_table_privilege('authenticated', 'public.plants', 'truncate'), false, 'authenticated cannot truncate plants');

set local role authenticated;

-- is_editor
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is(public.is_editor(), true, 'editor is recognised by is_editor()');
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is(public.is_editor(), false, 'viewer is not an editor');

-- plants: viewer cannot insert
select throws_ok(
  $$ insert into public.plants (id, scientific_name, name_bg) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Bellis perennis', 'Паричка') $$,
  '42501', null, 'viewer cannot create plants');

-- plants: editor inserts, owner defaults
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ insert into public.plants (id, scientific_name, name_bg) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Bellis perennis', 'Паричка') $$,
  'editor can create a plant');
select is((select owner_id from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'owner_id defaults to the editor');
select throws_ok(
  $$ update public.plants set legacy_ai = '{"risks":"x"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '42501', null, 'legacy_ai is not writable by app users');
select throws_ok(
  $$ update public.plants set status = 'confirmed' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '23514', null, 'confirmed status without confirmed_at is rejected');
select lives_ok(
  $$ update public.plants set status = 'confirmed', confirmed_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'editor can confirm a plant');

-- plants: viewer reads, cannot update
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'viewer can read plants');
update public.plants set name_bg = 'Хакната' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select name_bg from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Паричка', 'viewer update changes nothing');

-- photos: primary handling
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.plant_photos (id, plant_id, path, thumb_path, mime, width, height, bytes, sha256) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/bbbbbbbb-0000-0000-0000-000000000001.webp',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/bbbbbbbb-0000-0000-0000-000000000001_thumb.webp',
   'image/webp', 2560, 1920, 500000, repeat('a', 64));
select is((select is_primary from public.plant_photos where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  true, 'first photo becomes primary');
insert into public.plant_photos (id, plant_id, path, thumb_path, mime, width, height, bytes, sha256) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/bbbbbbbb-0000-0000-0000-000000000002.webp',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/bbbbbbbb-0000-0000-0000-000000000002_thumb.webp',
   'image/webp', 2560, 1920, 500000, repeat('b', 64));
select is((select is_primary from public.plant_photos where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  false, 'second photo is not primary');
insert into public.plant_photos (id, plant_id, path, thumb_path, mime, width, height, bytes, sha256) values
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/bbbbbbbb-0000-0000-0000-000000000003.jpg',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/bbbbbbbb-0000-0000-0000-000000000003_thumb.jpg',
   'image/jpeg', 1920, 2560, 400000, repeat('c', 64));
select is((select count(*)::int from public.plant_photos
  where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and is_primary), 1, 'exactly one primary photo');
select throws_ok(
  $$ insert into public.plant_photos (id, plant_id, path, thumb_path, mime, width, height, bytes, sha256) values
     ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
      'elsewhere/bbbbbbbb-0000-0000-0000-000000000004.webp', 'elsewhere/bbbbbbbb-0000-0000-0000-000000000004_thumb.webp',
      'image/webp', 10, 10, 10, repeat('d', 64)) $$,
  '23514', null, 'photo paths must be owner/plant/photo.ext');
select throws_ok(
  $$ insert into public.plant_photos (id, plant_id, path, thumb_path, mime, width, height, bytes, sha256) values
     ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001',
      '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/bbbbbbbb-0000-0000-0000-000000000005.webp',
      '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/bbbbbbbb-0000-0000-0000-000000000005_thumb.webp',
      'image/webp', 10, 10, 10, repeat('a', 64)) $$,
  '23505', null, 'duplicate sha256 is rejected');
select lives_ok($$ select public.set_primary_photo('bbbbbbbb-0000-0000-0000-000000000002') $$,
  'editor can change the primary photo');
select is((select id from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and is_primary),
  'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'photo 2 is now primary');

-- photos: viewer
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$ select public.set_primary_photo('bbbbbbbb-0000-0000-0000-000000000001') $$,
  '42501', null, 'viewer cannot change the primary photo');
select throws_ok(
  $$ insert into public.plant_photos (id, plant_id, path, thumb_path, mime, width, height, bytes, sha256) values
     ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
      '22222222-2222-2222-2222-222222222222/aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000001.webp',
      '22222222-2222-2222-2222-222222222222/aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000001_thumb.webp',
      'image/webp', 10, 10, 10, repeat('e', 64)) $$,
  '42501', null, 'viewer cannot add photos');
select throws_ok($$ insert into public.editors (user_id) values ('22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'viewer cannot promote themselves to editor');
delete from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*)::int from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1, 'viewer delete of a plant changes nothing');
select is((select count(*)::int from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  3, 'viewer delete of photos changes nothing');
select throws_ok($$ select * from public.delete_plant('aaaaaaaa-0000-0000-0000-000000000001') $$,
  'P0002', null, 'viewer cannot delete a plant through delete_plant');
select is((select count(*)::int from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1, 'plant survives a refused delete_plant');
select is((select count(*)::int from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  3, 'photos survive a refused delete_plant');
update public.plant_photos set is_primary = true where id = 'bbbbbbbb-0000-0000-0000-000000000001';
update public.plant_photos set is_primary = false where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is((select array_agg(id) from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and is_primary),
  array['bbbbbbbb-0000-0000-0000-000000000002']::uuid[], 'viewer cannot change is_primary directly');
select throws_ok($$ truncate public.plants $$, '42501', null, 'viewer cannot truncate plants');
select throws_ok($$ truncate public.plant_photos $$, '42501', null, 'viewer cannot truncate plant_photos');
select throws_ok($$ truncate public.editors $$, '42501', null, 'viewer cannot truncate editors');

-- delete primary promotes the oldest remaining (same created_at in one transaction → lowest id)
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
delete from public.plant_photos where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is((select id from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and is_primary),
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'deleting the primary promotes the oldest remaining photo');
select throws_ok($$ delete from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '23503', null, 'a plant with photos cannot be deleted');
select throws_ok($$ update public.plant_photos set path = 'x' where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  '42501', null, 'photo paths are immutable for app users');

-- a second editor with their own plant: editor 1 must not touch it
reset role;
insert into auth.users (id, email, aud, role, instance_id) values
  ('33333333-3333-3333-3333-333333333333', 'editor2@pgtap.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.editors (user_id) values ('33333333-3333-3333-3333-333333333333');
insert into public.plants (id, owner_id, scientific_name, name_bg) values
  ('dddddddd-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Taraxacum officinale', 'Глухарче');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ insert into public.plant_photos (id, plant_id, path, thumb_path, mime, width, height, bytes, sha256) values
     ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
      '11111111-1111-1111-1111-111111111111/dddddddd-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-000000000001.webp',
      '11111111-1111-1111-1111-111111111111/dddddddd-0000-0000-0000-000000000001/eeeeeeee-0000-0000-0000-000000000001_thumb.webp',
      'image/webp', 10, 10, 10, repeat('f', 64)) $$,
  '42501', null, 'editor cannot attach a photo to another editor''s plant');
update public.plants set name_bg = 'Хакната' where id = 'dddddddd-0000-0000-0000-000000000001';
select is((select name_bg from public.plants where id = 'dddddddd-0000-0000-0000-000000000001'),
  'Глухарче', 'editor cannot update another editor''s plant');

-- name checks
select throws_ok(
  $$ insert into public.plants (id, scientific_name, name_bg) values ('aaaaaaaa-0000-0000-0000-000000000002', E'\t', 'Име') $$,
  '23514', null, 'a tab-only scientific_name is rejected');
select throws_ok(
  $$ insert into public.plants (id, scientific_name, name_bg) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Bellis perennis', E' \t ') $$,
  '23514', null, 'a whitespace-only name_bg is rejected');
select throws_ok(
  $$ insert into public.plants (id, scientific_name, name_bg) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Bellis perennis', E'\u00a0') $$,
  '23514', null, 'a non-breaking-space-only name_bg is rejected');
select throws_ok(
  $$ insert into public.plants (id, scientific_name, name_bg) values ('aaaaaaaa-0000-0000-0000-000000000002', repeat('a', 201), 'Име') $$,
  '23514', null, 'a 201-character scientific_name is rejected');

-- delete_plant: editor removes a plant with two photos atomically
insert into public.plants (id, scientific_name, name_bg) values
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Thymus serpyllum', 'Мащерка');
insert into public.plant_photos (id, plant_id, path, thumb_path, mime, width, height, bytes, sha256) values
  ('bbbbbbbb-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000003',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000003/bbbbbbbb-0000-0000-0000-000000000031.webp',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000003/bbbbbbbb-0000-0000-0000-000000000031_thumb.webp',
   'image/webp', 100, 100, 10, repeat('3', 64)),
  ('bbbbbbbb-0000-0000-0000-000000000032', 'aaaaaaaa-0000-0000-0000-000000000003',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000003/bbbbbbbb-0000-0000-0000-000000000032.webp',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000003/bbbbbbbb-0000-0000-0000-000000000032_thumb.webp',
   'image/webp', 100, 100, 10, repeat('4', 64));
select is((select count(*)::int from public.delete_plant('aaaaaaaa-0000-0000-0000-000000000003')),
  2, 'delete_plant returns the paths of both deleted photos');
select is((select count(*)::int from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  0, 'delete_plant removed the plant');
select is((select count(*)::int from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  0, 'delete_plant removed its photos');

-- anon
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.plants $$, '42501', null, 'anon cannot read plants');

-- storage policies
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/test.webp') $$,
  'editor can upload into own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '22222222-2222-2222-2222-222222222222/x.webp') $$,
  '42501', null, 'editor cannot upload into another folder');
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('photos', '22222222-2222-2222-2222-222222222222/x.webp') $$,
  '42501', null, 'viewer cannot upload');
update storage.objects set name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/renamed.webp'
  where bucket_id = 'photos' and name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/test.webp';
select is((select count(*)::int from storage.objects
  where bucket_id = 'photos' and name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/test.webp'),
  1, 'viewer update of an editor''s storage object changes nothing');
-- storage.protect_delete refuses every direct DELETE unless this setting is on; enable it so the RLS policy itself is what is tested
set local storage.allow_delete_query = 'true';
delete from storage.objects
  where bucket_id = 'photos' and name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/test.webp';
select is((select count(*)::int from storage.objects
  where bucket_id = 'photos' and name = '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/test.webp'),
  1, 'viewer delete of an editor''s storage object changes nothing');

select * from finish();
rollback;
