// ═══════════════════════════════════════════════════════════════════════
//  paymongo-webhook — PayMongo calls this directly (never the browser)
//  when a checkout session is paid. This is what closes the same
//  self-reported-payment gap the Stripe version closed: a household's
//  plan only changes here, after PayMongo itself confirms real money
//  moved, using a signature PayMongo signs that only PayMongo (and this
//  function, holding the matching secret) can produce.
//
//  Signature format, confirmed directly from PayMongo's documentation
//  (not guessed): the `Paymongo-Signature` header looks like
//    t=1496734173,te=<test-mode-sig>,li=<live-mode-sig>
//  and the value being signed is `${timestamp}.${raw_body}`, HMAC-SHA256
//  hashed with the webhook's own secret_key (whsk_...). Only one of
//  te/li is populated per event, matching whether it's test or live mode.
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET")!;
const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sigHeader = req.headers.get("Paymongo-Signature");
  const rawBody = await req.text(); // raw text — required before verification, never JSON.parse first

  if (!sigHeader) {
    return new Response("Missing Paymongo-Signature header", { status: 400 });
  }

  // Parse "t=...,te=...,li=..." into a lookup.
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=");
    if (k) parts[k.trim()] = (v || "").trim();
  }
  const timestamp = parts["t"];
  if (!timestamp) {
    return new Response("Malformed signature header", { status: 400 });
  }

  const timestampSeconds = Number(timestamp);
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (!Number.isFinite(timestampSeconds) || ageSeconds > MAX_SIGNATURE_AGE_SECONDS) {
    return new Response("Expired signature", { status: 400 });
  }

  const expected = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`);

  // Only one of te/li is populated per event — check whichever is present.
  const candidate = parts["li"] || parts["te"];
  if (!candidate || !timingSafeEqual(expected, candidate)) {
    console.error("Signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = payload?.data?.attributes?.type;
  const eventId = payload?.data?.id;

  if (eventType !== "checkout_session.payment.paid") {
    return new Response(JSON.stringify({ received: true, ignored: eventType }), { status: 200 });
  }
  if (!eventId) {
    return new Response("Missing event id", { status: 400 });
  }

  const { data: existingEvent, error: existingEventError } = await supabase
    .from("naknak_payment_events")
    .select("id")
    .eq("processor_event_id", eventId)
    .maybeSingle();
  if (existingEventError) {
    console.error("Failed to check payment idempotency:", existingEventError.message);
    return new Response("Failed to check event", { status: 500 });
  }
  if (existingEvent) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  const session = payload.data.attributes.data; // the checkout_session resource
  const metadata = session?.attributes?.metadata || {};
  const householdId: string | undefined = metadata.household_id;
  const plan: string | undefined = metadata.plan;
  const paymentAttrs = session?.attributes?.payments?.[0]?.attributes || {};

  if (!householdId || !plan || !["essential", "family"].includes(plan)) {
    console.error(`Missing/invalid metadata on session ${session?.id} — flagged needs_review.`);
    const { error: reviewLogError } = await supabase.from("naknak_payment_events").insert({
      processor_event_id: eventId,
      household_id: null,
      plan: plan ?? null,
      amount_total: paymentAttrs.amount ?? null,
      currency: paymentAttrs.currency ?? "PHP",
      status: "needs_review",
      raw_event: payload,
    });
    if (reviewLogError) {
      console.error("Failed to log payment event for review:", reviewLogError.message);
      return new Response("Failed to log event", { status: 500 });
    }
    return new Response(JSON.stringify({ received: true, warning: "missing or invalid metadata" }), { status: 200 });
  }

  const { data: current } = await supabase
    .from("naknak_state")
    .select("state")
    .eq("household_id", householdId)
    .maybeSingle();

  if (!current) {
    console.error(`No household found for id ${householdId}`);
    return new Response(JSON.stringify({ received: true, warning: "household not found" }), { status: 200 });
  }

  const nextState = { ...current.state, plan };
  const { error: updateError } = await supabase
    .from("naknak_state")
    .update({ state: nextState, rev: Date.now(), updated_at: new Date().toISOString() })
    .eq("household_id", householdId);

  if (updateError) {
    console.error("Failed to activate plan:", updateError.message);
    return new Response("Failed to activate plan", { status: 500 });
  }

  // Log only after a successful activation. If this insert has a transient
  // failure, PayMongo can retry safely: the plan update is idempotent and the
  // event is still absent, so the next delivery will record it.
  const { error: logError } = await supabase.from("naknak_payment_events").insert({
    processor_event_id: eventId,
    household_id: householdId,
    plan,
    amount_total: paymentAttrs.amount ?? null,
    currency: paymentAttrs.currency ?? "PHP",
    status: "activated",
    raw_event: payload,
  });
  if (logError) {
    if (logError.code === "23505") {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }
    console.error("Failed to log activated payment event:", logError.message);
    return new Response("Failed to log event", { status: 500 });
  }

  console.log(`Activated "${plan}" plan for household ${householdId} via PayMongo session ${session?.id}`);
  return new Response(JSON.stringify({ received: true, activated: plan }), { status: 200 });
});
