begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role, instance_id) values
  ('55555555-0000-0000-0000-000000000005', 'editor5@pgtap.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('66666666-0000-0000-0000-000000000006', 'viewer6@pgtap.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.editors (user_id) values ('55555555-0000-0000-0000-000000000005');

select has_column('public', 'identifications', 'source', 'identifications.source exists');
select has_column('public', 'identifications', 'decision', 'identifications.decision exists');
select has_column('public', 'identifications', 'wiki', 'identifications.wiki exists');
select has_column('public', 'plants', 'description_source', 'plants.description_source exists');
select has_column('public', 'plants', 'wiki_url', 'plants.wiki_url exists');

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-0000-0000-0000-000000000005","role":"authenticated"}';

insert into public.plants (id, scientific_name, name_bg, gbif_match, gbif_key, gbif_accepted_key, name_source) values
  ('b5000000-0000-0000-0000-000000000001', 'Bellis perennis', 'Паричка', 'accepted', 3117813, 3117813, 'legacy_ai'),
  ('b5000000-0000-0000-0000-000000000002', 'Bellis sylvestris', 'Паричка', 'synonym', 111, 3117813, 'legacy_ai');
insert into public.identifications (plant_id, photo_count, candidates, source) values
  ('b5000000-0000-0000-0000-000000000001', 1,
   '[{"scientific_name":"Bellis perennis","score":0.8,"gbif_key":3117813}]', 'review'),
  ('b5000000-0000-0000-0000-000000000002', 1,
   '[{"scientific_name":"Bellis perennis","score":0.6,"gbif_key":3117813}]', 'review');

select is((select public.id_status(p) from public.plants p where p.id = 'b5000000-0000-0000-0000-000000000001'),
  'draft', 'a matching but unchosen review candidate stays a draft');

select is((select count(*)::int from (select 1) x where exists (
  select 1 from public.identifications where plant_id = 'b5000000-0000-0000-0000-000000000001')), 1, 'review row is visible');
update public.identifications set chosen_index = 0, decision = 'match' where plant_id = 'b5000000-0000-0000-0000-000000000001';
select is((select public.id_status(p) from public.plants p where p.id = 'b5000000-0000-0000-0000-000000000001'),
  'ai_gbif', 'the chosen matching candidate makes ai_gbif');

update public.identifications set chosen_index = 0, decision = 'match' where plant_id = 'b5000000-0000-0000-0000-000000000002';
select is((select public.id_status(p) from public.plants p where p.id = 'b5000000-0000-0000-0000-000000000002'),
  'ai_gbif', 'a synonym whose accepted key equals the chosen candidate key is ai_gbif');

select throws_ok(
  $$ insert into public.identifications (plant_id, photo_count, candidates, source) values
     ('b5000000-0000-0000-0000-000000000001', 1, '[]', 'review') $$,
  '23505', null, 'only one review row per plant');

select throws_ok($$ update public.identifications set candidates = '[]' $$,
  '42501', null, 'editor cannot change candidates');

update public.identifications set decision = 'kept' where plant_id = 'b5000000-0000-0000-0000-000000000001';
reset role;
select is((select decision from public.identifications where plant_id = 'b5000000-0000-0000-0000-000000000001'),
  'match', 'a decided review row cannot be changed again');

select * from finish();
rollback;
