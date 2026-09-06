-- ═══════════════════════════════════════════════════════════════════════
--  NakNak Secured Sync Schema — run once in Supabase SQL Editor
--
--  Two access paths, two trust models:
--   1. CAREGIVER (web dashboard) — signs in via Supabase Auth (magic link).
--      RLS scopes every query to households they actually belong to.
--   2. SENIOR'S PHONE (app.html) — never logs in. Pairs once with a 6-char
--      code, receives a private device_secret, and from then on every
--      read/write goes through security-definer functions that check that
--      secret. The phone never gets a Supabase session or a JWT.
--
--  Tables have RLS locked to "deny all" for anon/authenticated by default.
--  The only way in is: (a) an authenticated caregiver via household
--  membership, or (b) the RPC functions below, which run with elevated
--  privileges internally but validate the caller's device_secret first.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── HOUSEHOLDS ─────────────────────────────────────────────────────────
create table if not exists naknak_households (
  id              uuid primary key default gen_random_uuid(),
  pair_code       text unique not null,
  pair_code_expires_at timestamptz not null default (now() + interval '48 hours'),
  max_devices     int not null default 4,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now()
);

-- ── CAREGIVER MEMBERSHIP (auth-linked) ─────────────────────────────────
create table if not exists naknak_household_members (
  household_id uuid not null references naknak_households(id) on delete cascade,
  auth_uid     uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'caregiver',
  joined_at    timestamptz default now(),
  primary key (household_id, auth_uid)
);

-- ── PAIRED DEVICES (secret-linked, no auth) ────────────────────────────
create table if not exists naknak_devices (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references naknak_households(id) on delete cascade,
  device_secret text unique not null,
  device_label  text default 'NakNak Phone',
  paired_at     timestamptz default now(),
  last_seen_at  timestamptz default now()
);

-- ── STATE (the actual synced JSON blob) ────────────────────────────────
create table if not exists naknak_state (
  household_id uuid primary key references naknak_households(id) on delete cascade,
  state        jsonb not null default '{}'::jsonb,
  rev          bigint not null default 0,
  updated_at   timestamptz default now()
);

-- Index every foreign key and recurring RLS lookup used by the dashboard.
create index if not exists naknak_households_created_by_idx
  on naknak_households (created_by);
create index if not exists naknak_household_members_auth_uid_idx
  on naknak_household_members (auth_uid);
create index if not exists naknak_devices_household_id_idx
  on naknak_devices (household_id);

-- ═══════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY — deny by default, open only for caregivers via
--  real membership. Devices never touch these tables directly.
-- ═══════════════════════════════════════════════════════════════════════
alter table naknak_households         enable row level security;
alter table naknak_household_members  enable row level security;
alter table naknak_devices            enable row level security;
alter table naknak_state              enable row level security;

drop policy if exists "member can read own household"   on naknak_households;
drop policy if exists "auth user can create household"  on naknak_households;
drop policy if exists "member can read own membership"  on naknak_household_members;
drop policy if exists "member can read own state"        on naknak_state;
drop policy if exists "member can write own state"       on naknak_state;
drop policy if exists "member can insert own state"      on naknak_state;
drop policy if exists "member can update own state"      on naknak_state;
drop policy if exists "member can delete own state"      on naknak_state;
drop policy if exists "member can read own devices"       on naknak_devices;

create policy "auth user can create household" on naknak_households
  for insert to authenticated with check (created_by = (select auth.uid()));

create policy "member can read own household" on naknak_households
  for select to authenticated using (
    id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );

create policy "member can read own membership" on naknak_household_members
  for select to authenticated using (auth_uid = (select auth.uid()));

create policy "member can read own state" on naknak_state
  for select to authenticated using (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );

create policy "member can insert own state" on naknak_state
  for insert to authenticated with check (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );

create policy "member can update own state" on naknak_state
  for update to authenticated using (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  ) with check (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );

create policy "member can delete own state" on naknak_state
  for delete to authenticated using (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );

-- Paid plan changes are authoritative only when made by the service-role
-- credential held by the verified payment webhook. This also prevents a
-- paired phone from changing `state.plan` through device_push_state.
create or replace function protect_naknak_paid_plan()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_role text := current_setting('request.jwt.claim.role', true);
begin
  if request_role is distinct from 'service_role'
     and old.state->'plan' is distinct from new.state->'plan' then
    raise exception 'Plan changes require verified payment or support approval.';
  end if;
  return new;
end;
$$;

revoke all on function protect_naknak_paid_plan() from public;

drop trigger if exists protect_naknak_paid_plan on naknak_state;
create trigger protect_naknak_paid_plan
before update of state on naknak_state
for each row execute function protect_naknak_paid_plan();

create policy "member can read own devices" on naknak_devices
  for select to authenticated using (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );

-- No policies granted to `anon` on any table above — anon access is
-- funneled exclusively through the security-definer functions below,
-- which validate a device_secret or a pair_code before touching data.

-- ═══════════════════════════════════════════════════════════════════════
--  RPC: create_household — caregiver creates a Family Space (authenticated)
-- ═══════════════════════════════════════════════════════════════════════
create or replace function create_household(p_senior_name text default 'Senior')
returns table(household_id uuid, pair_code text) as $$
declare
  v_code text;
  v_hh_id uuid;
  v_senior jsonb;
begin
  if auth.uid() is null then
    raise exception 'Kailangan mag-sign in muna.';
  end if;

  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into naknak_households (pair_code, created_by) values (v_code, auth.uid())
    returning id into v_hh_id;
  insert into naknak_household_members (household_id, auth_uid, role) values (v_hh_id, auth.uid(), 'owner');

  v_senior := jsonb_build_object(
    'id', gen_random_uuid()::text, 'name', p_senior_name, 'nickname', split_part(p_senior_name,' ',1),
    'battery', 100, 'status', 'ok', 'location', '', 'lastCheckin', null, 'checkedIn', false,
    'gpsLocation', null,
    'medicalProfile', jsonb_build_object('bloodType','','allergies','[]'::jsonb,'conditions','[]'::jsonb,'doctorName','','doctorNum','','philhealth','','notes',''),
    'eventLog', jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','checkin','icon','heart','title','Profile na-create','time',now(),'detail','')),
    'contacts', '[]'::jsonb, 'medications', '[]'::jsonb, 'vitals', '[]'::jsonb,
    'safeZone', null, 'notes', '[]'::jsonb, 'vault', '[]'::jsonb, 'goBag', '{}'::jsonb
  );

  insert into naknak_state (household_id, state, rev)
    values (v_hh_id, jsonb_build_object('seniors', jsonb_build_array(v_senior), 'plan','free','activeSeniorId',v_senior->>'id','alerts','[]'::jsonb), extract(epoch from now())*1000);

  return query select v_hh_id, v_code;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══════════════════════════════════════════════════════════════════════
--  RPC: pair_device — phone redeems a pair code, gets a private secret.
--  Callable by anon. Rate-limit this at the app layer (see DEPLOY.md).
-- ═══════════════════════════════════════════════════════════════════════
create or replace function pair_device(p_code text, p_label text default 'NakNak Phone')
returns table(household_id uuid, device_secret text) as $$
declare
  v_hh naknak_households%rowtype;
  v_count int;
  v_secret text;
begin
  select * into v_hh from naknak_households h where h.pair_code = upper(trim(p_code));
  if not found then
    raise exception 'Hindi mahanap ang code na iyan.';
  end if;
  if v_hh.pair_code_expires_at < now() then
    raise exception 'Expired na ang code na ito. Gumawa ng bago sa dashboard.';
  end if;

  select count(*) into v_count from naknak_devices d where d.household_id = v_hh.id;
  if v_count >= v_hh.max_devices then
    raise exception 'Umabot na sa limitasyon ng mga device para sa household na ito.';
  end if;

  v_secret := encode(extensions.gen_random_bytes(24), 'hex');
  insert into naknak_devices (household_id, device_secret, device_label)
    values (v_hh.id, v_secret, p_label);

  return query select v_hh.id, v_secret;
end;
$$ language plpgsql security definer set search_path = public, extensions;

-- ═══════════════════════════════════════════════════════════════════════
--  RPC: device_get_state / device_push_state — the only way a phone
--  (anon, no session) can read or write. Both require a valid device_secret.
-- ═══════════════════════════════════════════════════════════════════════
create or replace function device_get_state(p_secret text)
returns table(state jsonb, rev bigint) as $$
declare
  v_hh_id uuid;
begin
  select household_id into v_hh_id from naknak_devices where device_secret = p_secret;
  if not found then raise exception 'Hindi valid ang device.'; end if;
  update naknak_devices set last_seen_at = now() where device_secret = p_secret;
  return query select s.state, s.rev from naknak_state s where s.household_id = v_hh_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function device_push_state(p_secret text, p_state jsonb, p_rev bigint)
returns void as $$
declare
  v_hh_id uuid;
begin
  select household_id into v_hh_id from naknak_devices where device_secret = p_secret;
  if not found then raise exception 'Hindi valid ang device.'; end if;
  update naknak_devices set last_seen_at = now() where device_secret = p_secret;
  update naknak_state set state = p_state, rev = p_rev, updated_at = now() where household_id = v_hh_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ═══════════════════════════════════════════════════════════════════════
--  RPC: regenerate_pair_code — owner invalidates the old code (e.g. it
--  leaked, or expired) and gets a fresh one. Existing paired devices keep
--  working; the old code alone becomes useless.
-- ═══════════════════════════════════════════════════════════════════════
create or replace function regenerate_pair_code(p_household_id uuid)
returns text as $$
declare
  v_code text;
  v_is_member boolean;
begin
  select exists(
    select 1 from naknak_household_members
    where household_id = p_household_id and auth_uid = auth.uid()
  ) into v_is_member;
  if not v_is_member then
    raise exception 'Wala kang access sa household na ito.';
  end if;

  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  update naknak_households
    set pair_code = v_code, pair_code_expires_at = now() + interval '48 hours'
    where id = p_household_id;
  return v_code;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function regenerate_pair_code(uuid) from public;

-- Lock down execute grants: anon may only call the pairing + device
-- functions, never touch tables directly. Authenticated caregivers use
-- create_household plus ordinary RLS-scoped table access from the client.
revoke all on function pair_device(text,text) from public;
revoke all on function device_get_state(text) from public;
revoke all on function device_push_state(text,jsonb,bigint) from public;
revoke all on function create_household(text) from public;
grant execute on function pair_device(text,text) to anon;
grant execute on function device_get_state(text) to anon;
grant execute on function device_push_state(text,jsonb,bigint) to anon;
grant execute on function create_household(text) to authenticated;
grant execute on function regenerate_pair_code(uuid) to authenticated;

-- Realtime broadcast on state changes (caregiver dashboard listens here)
alter publication supabase_realtime add table naknak_state;

-- ═══════════════════════════════════════════════════════════════════════
--  NAKS, MY LETTER — a private journal for the caregiver. Same RLS pattern
--  as everything else: authenticated household members only, no anon access.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists naknak_letters (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references naknak_households(id) on delete cascade,
  author_email text,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists naknak_letters_household_id_idx
  on naknak_letters (household_id);

alter table naknak_letters enable row level security;

create policy "member can read own letters" on naknak_letters
  for select to authenticated using (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );

create policy "member can write own letters" on naknak_letters
  for insert to authenticated with check (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );

create policy "member can delete own letters" on naknak_letters
  for delete to authenticated using (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );

-- ═══════════════════════════════════════════════════════════════════════
--  PAYMENT EVENTS — audit log written only by the paymongo-webhook Edge
--  Function (service-role key, bypasses RLS). Household members can read
--  their own payment history; no client can write here directly, which
--  is what makes plan activation trustworthy instead of self-reported.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists naknak_payment_events (
  id uuid primary key default gen_random_uuid(),
  processor_event_id text unique not null,
  household_id uuid references naknak_households(id) on delete set null,
  plan text,
  amount_total bigint,
  currency text,
  status text not null,
  raw_event jsonb,
  created_at timestamptz default now()
);

create index if not exists naknak_payment_events_household_id_idx
  on naknak_payment_events (household_id);

alter table naknak_payment_events enable row level security;

create policy "member can read own payment events" on naknak_payment_events
  for select to authenticated using (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );
