-- Paid plan changes are authoritative only when made with the service-role
-- credential held by the verified PayMongo webhook. Caregiver and paired-device
-- writes may update the rest of the shared state, but cannot grant paid access.

create or replace function public.protect_naknak_paid_plan()
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

revoke all on function public.protect_naknak_paid_plan() from public;

drop trigger if exists protect_naknak_paid_plan on public.naknak_state;
create trigger protect_naknak_paid_plan
before update of state on public.naknak_state
for each row execute function public.protect_naknak_paid_plan();
