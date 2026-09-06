// ═══════════════════════════════════════════════════════════════════════
//  paymongo-create-checkout — called by dashboard.html when a caregiver
//  clicks "Bayaran Ngayon". Creates a PayMongo Checkout Session server-
//  side (so the secret key never touches the browser) with the household
//  ID and plan attached as metadata. The webhook function later reads
//  that same metadata back to know what to activate.
//
//  Why not just a static PayMongo Payment Link with a URL parameter, the
//  way the Stripe version works? Stripe Payment Links have a documented,
//  reliable `client_reference_id` query parameter for exactly this case.
//  PayMongo's no-code Payment Links don't have a confirmed equivalent —
//  but Checkout Sessions, created through the API, do support metadata
//  (confirmed directly in PayMongo's own webhook payload examples). This
//  function is the small trade-off for that reliability: one extra
//  server-side step instead of a plain static link.
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYMONGO_SECRET_KEY = Deno.env.get("PAYMONGO_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_PUBLIC_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://justineinacay.github.io/Naknak/";
const allowedOrigins = new Set(
  (Deno.env.get("ALLOWED_WEB_ORIGINS") || "https://justineinacay.github.io,http://127.0.0.1:8000,http://localhost:8000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

// ₱ amounts in centavos (PayMongo's smallest currency unit), matching
// the prices already shown in the dashboard's pricing panel.
const PLAN_PRICES: Record<string, { amount: number; name: string }> = {
  essential: { amount: 10000, name: "NakNak Essential" },   // ₱100.00
  family:    { amount: 19900, name: "NakNak Family Plan" }, // ₱199.00
};

function corsHeaders(origin: string | null) {
  return {
    ...(origin && allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers });
  }
  if (origin && !allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  }
  if (!PAYMONGO_SECRET_KEY || !SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    console.error("Missing required checkout function configuration");
    return new Response(JSON.stringify({ error: "Checkout is temporarily unavailable" }), { status: 503, headers });
  }

  const authorization = req.headers.get("authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Sign in before starting checkout" }), { status: 401, headers });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Invalid or expired sign-in" }), { status: 401, headers });
  }

  let body: { household_id?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const { household_id, plan } = body;
  if (!household_id || !plan || !PLAN_PRICES[plan]) {
    return new Response(JSON.stringify({ error: "household_id and a valid plan ('essential' or 'family') are required" }), { status: 400, headers });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("naknak_household_members")
    .select("household_id")
    .eq("household_id", household_id)
    .eq("auth_uid", userData.user.id)
    .maybeSingle();
  if (membershipError || !membership) {
    return new Response(JSON.stringify({ error: "You do not have access to this household" }), { status: 403, headers });
  }

  const { amount, name } = PLAN_PRICES[plan];
  const siteBase = new URL(PUBLIC_SITE_URL.endsWith("/") ? PUBLIC_SITE_URL : `${PUBLIC_SITE_URL}/`);

  const payMongoRes = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // PayMongo uses HTTP Basic Auth: secret key as username, blank password.
      "Authorization": "Basic " + btoa(`${PAYMONGO_SECRET_KEY}:`),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          description: `${name} — Household ${household_id}`,
          line_items: [{ amount, currency: "PHP", name, quantity: 1 }],
          payment_method_types: ["gcash", "card", "paymaya", "qrph"],
          success_url: new URL("dashboard.html?tab=settings&paid=1", siteBase).toString(),
          cancel_url: new URL("dashboard.html?tab=settings", siteBase).toString(),
          metadata: { household_id, plan },
        },
      },
    }),
  });

  if (!payMongoRes.ok) {
    const errText = await payMongoRes.text();
    console.error("PayMongo checkout session creation failed:", errText);
    return new Response(JSON.stringify({ error: "Failed to create checkout session" }), { status: 502, headers });
  }

  const session = await payMongoRes.json();
  const checkout_url = session?.data?.attributes?.checkout_url;

  if (!checkout_url) {
    return new Response(JSON.stringify({ error: "PayMongo did not return a checkout URL" }), { status: 502, headers });
  }

  return new Response(JSON.stringify({ checkout_url }), {
    status: 200,
    headers,
  });
});
