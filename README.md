# SIMS Mobile

Android app for the **SIMS (Student Internship Management System)** of Bacolod City College, for **Students** and **Supervisors**. Coordinators and Administrators use the website.

It talks to the SIMS Laravel server through the JSON API `/api/v1` (contract: `docs/api/v1.md` in the Laravel repo). The server enforces every rule; the app only mirrors them for a better experience.

- Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router
- NativeWind 4 (Tailwind 3) · TanStack Query 5 · axios · expo-secure-store
- Android package: `ph.edu.bcc.sims`

## Requirements

- Node.js 20 or newer, npm, Git
- An Android phone with **Expo Go** (Play Store) for development, or an Android emulator
- The SIMS Laravel project running (locally or hosted)

## Setup

```bash
npm install
cp .env.example .env     # then edit .env
```

`.env` holds a single value, the **server address** (no trailing slash; `/api/v1` is added by the app):

```
EXPO_PUBLIC_API_URL=https://sims.your-domain.ph
```

- `.env` is git-ignored; only `.env.example` is committed.
- Expo bakes `EXPO_PUBLIC_*` values into the bundle: **restart `npx expo start` after changing `.env`** (add `--clear` if the old value sticks).
- Use **HTTPS**. Android release builds refuse plain `http://`, so test the way production will run.
- If the address is missing or invalid, the app shows "App is not configured" instead of the login screen.

## Run it on your phone

1. Install **Expo Go** from the Play Store.
2. Start the dev server:
   ```bash
   npx expo start
   ```
3. Scan the QR code with Expo Go. Your phone and PC must be on the same Wi-Fi. If they aren't (or the network blocks it), run `npx expo start --tunnel` instead.
4. Log in with an active **Student** or **Supervisor** account.

Everything used so far ships inside Expo Go. Later modules (push notifications, Module 14) will need a development build (`npx eas-cli@latest build --profile development`).

## Point the app at your local Laravel (HTTPS tunnel)

Your phone can't use `http://127.0.0.1:8000`, and Android blocks plain HTTP. Put an HTTPS tunnel in front of the local server with [ngrok](https://ngrok.com) (free account):

```bash
# terminal 1, in the Laravel project (C:\xampp\htdocs\sims)
php artisan serve                 # http://127.0.0.1:8000

# terminal 2
ngrok http 8000                   # prints e.g. https://ab12-34-56.ngrok-free.app
```

Then in this project's `.env`:

```
EXPO_PUBLIC_API_URL=https://ab12-34-56.ngrok-free.app
```

and restart `npx expo start`. Check the tunnel from any browser or curl first:

```bash
curl -s -X POST https://ab12-34-56.ngrok-free.app/api/v1/login \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{"email":"student@example.com","password":"secret","device_name":"curl"}'
```

Notes:
- The free ngrok URL changes every time ngrok restarts; update `.env` and restart Expo when it does.
- The app sends `ngrok-skip-browser-warning` automatically when the address contains "ngrok", so ngrok's warning page doesn't get in the way.
- The two tunnels are different things: `expo start --tunnel` delivers the app's JavaScript to Expo Go; ngrok carries the app's API calls to Laravel.

## Checks

```bash
npx tsc --noEmit                    # types
npx expo-doctor                     # dependency / config health
npx expo export --platform android  # production Android bundle builds
```

## Project layout

```
src/
  app/                    Expo Router routes (every file is a screen)
    _layout.tsx           providers, splash, role-based route guards
    index.tsx             redirects to /login, /student or /supervisor
    login.tsx
    student/              Student tabs: Home, Attendance, Reports, Feedback, Profile
    supervisor/           Supervisor tabs: Home, Approvals, Students, Evaluations, Profile
  api/                    the only place that talks HTTP
    client.ts             axios instance: base URL, Bearer token, error handling
    errors.ts             ApiError (network / 401 / 403 code / 422 fields / 429 Retry-After ...)
    types.ts              request/response types matching docs/api/v1.md
    auth.ts               login, logout, me (+ TanStack Query options)
  auth/                   AuthProvider (session state), secure token storage, device name
  components/             shared UI (Button, TextField, Banner, Card, splash, tabs, placeholders)
  features/profile/       Profile screen (shared by both roles)
  lib/                    query client, Asia/Manila 12-hour date/time helpers
  theme/colors.ts         SIMS green (same Tailwind green as the website)
  config.ts               reads EXPO_PUBLIC_API_URL
```

## How the session works

- `POST /login` returns a Sanctum token. It is stored **only** in `expo-secure-store` and sent as `Authorization: Bearer ...`.
- On launch the app reads the token and calls `GET /me`. If the server can't be reached it offers **Try again** or **Log out** (the token is kept, so you aren't logged out just for being offline).
- Any `401`, or `403` with `code` `role_not_allowed` / `account_inactive`, clears the token and returns to Login with the reason.
- Logout calls `POST /logout` and clears the token even if that request fails.
- Dates and times are shown in Asia/Manila, 12-hour format, whatever the phone's time zone.
