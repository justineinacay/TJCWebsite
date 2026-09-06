-- ═══════════════════════════════════════════════════════════════════════
--  PayMongo payment audit log — run this once in the Supabase SQL Editor,
--  after your project is restored (see the "unpause your project" note
--  in the setup guide). Same RLS pattern as the rest of the schema:
--  household members can read their own payment history; only the
--  service-role key (used exclusively by the paymongo-webhook Edge
--  Function, never by the browser) can write to it.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists naknak_payment_events (
  id uuid primary key default gen_random_uuid(),
  processor_event_id text unique not null,   -- PayMongo event ID — the idempotency key that stops double-processing a retried webhook
  household_id uuid references naknak_households(id) on delete set null,
  plan text,                                -- 'essential' | 'family' | null if unresolved
  amount_total bigint,                      -- in the smallest currency unit (centavos), as PayMongo reports it
  currency text,
  status text not null,                     -- 'activated' | 'needs_review'
  raw_event jsonb,                          -- the full Stripe event, kept for debugging/audit
  created_at timestamptz default now()
);

create index if not exists naknak_payment_events_household_id_idx
  on naknak_payment_events (household_id);

alter table naknak_payment_events enable row level security;

drop policy if exists "member can read own payment events" on naknak_payment_events;

create policy "member can read own payment events" on naknak_payment_events
  for select to authenticated using (
    household_id in (select household_id from naknak_household_members where auth_uid = (select auth.uid()))
  );

-- No insert/update/delete policy for anon or authenticated — the Edge
-- Function writes here using the service-role key, which bypasses RLS
-- entirely by design. No client should ever be able to write a fake
-- "payment succeeded" row into this table.
