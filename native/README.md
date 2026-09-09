# NakNak Native

This folder contains the Expo/React Native version of NakNak. It extends the existing web prototype; it does not replace or rewrite the web files in the repository root.

## Current native milestone

- Senior/PWD onboarding with name, language, and accessibility needs
- Single-screen, non-scrolling emergency home with pinned bottom navigation
- Direct `tel:` calling to the primary emergency contact or 911/112, without a NakNak confirmation dialog
- Local medication schedules for 1x, 2x, 3x, 4x, and flexible windows
- Flexible windows for morning, noon, afternoon, evening, and bedtime
- On-device medication reminders when notification permission is granted
- On-device profile, medication, contact, check-in, and SOS-event storage
- Optional Family Code pairing with an assigned Senior/PWD record
- Server-confirmed Ayos Ako and SOS-opened status in the Caregiver/Anak dashboard
- Secure local storage for the opaque device credential and revocation from either device

## Capability boundaries

| Capability | Current state |
| --- | --- |
| Direct phone call | Implemented through the device dialer |
| Local medication reminder | Implemented on the device |
| Offline app data | Implemented on the device |
| Caregiver dashboard status | Ayos Ako and SOS-opened status only |
| Caregiver remote push | Not implemented |
| SMS or automatic calling | Not implemented |
| Automatic location sharing | Not implemented |
| Fall detection | Not implemented |

Medication schedules, contacts, and location remain local to the phone; they are not synced by the Family Code milestone. The operating system and mobile carrier ultimately control whether a call can be placed. Local reminders, calling, and a real two-device dashboard flow must be verified on physical iOS and Android devices before release.

## Run locally

Install Node.js 20 or newer and pnpm, then run:

```bash
pnpm install
pnpm start
```

From the Expo terminal, open iOS, Android, or web. Useful checks:

```bash
pnpm typecheck
pnpm exec expo export --platform web
pnpm exec expo-doctor
```

## Build installable apps

The bundle identifiers and EAS profiles are already defined in `app.json` and `eas.json`. After signing in to an Expo account:

```bash
pnpm exec eas build --platform ios --profile preview
pnpm exec eas build --platform android --profile preview
```

Apple and Google developer accounts, signing credentials, store listings, privacy disclosures, physical-device safety testing, and release approval are still required before public deployment.
