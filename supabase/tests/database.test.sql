begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email, aud, role, instance_id) values
  ('11111111-1111-1111-1111-111111111111', 'editor@flora.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('22222222-2222-2222-2222-222222222222', 'viewer@flora.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.editors (user_id) values ('11111111-1111-1111-1111-111111111111');

select is((select public from storage.buckets where id = 'photos'), false, 'photos bucket is private');

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
select is((select count(*)::int from public.plants), 1, 'viewer can read plants');
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

-- delete primary promotes the oldest remaining (same created_at in one transaction → lowest id)
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
delete from public.plant_photos where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is((select id from public.plant_photos where plant_id = 'aaaaaaaa-0000-0000-0000-000000000001' and is_primary),
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'deleting the primary promotes the oldest remaining photo');
select throws_ok($$ delete from public.plants where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '23503', null, 'a plant with photos cannot be deleted');
select throws_ok($$ update public.plant_photos set path = 'x' where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  '42501', null, 'photo paths are immutable for app users');

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

select * from finish();
rollback;
