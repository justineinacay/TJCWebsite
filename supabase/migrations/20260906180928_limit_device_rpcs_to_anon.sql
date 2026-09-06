-- Paired-phone RPCs use an opaque device secret and do not need the broader
-- authenticated role. Caregiver operations remain behind authenticated RLS.

revoke execute on function public.pair_device(text,text) from authenticated;
revoke execute on function public.device_get_state(text) from authenticated;
revoke execute on function public.device_push_state(text,jsonb,bigint) from authenticated;
