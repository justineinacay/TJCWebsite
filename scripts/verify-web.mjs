import { readFile } from 'node:fs/promises';

const repositoryRoot = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, repositoryRoot), 'utf8');

const [entry, v15, app, serviceWorker, security, dashboard, landing, manifest, checkoutFunction, webhookFunction, planMigration, rlsMigration, rpcMigration, nativeContext, nativeNotifications] = await Promise.all([
  read('app.html'),
  read('app-v15.html'),
  read('naknak-app.html'),
  read('naknak-sw.js'),
  read('.well-known/security.txt'),
  read('dashboard.html'),
  read('index.html'),
  read('manifest.webmanifest'),
  read('functions/create-checkout-session/index.ts'),
  read('functions/paymongo-webhook/index.ts'),
  read('supabase/migrations/20260906180320_protect_payment_plan.sql'),
  read('supabase/migrations/20260906180615_harden_rls_and_indexes.sql'),
  read('supabase/migrations/20260906180928_limit_device_rpcs_to_anon.sql'),
  read('native/src/context/naknak-context.tsx'),
  read('native/src/lib/notifications.native.ts'),
]);

const blankAnchors = [...dashboard.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)];
const unsafeBlankAnchors = blankAnchors.filter((match) => !/\brel=["'][^"']*\bnoopener\b[^"']*\bnoreferrer\b/i.test(match[0]));

const checks = [
  ['app.html opens the direct build', entry.includes('./naknak-app.html')],
  ['static Pages mode preserves .well-known files', await read('.nojekyll').then(() => true)],
  ['v15 opens the direct build', v15.includes('./naknak-app.html')],
  ['service worker caches the direct build', serviceWorker.includes("'./naknak-app.html'")],
  ['PWA manifest has an installable app entry', JSON.parse(manifest).start_url === './app.html' && JSON.parse(manifest).icons.length >= 2],
  ['website, dashboard, and app register the service worker', [landing, dashboard, app].every((html) => html.includes("serviceWorker.register('./naknak-sw.js')"))],
  ['website, dashboard, and app link the manifest', [landing, dashboard, app].every((html) => html.includes('rel="manifest"'))],
  ['compiled app contains SeniorHome', app.includes('function SeniorHome')],
  ['compiled app contains the pinned navigation', app.includes('className="nak-home-nav"')],
  ['compiled app contains the short-screen collapse', app.includes('@media (max-height:700px)')],
  ['compiled app contains flexible medication windows', app.includes('NAKNAK_FLEX_WINDOWS')],
  ['compiled app preserves inclusive roles', app.includes('Senior / PWD User') && app.includes('Caregiver / Anak User')],
  ['compiled app exposes direct phone calls', (app.match(/window\.location\.href="tel:"/g) || []).length >= 4],
  ['compiled app states caregiver beta limits', app.includes('Hindi pa aktibo ang remote SMS, automatic calling')],
  ['compiled app contains the compact caregiver dashboard', app.includes('className="nak-care-summary"')],
  ['compiled app separates caregiver status signals', app.includes('Check-in pending') && app.includes('Battery {s.battery}%')],
  ['compiled app contains safer medication removal', app.includes('Tanggalin ang {m.name}?')],
  ['compiled app contains responsive Family Code pairing', app.includes('className="nak-sync-form"') && app.includes('placeholder="XXXXXX"')],
  ['compiled app contains the structured blood-type grid', app.includes('className="nak-blood-grid"') && app.includes('aria-pressed={selected}')],
  ['compiled app improves dark navigation contrast', app.includes('const inactiveColor=t.isDark?"#D8B995"')],
  ['compiled app has no runtime GitHub source fetch', !app.includes('raw.githubusercontent.com/justineinacay/Naknak')],
  ['compiled app has no document.write wrapper', !app.includes('document.write(')],
  ['compiled app has no NakNak call overlay', !app.includes('function EmergencyCallOverlay')],
  ['security.txt has a contact', /^Contact:\s+mailto:\S+/m.test(security)],
  ['security.txt has a future expiration', (() => { const value = security.match(/^Expires:\s+(.+)$/m)?.[1]; return !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now(); })()],
  ['security.txt points to the security policy', /^Policy:\s+https:\/\/github\.com\/justineinacay\/Naknak\/blob\/main\/SECURITY\.md$/m.test(security)],
  ['checkout tab is opened with noopener and noreferrer', dashboard.includes('window.open(data.checkout_url, "_blank", "noopener,noreferrer")')],
  ['checkout uses the signed-in caregiver token', dashboard.includes('Bearer ${session.access_token}') && !dashboard.includes('Bearer ${SUPA.anonKey}')],
  ['checkout function verifies the user and household membership', checkoutFunction.includes('auth.getUser(accessToken)') && checkoutFunction.includes('naknak_household_members')],
  ['checkout returns to the configured project base path', checkoutFunction.includes('new URL("dashboard.html?tab=settings&paid=1", siteBase)')],
  ['payment webhook rejects stale signatures', webhookFunction.includes('MAX_SIGNATURE_AGE_SECONDS') && webhookFunction.includes('Expired signature')],
  ['payment webhook records activation after the plan update', webhookFunction.indexOf('.update({ state: nextState') < webhookFunction.indexOf('status: "activated"')],
  ['paid plans cannot be self-activated in the dashboard', !dashboard.includes('confirmActivation') && !dashboard.includes('setPlan(')],
  ['database migration protects plan changes', planMigration.includes('protect_naknak_paid_plan') && planMigration.includes("request_role is distinct from 'service_role'")],
  ['database migration hardens RLS and indexes foreign keys', rlsMigration.includes('(select auth.uid())') && rlsMigration.includes('naknak_payment_events_household_id_idx') && !rlsMigration.includes('for all to authenticated')],
  ['paired-device RPCs are not granted to signed-in caregivers', rpcMigration.includes('from authenticated')],
  ['native reset cancels saved medication reminders', nativeContext.includes('cancelMedicationReminders(notificationIds)')],
  ['native reminder scheduling rolls back partial work', nativeNotifications.includes('await cancelMedicationReminders(notificationIds)')],
  ['website CTAs have real destinations', !/(?:Download the App|Get Started Free|Choose Essential|Choose Family)[\s\S]{0,80}href=["']#["']/.test(landing) && landing.includes('href="app.html"')],
  ['website states unavailable safety capabilities honestly', landing.includes('Remote alerts and automatic location sharing are still in development') && landing.includes('Fall detection (coming soon)')],
  ['external blank links are isolated', unsafeBlankAnchors.length === 0],
  ['HTML referrer fallback is present', [app, dashboard, landing].every((html) => html.includes('name="referrer"') && html.includes('strict-origin-when-cross-origin'))],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [label, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
if (failed.length) process.exitCode = 1;
