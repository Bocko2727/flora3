-- Self-confirmation is replaced by the computed id_status (see 20261004090000).
alter table public.plants
  drop constraint plants_confirmed_consistency,
  drop column confirmed_at,
  drop column status;
