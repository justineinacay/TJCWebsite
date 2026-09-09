-- Connect a native Senior/PWD device to one senior without giving the device
-- permission to replace the household's full shared state document.

alter table public.naknak_devices
  add column if not exists senior_id text;

create index if not exists naknak_devices_senior_id_idx
  on public.naknak_devices (senior_id);

create or replace function public.pair_native_device(
  p_code text,
  p_label text default 'NakNak Native Phone',
  p_senior_name text default ''
)
returns table(household_id uuid, device_secret text, senior_id text, senior_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household public.naknak_households%rowtype;
  v_state jsonb;
  v_senior jsonb;
  v_device_count integer;
  v_secret text;
begin
  select * into v_household
  from public.naknak_households
  where pair_code = upper(trim(p_code));

  if not found then
    raise exception 'Hindi mahanap ang Family Code na iyan.';
  end if;
  if v_household.pair_code_expires_at < now() then
    raise exception 'Expired na ang Family Code. Gumawa ng bago sa caregiver dashboard.';
  end if;

  select count(*) into v_device_count
  from public.naknak_devices
  where naknak_devices.household_id = v_household.id;
  if v_device_count >= v_household.max_devices then
    raise exception 'Umabot na sa limitasyon ng devices para sa pamilyang ito.';
  end if;

  select state into v_state
  from public.naknak_state
  where naknak_state.household_id = v_household.id;

  select item into v_senior
  from jsonb_array_elements(coalesce(v_state->'seniors', '[]'::jsonb)) as item
  where lower(trim(item->>'name')) = lower(trim(p_senior_name))
     or lower(trim(coalesce(item->>'nickname', ''))) = lower(trim(p_senior_name))
  limit 1;

  if v_senior is null and jsonb_array_length(coalesce(v_state->'seniors', '[]'::jsonb)) = 1 then
    v_senior := (v_state->'seniors')->0;
  end if;
  if v_senior is null then
    raise exception 'Hindi matukoy ang family member. Itugma ang pangalan sa caregiver dashboard.';
  end if;

  v_secret := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.naknak_devices (household_id, device_secret, device_label, senior_id)
  values (v_household.id, v_secret, left(coalesce(nullif(trim(p_label), ''), 'NakNak Native Phone'), 80), v_senior->>'id');

  return query select v_household.id, v_secret, v_senior->>'id', v_senior->>'name';
end;
$$;

create or replace function public.native_device_get_status(p_secret text)
returns table(senior_name text, senior_status text, last_checkin timestamptz, rev bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_senior_id text;
begin
  select household_id, senior_id into v_household_id, v_senior_id
  from public.naknak_devices
  where device_secret = p_secret;
  if not found or v_senior_id is null then
    raise exception 'Hindi valid o hindi naka-assign ang device.';
  end if;

  update public.naknak_devices
  set last_seen_at = now()
  where device_secret = p_secret;

  return query
  select senior->>'name', senior->>'status', nullif(senior->>'lastCheckin', '')::timestamptz, state_row.rev
  from public.naknak_state as state_row,
       lateral jsonb_array_elements(coalesce(state_row.state->'seniors', '[]'::jsonb)) as senior
  where state_row.household_id = v_household_id
    and senior->>'id' = v_senior_id;
end;
$$;

create or replace function public.native_device_report(
  p_secret text,
  p_event text,
  p_client_time timestamptz default now()
)
returns table(delivered boolean, rev bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_senior_id text;
  v_state jsonb;
  v_senior jsonb;
  v_senior_index integer;
  v_event jsonb;
  v_alert jsonb;
  v_rev bigint;
begin
  if p_event not in ('check_in_ok', 'sos_opened') then
    raise exception 'Hindi suportadong native event.';
  end if;

  select household_id, senior_id into v_household_id, v_senior_id
  from public.naknak_devices
  where device_secret = p_secret;
  if not found or v_senior_id is null then
    raise exception 'Hindi valid o hindi naka-assign ang device.';
  end if;

  select state into v_state
  from public.naknak_state
  where household_id = v_household_id
  for update;

  select item, (ordinality - 1)::integer into v_senior, v_senior_index
  from jsonb_array_elements(coalesce(v_state->'seniors', '[]'::jsonb)) with ordinality as senior(item, ordinality)
  where item->>'id' = v_senior_id;
  if v_senior is null then
    raise exception 'Hindi na mahanap ang family member para sa device na ito.';
  end if;

  if p_event = 'check_in_ok' then
    v_event := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'checkin',
      'icon', 'checkmark',
      'title', 'Ayos Ako mula sa native app',
      'time', p_client_time,
      'detail', 'Nakumpirma ng NakNak server'
    );
    v_senior := jsonb_set(v_senior, '{status}', '"ok"'::jsonb, true);
    v_senior := jsonb_set(v_senior, '{checkedIn}', 'true'::jsonb, true);
    v_senior := jsonb_set(v_senior, '{lastCheckin}', to_jsonb(p_client_time), true);
  else
    v_event := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'sos',
      'icon', 'sos',
      'title', 'SOS mula sa native app',
      'time', p_client_time,
      'detail', 'Nakumpirma ng NakNak server'
    );
    v_senior := jsonb_set(v_senior, '{status}', '"sos"'::jsonb, true);
    v_alert := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'sos',
      'status', 'active',
      'seniorId', v_senior_id,
      'seniorName', v_senior->>'name',
      'time', p_client_time,
      'location', ''
    );
    v_state := jsonb_set(
      v_state,
      '{alerts}',
      jsonb_build_array(v_alert) || coalesce(v_state->'alerts', '[]'::jsonb),
      true
    );
  end if;

  v_senior := jsonb_set(
    v_senior,
    '{eventLog}',
    jsonb_build_array(v_event) || coalesce(v_senior->'eventLog', '[]'::jsonb),
    true
  );
  v_state := jsonb_set(v_state, array['seniors', v_senior_index::text], v_senior, false);
  v_rev := greatest((extract(epoch from clock_timestamp()) * 1000)::bigint, coalesce((select naknak_state.rev + 1 from public.naknak_state where household_id = v_household_id), 1));

  update public.naknak_state
  set state = v_state, rev = v_rev, updated_at = now()
  where household_id = v_household_id;

  update public.naknak_devices
  set last_seen_at = now()
  where device_secret = p_secret;

  return query select true, v_rev;
end;
$$;

revoke all on function public.pair_native_device(text,text,text) from public, authenticated;
revoke all on function public.native_device_get_status(text) from public, authenticated;
revoke all on function public.native_device_report(text,text,timestamptz) from public, authenticated;
grant execute on function public.pair_native_device(text,text,text) to anon;
grant execute on function public.native_device_get_status(text) to anon;
grant execute on function public.native_device_report(text,text,timestamptz) to anon;
