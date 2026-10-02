-- Do not rely on project default privileges (hosted projects may not auto-expose new tables).
grant usage on schema public to authenticated, service_role;
grant select, delete on public.plants, public.plant_photos to authenticated;
grant select on public.editors to authenticated;
grant all on public.plants, public.plant_photos, public.editors to service_role;
