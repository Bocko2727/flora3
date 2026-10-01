-- Flora 3 initial schema

-- Editors -------------------------------------------------------------------
create table public.editors (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.editors enable row level security;
create policy "editors: read own row" on public.editors
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.editors where user_id = (select auth.uid()));
$$;
revoke all on function public.is_editor() from public, anon;
grant execute on function public.is_editor() to authenticated;

-- Plants --------------------------------------------------------------------
create table public.plants (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id),
  scientific_name text not null check (char_length(btrim(scientific_name)) between 1 and 200),
  name_bg text not null check (char_length(btrim(name_bg)) between 1 and 200),
  family text check (family is null or char_length(family) <= 100),
  description text check (description is null or char_length(description) <= 5000),
  habitat text check (habitat is null or char_length(habitat) <= 5000),
  notes text check (notes is null or char_length(notes) <= 5000),
  status text not null default 'unverified' check (status in ('unverified', 'confirmed')),
  confirmed_at timestamptz,
  legacy_ai jsonb check (legacy_ai is null or jsonb_typeof(legacy_ai) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plants_confirmed_consistency check ((status = 'confirmed') = (confirmed_at is not null))
);
create index plants_owner_idx on public.plants (owner_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger plants_touch_updated_at before update on public.plants
  for each row execute function public.touch_updated_at();

-- Photos --------------------------------------------------------------------
create table public.plant_photos (
  id uuid primary key,
  plant_id uuid not null references public.plants (id) on delete restrict,
  owner_id uuid not null default auth.uid() references auth.users (id),
  path text not null unique,
  thumb_path text not null unique,
  mime text not null check (mime in ('image/webp', 'image/jpeg')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  bytes integer not null check (bytes > 0),
  sha256 text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  is_primary boolean not null default false,
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  constraint plant_photos_path_layout check (
    path = owner_id::text || '/' || plant_id::text || '/' || id::text
      || case when mime = 'image/webp' then '.webp' else '.jpg' end
    and thumb_path = owner_id::text || '/' || plant_id::text || '/' || id::text
      || case when mime = 'image/webp' then '_thumb.webp' else '_thumb.jpg' end
  )
);
create index plant_photos_plant_idx on public.plant_photos (plant_id, created_at);
create unique index plant_photos_one_primary on public.plant_photos (plant_id) where is_primary;

create or replace function public.plant_photos_default_primary()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.plant_id::text, 0));
  new.is_primary := not exists (
    select 1 from public.plant_photos where plant_id = new.plant_id and is_primary
  );
  return new;
end;
$$;
create trigger plant_photos_default_primary before insert on public.plant_photos
  for each row execute function public.plant_photos_default_primary();

create or replace function public.plant_photos_promote_after_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_primary then
    update public.plant_photos set is_primary = true
    where id = (
      select id from public.plant_photos
      where plant_id = old.plant_id
      order by created_at, id
      limit 1
    );
  end if;
  return null;
end;
$$;
create trigger plant_photos_promote_after_delete after delete on public.plant_photos
  for each row execute function public.plant_photos_promote_after_delete();

create or replace function public.set_primary_photo(photo_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_plant uuid;
begin
  select plant_id into target_plant from public.plant_photos where id = photo_id;
  if target_plant is null then
    raise exception 'photo not found' using errcode = 'P0002';
  end if;
  update public.plant_photos set is_primary = false
    where plant_id = target_plant and is_primary and id <> photo_id;
  update public.plant_photos set is_primary = true where id = photo_id;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.set_primary_photo(uuid) from public, anon;
grant execute on function public.set_primary_photo(uuid) to authenticated;

-- Privileges ----------------------------------------------------------------
revoke all on public.editors, public.plants, public.plant_photos from anon;
revoke insert, update on public.plants, public.plant_photos, public.editors from authenticated;
grant insert (id, scientific_name, name_bg, family, description, habitat, notes, status, confirmed_at)
  on public.plants to authenticated;
grant update (scientific_name, name_bg, family, description, habitat, notes, status, confirmed_at)
  on public.plants to authenticated;
grant insert (id, plant_id, path, thumb_path, mime, width, height, bytes, sha256, taken_at)
  on public.plant_photos to authenticated;
grant update (is_primary) on public.plant_photos to authenticated;

-- RLS -----------------------------------------------------------------------
alter table public.plants enable row level security;
create policy "plants: authenticated read" on public.plants
  for select to authenticated using (true);
create policy "plants: editor insert" on public.plants
  for insert to authenticated
  with check ((select public.is_editor()) and owner_id = (select auth.uid()));
create policy "plants: editor update" on public.plants
  for update to authenticated
  using ((select public.is_editor()) and owner_id = (select auth.uid()))
  with check ((select public.is_editor()) and owner_id = (select auth.uid()));
create policy "plants: editor delete" on public.plants
  for delete to authenticated
  using ((select public.is_editor()) and owner_id = (select auth.uid()));

alter table public.plant_photos enable row level security;
create policy "photos: authenticated read" on public.plant_photos
  for select to authenticated using (true);
create policy "photos: editor insert" on public.plant_photos
  for insert to authenticated
  with check (
    (select public.is_editor())
    and owner_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = plant_id and p.owner_id = (select auth.uid()))
  );
create policy "photos: editor update" on public.plant_photos
  for update to authenticated
  using ((select public.is_editor()) and owner_id = (select auth.uid()))
  with check ((select public.is_editor()) and owner_id = (select auth.uid()));
create policy "photos: editor delete" on public.plant_photos
  for delete to authenticated
  using ((select public.is_editor()) and owner_id = (select auth.uid()));

-- Storage -------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "photos bucket: authenticated read" on storage.objects
  for select to authenticated using (bucket_id = 'photos');
create policy "photos bucket: editor insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (select public.is_editor())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "photos bucket: editor update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and (select public.is_editor())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'photos'
    and (select public.is_editor())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "photos bucket: editor delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (select public.is_editor())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
