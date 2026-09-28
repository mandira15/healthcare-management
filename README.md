# Healthcare Appointment & Follow-up Manager

A full-stack healthcare scheduling platform built with **Next.js 14 App Router**, **SQLite + Prisma**, **Gemini AI**, **Nodemailer**, and **Google Calendar** — entirely on free-tier infrastructure.

---

## Features

| Feature | Status |
|---|---|
| Patient / Doctor / Admin portals | ✅ |
| JWT httpOnly cookie auth + bcrypt | ✅ |
| Role-based middleware | ✅ |
| Dynamic slot computation | ✅ |
| Atomic double-booking prevention (P2002) | ✅ |
| Pre-visit Gemini AI summary | ✅ |
| Post-visit Gemini summary + prescription | ✅ |
| AI failure fallback + Retry button | ✅ |
| Nodemailer + Gmail App Password | ✅ |
| EmailLog retry queue (node-cron, backoff) | ✅ |
| Medication reminder cron | ✅ |
| Leave-conflict cancellation transaction | ✅ |
| Google Calendar OAuth2 sync | ✅ |
| Find Best Doctors Nearby (Geolocation & Map) | ✅ |

> **Note:** Google Calendar integration is the safest feature to descope if you run into quota or time issues. All booking/cancellation/reschedule logic works correctly without it — Calendar events are created asynchronously and skipped gracefully if the user hasn't connected their Google account.

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- A Gmail account with 2FA enabled (for App Password)
- A Google Cloud project (for Calendar OAuth) — optional

### 1. Install

```bash
cd healthcare-manager
npm install
```

### 2. Set up environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in all values (see sections below).

### 3. Set up the database

```bash
npx prisma db push
npx prisma generate
```

This creates `dev.db` in the project root.

### 4. Create the first admin account

Use the Prisma CLI or a one-off script:

```bash
# Option A: Prisma Studio
npx prisma studio

# Option B: seed script (edit prisma/seed.ts first)
npm run db:seed
```

Or register via the API (default role is PATIENT; change role to ADMIN directly in SQLite):

```bash
npx prisma studio
# Edit the user's role to "ADMIN"
```

### 5. Run development server

```bash
npm run dev
```

Visit `http://localhost:3000`.

---

## Environment Variables (`.env.local`)

### DATABASE_URL
```
DATABASE_URL="file:./dev.db"
```

### JWT
```
JWT_SECRET="<generate with: openssl rand -base64 48>"
JWT_EXPIRES_IN="7d"
```

### Gemini AI
```
GEMINI_API_KEY="<from https://aistudio.google.com/app/apikey>"
```

### Gmail App Password (Nodemailer)

1. Enable 2FA on your Google account
2. Go to **myaccount.google.com → Security → App Passwords**
3. Create a new App Password (select "Mail" → your device)
4. Copy the 16-character password (no spaces)

```
GMAIL_USER="youraddress@gmail.com"
GMAIL_APP_PASSWORD="abcdefghijklmnop"
```

### Google Calendar OAuth2

> Skip this section if you want to descope Calendar — the app works fully without it.

**Google Cloud Console steps:**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Calendar API** (APIs & Services → Library)
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth 2.0 Client IDs**
6. Application type: **Web application**
7. Add authorised redirect URI: `http://localhost:3000/api/auth/google/callback`
8. Copy the **Client ID** and **Client Secret**

```
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
```

**To connect Calendar as a user:** Click "Connect Google Calendar" in the dashboard → sign in → grant Calendar access.

---

## Schema Notes

| Model | Key design |
|---|---|
| `User` | Single table for all roles; `role` is `PATIENT`/`DOCTOR`/`ADMIN` |
| `DoctorProfile` | `workingHours` and `leaveDates` stored as JSON strings (SQLite lacks native arrays) |
| `Appointment` | `@@unique([doctorId, date, startTime])` — the core double-booking guard |
| `EmailLog` | Decoupled email delivery; cron retries failed rows with exponential backoff |
| `MedicationReminder` | Created from Gemini post-visit `medicationSchedule`; cron fires when `nextDueAt <= now` |

---

## AI Prompts Used

### Pre-visit
```
Analyse these symptoms and return: urgency level (Low/Medium/High), chief complaint,
and three suggested questions for the doctor. Symptoms: <symptoms>

Return ONLY valid JSON: {"urgencyLevel":"Low|Medium|High","chiefComplaint":"string","suggestedQuestions":["string","string","string"]}
```

### Post-visit
```
Convert these clinical notes into a patient-friendly summary with medication schedule
and follow-up steps: <notes>

Return ONLY valid JSON: {"summary":"string","medicationSchedule":[{"medicine":"string","dosage":"string","frequency":"string"}],"followUpSteps":["string"]}
```

---

## API Endpoints

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Authenticated |
| GET | `/api/auth/me` | Authenticated |
| GET | `/api/auth/google` | Authenticated → redirects |
| GET | `/api/auth/google/callback` | OAuth callback |
| GET | `/api/doctors` | Authenticated |
| POST | `/api/doctors` | ADMIN |
| GET/PATCH/DELETE | `/api/doctors/[id]` | Auth |
| GET | `/api/doctors/[id]/slots?date=` | Authenticated |
| POST/DELETE | `/api/doctors/[id]/leave` | DOCTOR / ADMIN |
| GET/POST | `/api/appointments` | Authenticated |
| GET/PATCH/DELETE | `/api/appointments/[id]` | Owner / ADMIN |
| POST | `/api/appointments/[id]/cancel` | Owner |
| GET/POST | `/api/appointments/[id]/pre-visit` | Owner |
| GET/POST | `/api/appointments/[id]/post-visit` | DOCTOR |
| GET/POST | `/api/admin/email-logs` | ADMIN |
| GET | `/api/admin/users` | ADMIN |
