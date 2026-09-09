# Security

This document describes NakNak's actual security model as implemented —
what's protected, how, and what genuinely isn't finished yet. The goal is
that nothing here is a surprise to whoever reads this before relying on
it with real family data.

## GitHub Pages deployment boundary

The repository is currently a static GitHub Pages site (`justineinacay.github.io/Naknak/`); no `CNAME` or custom production domain is configured in this checkout. GitHub Pages serves repository files and provides HTTPS, but it does not let this repository set arbitrary response headers. The `.well-known/security.txt` file, safe links, sensitive-URL review, and the HTML referrer fallback below are therefore direct project fixes. The response-header and DNS controls in the production checklist must be configured at GitHub Pages' supported settings, a reverse proxy/CDN such as Cloudflare, or another host that you control.

### Direct repository fixes

- `/.well-known/security.txt` is published with a monitored contact, an RFC 9116 `Expires` value, supported languages, and this policy link.
- External links already carry `rel="noopener noreferrer"`. The PayMongo checkout `window.open` call now supplies `noopener,noreferrer` as well, so a payment tab cannot retain an opener reference.
- Supabase magic-link tokens are accepted only in the callback hash and immediately removed with `history.replaceState`; the canonical redirect URL contains no query string. The `?tab=settings&paid=1` checkout return flag is non-sensitive. Location coordinates are placed in a Google Maps query only when a user explicitly opens a map link; they are not used as app authentication or identity parameters.
- The generated app, dashboard, and landing page include `meta name="referrer" content="strict-origin-when-cross-origin"` as a browser-level fallback. This does not replace the HTTP response header.

### Production DNS records

These records belong to the actual sending/production domain, not to `github.io`:

**If NakNak sends no email today** (the current product behavior):

```text
@       TXT  "v=spf1 -all"
_dmarc  TXT  "v=DMARC1; p=quarantine; rua=mailto:naknak@gmail.com"
```

After monitored reports show that every legitimate sender passes SPF and DKIM, change only the DMARC policy to:

```text
_dmarc  TXT  "v=DMARC1; p=reject; rua=mailto:naknak@gmail.com"
```

If email is introduced later, replace the SPF value with exactly the provider's required mechanisms (for example, the provider's `include:` plus `-all`) and publish the provider-supplied DKIM record at its exact selector (`<selector>._domainkey`). Do not guess a DKIM key or combine unrelated providers. The provider's setup screen is authoritative for the selector and public key.

### Production HTTP response headers

Configure these on the final HTTPS origin or CDN. They cannot be made reliable by adding HTML tags to a GitHub Pages repository:

```text
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.tile.openstreetmap.org; connect-src 'self' https://louqshzgqutxydfqgnyz.supabase.co https://api.open-meteo.com https://*.supabase.co wss://*.supabase.co; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: geolocation=(self), camera=(), microphone=()
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=63072000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
```

The CSP is intentionally written for the current static implementation: it allows the existing inline React/Babel code, the three current CDN script hosts, Google Fonts, Supabase, Open-Meteo, user-selected images, the service worker, and Leaflet/OpenStreetMap resources used by the caregiver dashboard. Start it as `Content-Security-Policy-Report-Only` on a staging/custom-domain origin, inspect violations, then enforce it. Once the inline Babel build and CDN dependencies are moved to self-hosted assets, remove `unsafe-inline` and `unsafe-eval` and narrow `img-src`/`connect-src` to the exact origins. `frame-ancestors` is the authoritative clickjacking control; `X-Frame-Options` is the compatibility fallback.

`Cross-Origin-Opener-Policy: same-origin` is compatible with the current passwordless Supabase flow because the callback is same-origin and the app does not use popup-based authentication. Re-test any future OAuth popup or cross-origin integration before enabling it on that flow.

Geolocation remains enabled for the app's SOS, safe-zone, and caregiver location features, while camera and microphone are disabled by policy. Notifications and service-worker functionality do not require either capability. Do not change `geolocation=(self)` to `()` unless the emergency location product requirement is removed.

HSTS `preload` is intentionally omitted. Add it only after the final production domain and every subdomain are permanently HTTPS-ready and the domain has been submitted/accepted for browser preload requirements.

### Rowly findings and remaining infrastructure work

No Rowly report/export is present in this repository, so this change does not claim that a Rowly scan is closed. Re-run Rowly against the deployed HTTPS origin after the CDN headers are active. Any findings about missing response headers, DNS authentication, GitHub Pages' default host, or provider-side rate limiting remain infrastructure work and cannot be resolved solely by editing this static repository.

## Reporting a vulnerability

Email **naknak@gmail.com** with details. Please don't open a public
GitHub issue for anything that could let someone access another
household's data — give us a chance to patch it first.

## The two trust models

NakNak has two very different users, so it uses two different access
patterns rather than forcing one compromise on both.

### Caregiver (web dashboard) — real authentication

Caregivers sign in with a Supabase Auth magic link (no password to leak).
Every table read/write is scoped by Postgres **Row Level Security** to
`auth.uid()`, via a `naknak_household_members` join table. This means the
*database itself* refuses to return another household's data — it's not
just the app's UI hiding it. Even a compromised or malicious client
talking directly to Supabase's REST API can't read past this.

### Senior's phone (the app) — no login, by design

A person with vision loss or unfamiliar with smartphones should never
have to complete an email OAuth flow to ask for help. Instead:

1. The caregiver's dashboard generates a 6-character pair code
   (`pair_code`), valid for **48 hours**.
2. The web beta redeems that code via `pair_device`; the native app uses
   `pair_native_device`, which also assigns the device to one Senior/PWD.
3. The pairing function validates the code and hands back a private
   **device_secret** — a 24-byte random value the phone stores locally
   and never displays.
4. The web beta's reads/writes use `device_get_state` and
   `device_push_state`. The native app instead uses the narrower
   `native_device_get_status` and `native_device_report` functions; only
   Ayos Ako and SOS-opened events are accepted, and only the assigned
   Senior/PWD JSON record is changed. Every function independently
   validates the opaque secret before touching data.

The phone has **zero direct table access**. The anon API key alone gets
it nothing — every anon-callable function validates its own secret
first. This is enforced by explicit `revoke`/`grant` statements in
`naknak_schema.sql`, not just by omission.

## What this protects against

- **A guessed or leaked 6-character pair code** is only useful for 48
  hours, and only lets someone *pair a new device* — it cannot read or
  write existing data on its own.
- **A leaked anon API key** (which is public by design in any Supabase
  project — it ships in your client-side JS) grants nothing by itself.
  Every table has RLS `deny by default`; the only paths in are
  authenticated household membership or a valid device secret.
- **Cross-household data leakage** — verified via Postgres RLS, not
  client-side filtering, so it holds even against a malicious or buggy
  client.

## Known gaps — said plainly, not hidden

These are real, current limitations. If you're deploying this for
production use with real families, read this section before you do.

- **Device revocation is implemented.** A connected native phone can
  revoke its own opaque secret from Profile, and an authenticated
  household member can disconnect a lost or retired phone from the
  dashboard. If the phone disconnects while offline, its local secret is
  still erased and the dashboard explains the remaining caregiver-side
  revocation path.
- **No rate limiting on `pair_device` beyond Supabase's platform
  defaults.** A script could still brute-force 6-character codes at
  whatever rate Supabase's own abuse protection allows. A dedicated
  limit (e.g., a Postgres function tracking attempts per IP, or an Edge
  Function) is the next hardening step if this app scales.
- **PayMongo upgrades are webhook-verified.** The checkout function first
  verifies the caregiver's Supabase session and household membership. The
  webhook rejects invalid or stale signatures, activates the plan with the
  service-role key, and then records PayMongo's event ID for idempotency.
  There is no browser-side self-activation fallback. Manual GCash transfers
  remain a support-assisted process and do not activate a plan automatically.
- **One caregiver = one household owner.** Multiple caregivers sharing
  one household (e.g., two siblings both caring for a parent) isn't
  wired up yet. Adding it is a small schema addition — an
  `invite_caregiver(email)` RPC that inserts into
  `naknak_household_members` — flagged here rather than silently
  missing.
- **This is a security *notice* document, not a security audit.** It
  describes what was deliberately built and tested during development.
  It is not a substitute for an independent penetration test or a
  professional security review before handling real health data at
  scale.

## Practical checklist before going live with real users

- [ ] Confirm `naknak_schema.sql` has been run in full on your Supabase
      project (all tables, RLS policies, and RPC functions).
- [ ] Confirm **Authentication → URL Configuration → Site URL** points
      to your real deployed domain, not `localhost` (see `DEPLOY.md`).
- [ ] Test both phone-side disconnect and caregiver-side revocation with
      two real devices before onboarding families.
- [ ] Complete a PayMongo test-mode checkout and verify the signed webhook,
      plan change, audit event, and duplicate-delivery behavior end to end.
- [ ] Verify Family Code pairing plus Ayos Ako and SOS-opened delivery on
      two real devices; medication, contacts, push, and location are not
      part of this sync milestone.
- [ ] Test SOS calling, reminders, notification cancellation, geolocation,
      and offline relaunch on a physical iPhone before TestFlight release.
