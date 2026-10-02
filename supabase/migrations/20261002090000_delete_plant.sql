-- Atomic plant deletion: photo rows and the plant row are removed in one transaction.
-- Returns the storage paths of the deleted photos so the caller can remove the files.
create or replace function public.delete_plant(target_plant uuid)
returns table (path text, thumb_path text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
    delete from public.plant_photos p where p.plant_id = target_plant
    returning p.path, p.thumb_path;
  delete from public.plants where id = target_plant;
  if not found then
    raise exception 'not found or not allowed' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.delete_plant(uuid) from public, anon;
grant execute on function public.delete_plant(uuid) to authenticated;
