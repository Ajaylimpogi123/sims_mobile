# SIMS Mobile

Android app for the **SIMS (Student Internship Management System)** of Bacolod City College: the full SIMS on mobile for all four roles (**Student, Internship Coordinator, Supervisor, Administrator**), alongside the website.

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
4. Log in with any active SIMS account (Student, Coordinator, Supervisor or Administrator).

Everything used so far ships inside Expo Go. Later modules (push notifications, Module 16) will need a development build (`npx eas-cli@latest build --profile development`).

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
    index.tsx             redirects to /login or the role's home (/student, /supervisor, /staff)
    login.tsx
    student/              Student tabs: Home, Attendance, Reports, Feedback, Profile
    supervisor/           Supervisor tabs: Home, Approvals, Students, Evaluations, Profile
    staff/                Coordinator + Admin tabs (Home, Approvals*, Students, Reports*, Companies, More)
      more/               stack inside the More tab: Users, Evaluations, Criteria, Monitoring, ...
  api/                    the only place that talks HTTP
    client.ts             axios instance: base URL, Bearer token, error handling
    errors.ts             ApiError (network / 401 / 403 code / 422 fields / 429 Retry-After ...)
    types.ts              request/response types matching docs/api/v1.md
    auth.ts               login, logout, me (+ TanStack Query options)
  auth/                   AuthProvider (session state), secure token storage, device name
  components/             shared UI (Button, TextField, Banner, Card, splash, tabs, placeholders)
  navigation/access.ts    THE map from role + /me staff flags to tabs and More items
  features/               screens shared across roles (profile, more)
  lib/                    query client, Asia/Manila 12-hour date/time helpers
  theme/colors.ts         SIMS green (same Tailwind green as the website)
  config.ts               reads EXPO_PUBLIC_API_URL
```

## How the session works

- `POST /login` returns a Sanctum token. It is stored **only** in `expo-secure-store` and sent as `Authorization: Bearer ...`.
- On launch the app reads the token and calls `GET /me`. If the server can't be reached it offers **Try again** or **Log out** (the token is kept, so you aren't logged out just for being offline).
- Any `401`, or `403` with `code` `account_inactive` / `role_not_allowed`, clears the token and returns to Login with the reason.
- Logout calls `POST /logout` and clears the token even if that request fails.
- Dates and times are shown in Asia/Manila, 12-hour format, whatever the phone's time zone.

## Navigation per role

Decided in one place, `src/navigation/access.ts`, from `GET /me` (`user.role_id` plus the `staff` permission flags for Coordinators and Administrators). Layouts only read it; hidden tabs/screens are unmounted (`Tabs.Protected` / `Stack.Protected`). This is UX only: the API enforces every rule.

| Role | Bottom tabs | More |
|---|---|---|
| Student (1) | Home, Attendance, Reports, Feedback, Profile | — |
| Supervisor (3) | Home, Approvals, Students, Evaluations, Profile | — |
| Coordinator (2) | Home, Students, Reports, Companies, More | Users, Evaluations, Attendance Monitoring, Progress, Notifications, Profile |
| Administrator (4) | Home, Approvals, Students, Companies, More | Users, Report Reviews, Evaluations, Evaluation Criteria, Attendance Monitoring, Progress, Notifications, Profile |

Approvals needs `can_approve_attendance`, Students `can_assign_internships`, Companies `can_manage_companies`, Users `can_manage_users`, Evaluation Criteria `can_manage_criteria`. Features not built yet show a "Coming in Module N" placeholder.

Notifications (every role): a bell with the unread count (red badge, "9+" like the website) sits in the header of every tab screen and opens the app-wide `/notifications` screen; staff also have it in More. The badge refreshes when a screen gains focus, when the app comes back to the foreground, every 60 s while foregrounded, and after marking read (no push until Module 16). Tapping a notification marks it read and opens its `target` through `navigateToTarget()` (`src/navigation/targets.ts`), which only goes to a route in the user's own navigation (`hrefForFeature()` in `access.ts`); the target's ids (`attendance_id`, `report_id`) arrive as search params for the screen to highlight. A null, unknown or not-allowed target just marks it read. Supervisors have no More, so their Attendance Monitoring tab hosts progress and the view-only Report Reviews (Modules 10/11).
