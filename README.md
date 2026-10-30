# Time Tracker & Attendance PWA (Biometric WebAuthn + Geofencing)

A full-stack, mobile-first Time Tracking and Attendance Progressive Web Application built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL, Auth, Realtime, RLS)**.

Designed for corporate operations, remote sites, and field teams with biometric hardware verification and anti-spoofing geofencing.

---

## Key Features

### 1. Biometric Platform Authentication (WebAuthn / Passkeys)
- **Zero Raw Biometric Storage:** Biometric data (fingerprint / Face ID / Windows Hello) NEVER leaves the employee's device. Powered by `@simplewebauthn/browser` and `@simplewebauthn/server`.
- Only public key, credential ID, and signature counters are stored (`passkey_credentials`).
- Replay attack prevention via signature counters.
- Device binding checks (`device_id`) prevent buddy punching.
- Biometric verification modes: **Off**, **Always** (default), or **Random %**.
- Verified fallback (PIN / password) when sensors are missing or damaged, flagged for administrative audit.

### 2. Tap-Based Time In / Time Out
- **Single-Tap Flow:** Mobile-first giant tap button. No tedious forms.
- On tap: reads GPS -> prompts biometric scan -> sends assertion to server route.
- Server performs strict multi-factor validation:
  1. WebAuthn assertion signature, origin, challenge, and counter check.
  2. Haversine distance geofencing against active office locations.
  3. GPS accuracy threshold check (default ≤ 50m).
  4. Registered device binding match.
  5. Timestamping strictly against the **server clock** (never client clock).
- Shift analytics: late minutes, undertime, overtime, and total hours worked computed automatically against assigned shifts and grace periods.
- Rest Break In / Break Out logging with identical biometric security.

### 3. Role-Based Access Control (Admin & Employee)
- **Public Sign-up Disabled:** Accounts can only be provisioned by Admins via Supabase Admin API.
- Force password change on first login.
- Mandatory privacy consent screen explaining GPS & biometric privacy standards.
- Row Level Security (RLS) ensures employees only access their own data, while admins oversee operations.

### 4. Interactive Mapping (Leaflet + OpenStreetMap)
- **Admin Location Manager:** Click anywhere on the interactive map to place a pin, define zone radius in meters, and visualize active geofence circles.
- **Live Attendance Map:** Pinpoints where employees tapped in today with color-coded status badges (On Time vs Late).

### 5. Team Realtime Chat & Announcements
- 1-to-1 direct messaging and group channels powered by Supabase Realtime.
- Admin-only **Company Announcements** broadcast channel.
- Unread message counters and image attachments.

### 6. Connected Logins & WhatsApp Verification
- Optional linked Google and Facebook OAuth logins via `linkIdentity` (never bypasses geofencing or passkey checks).
- WhatsApp phone verification with 6-digit OTP via WhatsApp Cloud API / Twilio.
- Direct click-to-chat `wa.me` links.
- Granular notification preferences (Email, WhatsApp, Push).

### 7. Approvals & Timesheet Reports
- Employee leave requests (sick, vacation, emergency, etc.) and attendance correction filings.
- Admin review, approval, and retroactive log adjustment workflow.
- 1-click export to **CSV**, **Excel (.xlsx)**, and **PDF**.

---

## Architecture & Database Schema

The database includes 19 tables with full Row Level Security (RLS) policies and performance indexes:

- `profiles`: role (`admin` | `employee`), department, shift, bound `device_id`, phone, whatsapp_number, flags.
- `passkey_credentials`: public keys, credential IDs, counters, device IDs.
- `webauthn_challenges`: short-lived cryptographic challenges with 5-minute expiry.
- `departments`: organizational units.
- `shifts`: start time, end time, grace period minutes, work days.
- `locations`: latitude, longitude, radius in meters, active state.
- `employee_locations`: optional employee-to-location whitelist.
- `attendance_logs`: time in, time out, coordinates, accuracy, verification method, status, late/overtime minutes, flags.
- `breaks`: meal and rest intervals.
- `failed_attempts`: audit log of distance violations, low GPS accuracy, and biometric rejections.
- `leave_requests` & `correction_requests`: employee filings with admin review state.
- `conversations`, `conversation_members`, `messages`: team chat and broadcast announcements.
- `holidays`: official calendar holidays.
- `notification_preferences`: email, whatsapp, push toggles.
- `app_settings`: global biometric modes, accuracy thresholds, login providers.
- `audit_logs`: tamper-evident admin action logging.

---

## Setup Instructions

### 1. Prerequisites
- Node.js 18+ (tested with Node 20 / 24)
- A Supabase project ([supabase.com](https://supabase.com))

### 2. Database Migration & Seed
1. Open your Supabase Project Dashboard -> **SQL Editor**.
2. Run the migration script located at:
   ```
   supabase/migrations/20261030000000_init_schema.sql
   ```
3. Run the initial seed script:
   ```
   supabase/seed.sql
   ```

### 3. Environment Variables
Copy `.env.example` to `.env.local` and configure your credentials:

```bash
cp .env.example .env.local
```

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://xyzcompany.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Public Key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret (Server-only) | `eyJhbGciOi...` |
| `WEBAUTHN_RP_ID` | Relying Party ID (`localhost` or production domain) | `localhost` or `time-tracker.vercel.app` |
| `WEBAUTHN_RP_NAME` | Display name for passkey prompt | `Time Tracker Biometrics` |
| `WEBAUTHN_ORIGIN` | App Origin (must match protocol and port) | `http://localhost:3000` or `https://time-tracker.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | Root URL | `http://localhost:3000` |
| `WHATSAPP_API_TOKEN` | *(Optional)* WhatsApp Business Cloud API Token | `EAAx...` |
| `WHATSAPP_PHONE_NUMBER_ID` | *(Optional)* WhatsApp Cloud API Phone Number ID | `1029384756` |

### 4. Create Initial Administrator Account
Run the automated seed script to provision the first admin:

```bash
node scripts/seed-admin.mjs admin@company.com Admin@123456 "Super Administrator"
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser or mobile emulator.

---

## Production Deployment (Vercel)

WebAuthn requires an **HTTPS** origin in production:
1. Push this repository to GitHub or GitLab.
2. Import the project into [Vercel](https://vercel.com).
3. Set your production environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `WEBAUTHN_RP_ID` = `your-app-name.vercel.app` (exclude https://)
   - `WEBAUTHN_ORIGIN` = `https://your-app-name.vercel.app`
   - `NEXT_PUBLIC_APP_URL` = `https://your-app-name.vercel.app`
4. Deploy! Vercel automatically sets up HTTPS, allowing full WebAuthn platform authenticator access on iOS Safari, Android Chrome, and modern desktop browsers.
