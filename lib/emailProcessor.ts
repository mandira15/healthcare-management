import prisma from './prisma';
import { sendImmediate } from './mailer';

// ─────────────────────────────────────────────
// Exponential backoff delays (minutes → ms)
// attempt 0 → wait 1 min before retry
// attempt 1 → wait 5 min
// attempt 2 → wait 15 min
// attempt ≥ 3 → PERMANENTLY_FAILED
// ─────────────────────────────────────────────
const BACKOFF_MINUTES = [1, 5, 15];
const MAX_ATTEMPTS = 3;

function nextRetryDate(attempts: number): Date {
  const minutes = BACKOFF_MINUTES[attempts] ?? 15;
  return new Date(Date.now() + minutes * 60 * 1000);
}

// ─────────────────────────────────────────────
// processEmailQueue — called by node-cron every 2 minutes.
// Queries pending/failed rows due for retry, attempts to send each,
// and updates the row status accordingly.
// ─────────────────────────────────────────────
export async function processEmailQueue(): Promise<void> {
  const now = new Date();

  // Fetch all retryable rows
  const rows = await prisma.emailLog.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      attempts: { lt: MAX_ATTEMPTS },
      nextRetryAt: { lte: now },
    },
    take: 20, // process at most 20 per tick to avoid hammering Gmail
    orderBy: { nextRetryAt: 'asc' },
  });

  for (const row of rows) {
    const success = await sendImmediate(row.recipient, row.subject, row.body);
    const newAttempts = row.attempts + 1;

    if (success) {
      await prisma.emailLog.update({
        where: { id: row.id },
        data: { status: 'SENT', attempts: newAttempts, updatedAt: new Date() },
      });
    } else if (newAttempts >= MAX_ATTEMPTS) {
      // Exhausted all retries — mark permanently failed for admin review
      await prisma.emailLog.update({
        where: { id: row.id },
        data: {
          status: 'PERMANENTLY_FAILED',
          attempts: newAttempts,
          updatedAt: new Date(),
        },
      });
      console.error(
        `[EmailProcessor] Permanently failed email ${row.id} to ${row.recipient}`
      );
    } else {
      // Schedule next retry with exponential backoff
      await prisma.emailLog.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          attempts: newAttempts,
          nextRetryAt: nextRetryDate(newAttempts),
          updatedAt: new Date(),
        },
      });
    }
  }
}

// ─────────────────────────────────────────────
// processMedicationReminders — called by node-cron every 5 minutes.
// Finds unsent reminders that are due and queues them as EmailLog rows.
// ─────────────────────────────────────────────
export async function processMedicationReminders(): Promise<void> {
  const now = new Date();

  const reminders = await prisma.medicationReminder.findMany({
    where: {
      sent: false,
      nextDueAt: { lte: now },
    },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  for (const reminder of reminders) {
    const subject = `💊 Medication Reminder: ${reminder.medicine}`;
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#2563eb">💊 Medication Reminder</h2>
        <p>Dear <strong>${reminder.user.name}</strong>,</p>
        <p>It's time to take: <strong>${reminder.medicine}</strong> — ${reminder.dosage}</p>
        <p><em>${reminder.frequency}</em></p>
      </div>`;

    // Insert into EmailLog (cron will actually send it)
    await prisma.emailLog.create({
      data: {
        recipient: reminder.user.email,
        subject,
        body: html,
        status: 'PENDING',
        attempts: 0,
        nextRetryAt: new Date(),
        userId: reminder.userId,
      },
    });

    // Mark as sent so we don't re-queue on next tick
    await prisma.medicationReminder.update({
      where: { id: reminder.id },
      data: { sent: true },
    });
  }
}
