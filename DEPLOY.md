# NakNak deployment guide

NakNak currently has three deliverables:

- `index.html` — public website
- `dashboard.html` — Supabase-connected Caregiver / Anak dashboard
- `naknak-app.html` — generated Senior / PWD web beta; `app.html` is its stable entry point
- `native/` — Expo iOS/Android project; local-first with optional Family Code status sync

The native sync milestone sends only server-confirmed Ayos Ako and SOS-opened status to the assigned Senior/PWD dashboard record. It does not provide push/SMS alerts, medication/contact sync, location sharing, or fall detection. Do not describe it more broadly until those capabilities and a real two-device test are complete.

## 1. Build and verify the web files

Use the repository's configured Node runtime, then run:

```bash
node scripts/build-web.mjs
node scripts/verify-web.mjs
```

The generated `naknak-app.html` is committed because GitHub Pages serves static files and does not run the build step.

## 2. Supabase production setup

Project ref: `louqshzgqutxydfqgnyz`

For a fresh project, run `naknak_schema.sql`, then apply every ordered file in `supabase/migrations/`. For the existing production project, retain the ordered migrations, including:

1. `20260906180320_protect_payment_plan.sql`
2. `20260906180615_harden_rls_and_indexes.sql`
3. `20260906180928_limit_device_rpcs_to_anon.sql`
4. `20260909082331_add_native_family_sync.sql`
5. `20260909082808_add_device_revocation.sql`

The Caregiver / Anak dashboard signs in with a Supabase magic link and uses RLS-scoped table access. The Senior / PWD web beta pairs with a temporary family code and then uses an opaque device secret through narrowly granted RPC functions.

In Supabase Auth, set the Site URL and allowed redirect URL to the exact production dashboard URL:

```text
https://justineinacay.github.io/Naknak/dashboard.html
```

If a custom domain is introduced, add its exact dashboard URL before changing the public links.

## 3. PayMongo

Follow `PAYMONGO_SETUP.md`. The checkout function requires a signed-in caregiver and verified household membership. Only the signed PayMongo webhook may activate a paid plan.

Required function secrets include:

```text
PAYMONGO_SECRET_KEY
PAYMONGO_WEBHOOK_SECRET
PUBLIC_SITE_URL=https://justineinacay.github.io/Naknak/
ALLOWED_WEB_ORIGINS=https://justineinacay.github.io
```

Never put PayMongo secret or Supabase service-role keys in browser files.

## 4. GitHub Pages

GitHub Pages serves `main` from the repository root. The PWA manifest, service worker, icons, and `.well-known/security.txt` must be committed with the HTML files.

GitHub Pages does not allow repository code to set all production response headers. The DNS and header configuration that needs a custom domain/CDN is documented in `SECURITY.md`.

## 5. Release gates that still require real devices or provider access

- Complete a real two-device test of Family Code pairing, Ayos Ako delivery, SOS-opened delivery, app-side disconnect, and caregiver-side device revocation.
- Test SOS direct calling, notification permissions, reminder delivery, cancellation, and app reset on a physical iPhone.
- Test two real devices for Caregiver / Anak and Senior / PWD synchronization.
- Complete a PayMongo test-mode checkout and signed webhook delivery.
- Verify magic-link redirects using a real mailbox.
- Create an Apple Developer account, App Store Connect record, privacy details, screenshots, TestFlight build, and review submission.

Do not claim SMS, automatic calling, guaranteed push, automatic location sharing, fall detection, or App Store availability before those capabilities are implemented and verified.
