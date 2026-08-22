# System Design — Healthcare Appointment & Follow-up Manager

> Word count target: ≤800 words

---

## 1. Double-Booking Prevention

The core mechanism is a **compound unique index** on the `Appointment` table:

```sql
@@unique([doctorId, date, startTime])
```

When a patient books a slot, the API wraps the `INSERT` inside a **Prisma transaction** and catches Prisma error code `P2002` (unique constraint violation):

```typescript
try {
  appointment = await prisma.$transaction(async (tx) => {
    return tx.appointment.create({ data: { doctorId, date, startTime, ... } });
  });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return HTTP 409 Conflict; // slot already taken
  }
}
```

**Why this is race-safe:** SQLite serialises all writes at the database level. If two concurrent requests race to book the same `(doctorId, date, startTime)` triplet, exactly one `INSERT` will succeed and the other will fail with a unique-constraint error. No application-level locking or queuing is needed. The constraint acts as an atomic guard.

An additional application-level check validates leave dates and working hours before the transaction to return user-friendly error messages.

---

## 2. Leave-Conflict Transaction

When a doctor sets a leave date, **all three mutations happen in a single Prisma transaction** — so they either all succeed or all roll back:

1. **Update `DoctorProfile.leaveDates`** — append the new date to the JSON array.
2. **`findMany`** — fetch all `CONFIRMED` / `PENDING` appointments for that doctor on that date.
3. **`updateMany`** — set all found appointments to `CANCELLED`.
4. **`createMany` on `EmailLog`** — insert one email record per affected patient.

```typescript
await prisma.$transaction(async (tx) => {
  await tx.doctorProfile.update({ ... leaveDates });
  const affected = await tx.appointment.findMany({ where: { doctorId, date, status: { in: ['CONFIRMED','PENDING'] } } });
  await tx.appointment.updateMany({ where: { id: { in: affected.map(a => a.id) } }, data: { status: 'CANCELLED' } });
  for (const appt of affected) {
    await tx.emailLog.create({ data: { recipient: patientEmail, ... } });
  }
});
```

Google Calendar deletions fire **outside** the transaction (non-critical) — if Calendar cleanup fails, the leave date and cancellations are still committed.

---

## 3. Slot Computation

Available slots are **never hardcoded**. The `GET /api/doctors/[id]/slots?date=` endpoint:

1. Reads `DoctorProfile.workingHours` (JSON keyed by day-of-week: `"mon"`, `"tue"`, etc.)
2. Returns `{ onLeave: true }` if the requested date is in `leaveDates`.
3. Returns `{ offDay: true }` if the doctor has no working hours for that weekday.
4. Otherwise, generates all slot intervals of `slotDurationMinutes` within `[start, end]`.
5. Queries `Appointment` for that `doctorId + date` (status ≠ `CANCELLED`) and removes matching start times.
6. Returns each slot with an `available: boolean` field.

The patient's booking UI consumes this response and renders available/unavailable slots dynamically.

---

## 4. Slot-Hold Mechanism

This implementation uses **optimistic atomic commit** rather than a two-phase hold/confirm:

- There is no explicit "hold" state — the slot is either free or booked.
- The unique index + P2002 catch replaces a hold: whichever concurrent request succeeds the INSERT "wins" and holds the slot permanently.
- This avoids stale holds (e.g., a user who opened the booking UI but never confirmed) and simplifies the schema.

If a soft-hold were required (e.g., 5-minute temporary reservation), a `HELD` status and a cleanup cron job could be added as a future enhancement.

---

## 5. Email Retry & Failure Handling

All email sends are **decoupled** from the core booking flow:

- `queueEmail()` inserts a row into `EmailLog` with `status: PENDING` — it never sends immediately.
- A **node-cron job runs every 2 minutes** and calls `processEmailQueue()`.
- The processor fetches rows where `status IN [PENDING, FAILED] AND attempts < 3 AND nextRetryAt <= now`.
- On **success**: `status → SENT`.
- On **failure**: `attempts++`, `nextRetryAt` updated with exponential backoff:
  - Attempt 0 → 1 minute
  - Attempt 1 → 5 minutes
  - Attempt 2 → 15 minutes
- After 3 failed attempts: `status → PERMANENTLY_FAILED`.
- The Admin portal's **Email Logs** page shows all permanently failed rows and allows manual retry.

---

## 6. AI Integration & Failure Handling

Both Gemini calls (pre-visit and post-visit) are wrapped in `try/catch`. On failure:

- A **sentinel JSON** is stored: `{"error":"AI summary unavailable, please review manually"}`
- The `appointmentId` is logged to console for traceability.
- The core booking/notes save **always succeeds** regardless of AI status.
- The UI detects the error sentinel and shows a **"Retry AI Summary"** button that re-calls the endpoint.
- The retry endpoint overwrites the stored sentinel with a fresh Gemini attempt.

The LLM is entirely non-blocking — it is called asynchronously after the HTTP response is returned for booking, or synchronously-but-isolated for explicit post-visit note submission.

---

## 7. Background Jobs

Two `node-cron` schedules are registered once in `lib/cron.ts`, imported from `app/layout.tsx`:

| Job | Schedule | Function |
|---|---|---|
| Email queue processor | `*/2 * * * *` | Retry pending/failed emails |
| Medication reminders | `*/5 * * * *` | Queue reminder emails when `nextDueAt ≤ now` |

A singleton guard (`initialized` flag) prevents double-registration during Next.js dev hot-reloads.

---

## Descoping Decision

Google Calendar is deliberately the **last integration** in the build order because:
- All core flows (booking, cancellation, rescheduling) work without it.
- Calendar events are created/updated/deleted asynchronously and wrapped in try/catch.
- A missing `googleRefreshToken` on the User simply short-circuits the call and returns `null`.
- No data is lost if Calendar sync fails.
