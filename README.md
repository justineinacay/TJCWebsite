# NakNak

**Always close, even from afar.**

NakNak is a Filipino safety and support app for Senior Citizens, Persons with Disabilities (PWDs), and their Caregiver / Anak.

This repository contains the web experience and an Expo/React Native app under `native/`. A paired native phone can now send server-confirmed **Ayos Ako** and **SOS opened** status to its assigned Senior/PWD record in the Caregiver / Anak dashboard. Remote push, SMS, automatic calling, location sharing, and fall detection remain unimplemented and are never implied by that status sync.

## Live Preview

Once GitHub Pages is enabled (see below), the site will be live at:

```
https://justineinacay.github.io/Naknak/
```

## Project Structure

```
Naknak/
├── index.html          # Full landing page (hero, about, features, how it works, pricing, FAQ)
├── app.html            # Stable entry for the current web app
├── manifest.webmanifest # Install metadata for the web beta
├── naknak-sw.js         # Offline/runtime cache and local notification worker
├── native/             # Expo/React Native app for iOS, Android, and web preview
├── Assets/
│   ├── logo-badge.png   # Navbar / footer mark — white heart on red
│   ├── logo-mark.png    # Red heart mark (spare, for other brand touchpoints)
│   └── hero-family.jpg  # Hero section photo
├── .gitignore
└── README.md
```

## Running the web experience locally

No build tools or package manager required — it's plain HTML/CSS/JS.

**Option 1 — just open it:**
Double-click `index.html`, or open it directly in a browser.

**Option 2 — local server (recommended, avoids relative-path quirks):**
```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```
Then visit `http://localhost:8000`.

The public app entry is `app.html`. It opens the self-contained `naknak-app.html` build, so the safety home no longer depends on the v13 to v15 wrapper chain or a runtime GitHub source fetch.

When editing the legacy web experience, update `web-src/naknak-app.builder.html`, then rebuild the direct app document:

```bash
node scripts/build-web.mjs
node scripts/verify-web.mjs
```

## Running the native app

See [`native/README.md`](native/README.md) for setup, device builds, and the current capability boundaries.

## Deploying with GitHub Pages

1. Push this repo to GitHub (`main` branch).
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
4. Select branch `main`, folder `/ (root)`.
5. Save — the site will be live at `https://justineinacay.github.io/Naknak/` within a minute or two.

Keep `index.html` at the repo root and the `assets/` folder alongside it — the page references images with relative paths (`assets/...`).

## Verified web capabilities

- Fully responsive (mobile, tablet, desktop)
- Light/dark mode toggle, remembered via `localStorage`
- Scroll-reveal animations, respects `prefers-reduced-motion`
- Installable web manifest and registered service worker
- The compiled web app currently loads React and supporting libraries from CDNs; repeat offline use is supported after those resources have been cached, but a first-ever offline launch is not

## Notes

- The native app is not yet listed on Google Play or the App Store. Store links must be added only after approved listings exist.
- Remote push/SMS, automatic calling, automatic location sharing, medication/contact sync, and fall detection remain beta or future capabilities and must not be presented as active. Native dashboard sync is currently limited to confirmed Ayos Ako and SOS-opened status.

## Tech Stack

- HTML5 / CSS3 (custom properties for theming)
- Vanilla JavaScript (no frameworks)
- Google Fonts: [Sora](https://fonts.google.com/specimen/Sora) (display), [Inter](https://fonts.google.com/specimen/Inter) (body)

## License

© 2026 NakNak. All rights reserved.
