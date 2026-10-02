-- Review queue for the legacy (imported) plants: one Pl@ntNet run per plant, decided by the owner.
-- ai_gbif now requires the candidate the owner actually chose.

alter table public.identifications
  add column source text not null default 'manual' check (source in ('manual', 'review')),
  add column decision text check (decision in ('match', 'changed', 'kept')),
  add column wiki jsonb check (wiki is null or jsonb_typeof(wiki) = 'object'),
  add constraint identifications_decision_review_only check (decision is null or source = 'review');

create unique index identifications_one_review on public.identifications (plant_id) where source = 'review';

grant insert (source, wiki) on public.identifications to authenticated;
grant update (chosen_index, decision) on public.identifications to authenticated;

-- Only pending review rows can be decided, once; manual protocols stay immutable.
create policy "identifications: editor decides own review" on public.identifications
  for update to authenticated
  using (
    (select public.is_editor())
    and owner_id = (select auth.uid())
    and source = 'review'
    and decision is null
  )
  with check (
    (select public.is_editor())
    and owner_id = (select auth.uid())
    and source = 'review'
  );

alter table public.plants
  add column description_source text check (description_source in ('wikipedia', 'manual')),
  add column wiki_url text check (char_length(wiki_url) <= 500);

grant insert (description_source, wiki_url) on public.plants to authenticated;
grant update (description_source, wiki_url) on public.plants to authenticated;

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
      select 1
      from public.identifications i,
           jsonb_array_elements(i.candidates) with ordinality as c(value, ord)
      where i.plant_id = p.id
        and i.chosen_index is not null
        and c.ord - 1 = i.chosen_index
        and (c.value->>'score')::numeric >= 0.30
        and ( (c.value->>'gbif_key')::bigint in (p.gbif_key, p.gbif_accepted_key)
           or lower(c.value->>'scientific_name') = lower(p.scientific_name) ))
      then 'ai_gbif'
    else 'draft'
  end
$$;
