begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email, aud, role, instance_id) values
  ('33333333-0000-0000-0000-000000000003', 'editor3@pgtap.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('44444444-0000-0000-0000-000000000004', 'viewer3@pgtap.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.editors (user_id) values ('33333333-0000-0000-0000-000000000003');

-- schema -------------------------------------------------------------------
select has_column('public', 'plants', 'name_source', 'plants.name_source exists');
select has_table('public', 'identifications', 'identifications table exists');
select has_function('public', 'id_status', array['plants'], 'id_status(plants) exists');

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000003","role":"authenticated"}';

-- draft by default -----------------------------------------------------------
insert into public.plants (id, scientific_name, name_bg) values
  ('a3000000-0000-0000-0000-000000000001', 'Myosotis arvensis', 'Незабравка');
select is((select public.id_status(p) from public.plants p where p.id = 'a3000000-0000-0000-0000-000000000001'),
  'draft', 'a new plant is a draft');

-- ai_gbif: accepted GBIF match + a candidate with score >= 0.30 ------------------
insert into public.identifications (plant_id, photo_count, candidates, chosen_index) values
  ('a3000000-0000-0000-0000-000000000001', 1,
   '[{"scientific_name":"Myosotis arvensis","score":0.62,"gbif_key":5341258}]', 0);
update public.plants set gbif_match = 'accepted', gbif_key = 5341258, gbif_accepted_key = 5341258
  where id = 'a3000000-0000-0000-0000-000000000001';
select is((select public.id_status(p) from public.plants p where p.id = 'a3000000-0000-0000-0000-000000000001'),
  'ai_gbif', 'accepted GBIF match with a strong candidate is ai_gbif');

-- threshold: 0.29 -> draft, 0.30 -> ai_gbif ------------------------------------
insert into public.plants (id, scientific_name, name_bg, gbif_match, gbif_key, gbif_accepted_key) values
  ('a3000000-0000-0000-0000-000000000002', 'Myosotis arvensis', 'Незабравка', 'accepted', 5341258, 5341258),
  ('a3000000-0000-0000-0000-000000000003', 'Myosotis arvensis', 'Незабравка', 'accepted', 5341258, 5341258);
insert into public.identifications (plant_id, photo_count, candidates, chosen_index) values
  ('a3000000-0000-0000-0000-000000000002', 1,
   '[{"scientific_name":"Myosotis arvensis","score":0.29,"gbif_key":5341258}]', 0),
  ('a3000000-0000-0000-0000-000000000003', 1,
   '[{"scientific_name":"Myosotis arvensis","score":0.30,"gbif_key":5341258}]', 0);
select is((select public.id_status(p) from public.plants p where p.id = 'a3000000-0000-0000-0000-000000000002'),
  'draft', 'score 0.29 stays a draft');
select is((select public.id_status(p) from public.plants p where p.id = 'a3000000-0000-0000-0000-000000000003'),
  'ai_gbif', 'score 0.30 is ai_gbif');

-- name match is case-insensitive when the candidate has no gbif_key -------------------
insert into public.plants (id, scientific_name, name_bg, gbif_match, gbif_key, gbif_accepted_key) values
  ('a3000000-0000-0000-0000-000000000004', 'Myosotis arvensis', 'Незабравка', 'accepted', 5341258, 5341258);
insert into public.identifications (plant_id, photo_count, candidates, chosen_index) values
  ('a3000000-0000-0000-0000-000000000004', 1,
   '[{"scientific_name":"MYOSOTIS ARVENSIS","score":0.5,"gbif_key":null}]', 0);
select is((select public.id_status(p) from public.plants p where p.id = 'a3000000-0000-0000-0000-000000000004'),
  'ai_gbif', 'candidate name matches case-insensitively');

-- synonym resolved to the candidate key; doubtful never qualifies -------------------
insert into public.plants (id, scientific_name, name_bg, gbif_match, gbif_key, gbif_accepted_key) values
  ('a3000000-0000-0000-0000-000000000005', 'Myosotis scorpioides', 'Незабравка', 'synonym', 111, 5341258);
insert into public.identifications (plant_id, photo_count, candidates, chosen_index) values
  ('a3000000-0000-0000-0000-000000000005', 1,
   '[{"scientific_name":"Myosotis arvensis","score":0.7,"gbif_key":5341258}]', 0);
select is((select public.id_status(p) from public.plants p where p.id = 'a3000000-0000-0000-0000-000000000005'),
  'ai_gbif', 'a synonym whose accepted key equals the candidate key is ai_gbif');
update public.plants set gbif_match = 'doubtful' where id = 'a3000000-0000-0000-0000-000000000005';
select is((select public.id_status(p) from public.plants p where p.id = 'a3000000-0000-0000-0000-000000000005'),
  'draft', 'a doubtful GBIF match is a draft');

-- community: iNaturalist research grade for the same name --------------------------
insert into public.plants (id, scientific_name, name_bg, inat_quality_grade, inat_taxon_name, inat_observation_id) values
  ('a3000000-0000-0000-0000-000000000006', 'Myosotis arvensis', 'Незабравка', 'research', 'Myosotis arvensis', 123456);
select is((select public.id_status(p) from public.plants p where p.id = 'a3000000-0000-0000-0000-000000000006'),
  'community', 'research grade with the same taxon is community, even without an identification');
update public.plants set inat_taxon_name = 'Myosotis sylvatica' where id = 'a3000000-0000-0000-0000-000000000006';
select isnt((select public.id_status(p) from public.plants p where p.id = 'a3000000-0000-0000-0000-000000000006'),
  'community', 'a different iNaturalist taxon is not community');
update public.plants set inat_taxon_name = 'Myosotis arvensis', inat_quality_grade = 'needs_id'
  where id = 'a3000000-0000-0000-0000-000000000006';
select isnt((select public.id_status(p) from public.plants p where p.id = 'a3000000-0000-0000-0000-000000000006'),
  'community', 'needs_id grade is not community');

-- viewer ----------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"44444444-0000-0000-0000-000000000004","role":"authenticated"}';
select cmp_ok((select count(*)::int from public.identifications), '>=', 1, 'viewer can read identifications');
select throws_ok(
  $$ insert into public.identifications (plant_id, photo_count, candidates) values
     ('a3000000-0000-0000-0000-000000000001', 1, '[]') $$,
  '42501', null, 'viewer cannot insert identifications');
select is(public.consume_identify_quota(), false, 'viewer gets false from consume_identify_quota');

-- editor: protocol is immutable --------------------------------------------------------
set local request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000003","role":"authenticated"}';
update public.identifications set chosen_index = 1 where source = 'manual';
select is((select count(*)::int from public.identifications where chosen_index = 1), 0,
  'editor cannot change manual identifications');
select throws_ok($$ delete from public.identifications $$,
  '42501', null, 'editor cannot delete identifications');

-- quota -------------------------------------------------------------------------------
select is((select bool_and(public.consume_identify_quota()) from generate_series(1, 100)), true,
  'the first 100 quota calls succeed');
select is(public.consume_identify_quota(), false, 'the 101st quota call is refused');
reset role;
select is((select count from public.api_usage where user_id = '33333333-0000-0000-0000-000000000003'), 100,
  'the usage counter stops at 100');
select is(has_table_privilege('authenticated', 'public.api_usage', 'select'), false,
  'authenticated cannot read api_usage');
select is(has_table_privilege('anon', 'public.identifications', 'select'), false,
  'anon cannot read identifications');

-- cascade through delete_plant ---------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.identifications where plant_id = 'a3000000-0000-0000-0000-000000000001'),
  1, 'the plant has an identification before deletion');
select public.delete_plant('a3000000-0000-0000-0000-000000000001');
reset role;
select is((select count(*)::int from public.identifications where plant_id = 'a3000000-0000-0000-0000-000000000001'),
  0, 'deleting the plant cascades to its identifications');

select * from finish();
rollback;
