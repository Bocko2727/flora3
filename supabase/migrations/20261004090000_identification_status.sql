-- AI identification protocols, GBIF / iNaturalist evidence, computed id_status and the daily identify quota.

-- Plants: evidence columns ---------------------------------------------------
alter table public.plants
  add column name_source text not null default 'manual'
    check (name_source in ('manual', 'ai', 'legacy_ai')),
  add column gbif_match text check (gbif_match in ('accepted', 'synonym', 'doubtful', 'none')),
  add column gbif_key bigint,
  add column gbif_accepted_key bigint,
  add column gbif_accepted_name text check (char_length(gbif_accepted_name) <= 200),
  add column gbif_checked_at timestamptz,
  add column inat_observation_id bigint check (inat_observation_id > 0),
  add column inat_quality_grade text check (inat_quality_grade in ('research', 'needs_id', 'casual')),
  add column inat_taxon_name text check (char_length(inat_taxon_name) <= 200),
  add column inat_checked_at timestamptz;

update public.plants set name_source = 'legacy_ai' where legacy_ai is not null;

grant insert (name_source, gbif_match, gbif_key, gbif_accepted_key, gbif_accepted_name, gbif_checked_at,
              inat_observation_id, inat_quality_grade, inat_taxon_name, inat_checked_at)
  on public.plants to authenticated;
grant update (name_source, gbif_match, gbif_key, gbif_accepted_key, gbif_accepted_name, gbif_checked_at,
              inat_observation_id, inat_quality_grade, inat_taxon_name, inat_checked_at)
  on public.plants to authenticated;

-- Identification protocols (immutable for app users) --------------------------
create table public.identifications (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id),
  provider text not null default 'plantnet' check (provider = 'plantnet'),
  model_version text check (char_length(model_version) <= 100),
  photo_count integer not null check (photo_count between 1 and 5),
  candidates jsonb not null check (jsonb_typeof(candidates) = 'array' and jsonb_array_length(candidates) <= 10),
  chosen_index integer check (chosen_index >= 0),
  created_at timestamptz not null default now()
);
create index identifications_plant_idx on public.identifications (plant_id, created_at desc);

alter table public.identifications enable row level security;
create policy "identifications: authenticated read" on public.identifications
  for select to authenticated using (true);
create policy "identifications: editor insert" on public.identifications
  for insert to authenticated
  with check (
    (select public.is_editor())
    and owner_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = plant_id and p.owner_id = (select auth.uid()))
  );

-- Default privileges may auto-grant everything; strip it so only the grants below remain.
revoke all on public.identifications from anon, authenticated;
grant select on public.identifications to authenticated;
grant insert (plant_id, model_version, photo_count, candidates, chosen_index)
  on public.identifications to authenticated;
grant all on public.identifications to service_role;

-- Daily quota counter (no client access at all) -------------------------------
create table public.api_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;
grant all on public.api_usage to service_role;

create or replace function public.consume_identify_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  if not public.is_editor() then
    return false;
  end if;
  insert into public.api_usage (user_id, day, count)
  values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = public.api_usage.count + 1
    where public.api_usage.count < 100
  returning count into used;
  return used is not null;
end;
$$;
revoke all on function public.consume_identify_quota() from public, anon;
grant execute on function public.consume_identify_quota() to authenticated;

-- Computed identification status ----------------------------------------------
create or replace function public.id_status(p public.plants)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p.inat_quality_grade = 'research'
     and lower(p.inat_taxon_name) = lower(coalesce(p.gbif_accepted_name, p.scientific_name))
      then 'community'
    when p.gbif_match in ('accepted', 'synonym') and exists (
      select 1 from public.identifications i, jsonb_array_elements(i.candidates) c
      where i.plant_id = p.id
        and (c->>'score')::numeric >= 0.30
        and ( (c->>'gbif_key')::bigint in (p.gbif_key, p.gbif_accepted_key)
           or lower(c->>'scientific_name') = lower(p.scientific_name) ))
      then 'ai_gbif'
    else 'draft'
  end
$$;
revoke all on function public.id_status(public.plants) from public, anon;
grant execute on function public.id_status(public.plants) to authenticated, service_role;
