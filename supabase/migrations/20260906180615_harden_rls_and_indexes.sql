-- Remove an internal maintenance function from the public API, index every
-- foreign-key/policy lookup, and make authenticated RLS checks init-plan safe.

revoke all on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists naknak_households_created_by_idx
  on public.naknak_households (created_by);
create index if not exists naknak_household_members_auth_uid_idx
  on public.naknak_household_members (auth_uid);
create index if not exists naknak_devices_household_id_idx
  on public.naknak_devices (household_id);
create index if not exists naknak_letters_household_id_idx
  on public.naknak_letters (household_id);
create index if not exists naknak_payment_events_household_id_idx
  on public.naknak_payment_events (household_id);

drop policy if exists "auth user can create household" on public.naknak_households;
create policy "auth user can create household" on public.naknak_households
  for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "member can read own household" on public.naknak_households;
create policy "member can read own household" on public.naknak_households
  for select to authenticated using (
    id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  );

drop policy if exists "member can read own membership" on public.naknak_household_members;
create policy "member can read own membership" on public.naknak_household_members
  for select to authenticated using (auth_uid = (select auth.uid()));

drop policy if exists "member can read own state" on public.naknak_state;
create policy "member can read own state" on public.naknak_state
  for select to authenticated using (
    household_id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  );

drop policy if exists "member can write own state" on public.naknak_state;
drop policy if exists "member can insert own state" on public.naknak_state;
drop policy if exists "member can update own state" on public.naknak_state;
drop policy if exists "member can delete own state" on public.naknak_state;
create policy "member can insert own state" on public.naknak_state
  for insert to authenticated with check (
    household_id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  );
create policy "member can update own state" on public.naknak_state
  for update to authenticated using (
    household_id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  ) with check (
    household_id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  );
create policy "member can delete own state" on public.naknak_state
  for delete to authenticated using (
    household_id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  );

drop policy if exists "member can read own devices" on public.naknak_devices;
create policy "member can read own devices" on public.naknak_devices
  for select to authenticated using (
    household_id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  );

drop policy if exists "member can read own letters" on public.naknak_letters;
create policy "member can read own letters" on public.naknak_letters
  for select to authenticated using (
    household_id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  );
drop policy if exists "member can write own letters" on public.naknak_letters;
create policy "member can write own letters" on public.naknak_letters
  for insert to authenticated with check (
    household_id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  );
drop policy if exists "member can delete own letters" on public.naknak_letters;
create policy "member can delete own letters" on public.naknak_letters
  for delete to authenticated using (
    household_id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  );

drop policy if exists "member can read own payment events" on public.naknak_payment_events;
create policy "member can read own payment events" on public.naknak_payment_events
  for select to authenticated using (
    household_id in (
      select household_id from public.naknak_household_members
      where auth_uid = (select auth.uid())
    )
  );
