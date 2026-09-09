-- Let a paired native phone revoke its own opaque device secret, and let an
-- authenticated household member revoke a lost or retired phone.

drop index if exists public.naknak_devices_senior_id_idx;

create or replace function public.native_device_disconnect(p_secret text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.naknak_devices
  where device_secret = p_secret;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

create or replace function public.revoke_household_device(
  p_household_id uuid,
  p_device_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.naknak_household_members
    where household_id = p_household_id
      and auth_uid = (select auth.uid())
  ) then
    raise exception 'Wala kang access sa household na ito.';
  end if;

  delete from public.naknak_devices
  where id = p_device_id
    and household_id = p_household_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

revoke all on function public.native_device_disconnect(text) from public, authenticated;
revoke all on function public.revoke_household_device(uuid,uuid) from public, anon;
grant execute on function public.native_device_disconnect(text) to anon;
grant execute on function public.revoke_household_device(uuid,uuid) to authenticated;
