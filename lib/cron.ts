// ─────────────────────────────────────────────
// cron.ts — node-cron background jobs
// This module must be imported exactly ONCE during server startup.
// It is imported inside app/layout.tsx (server component) to ensure
// it runs in the Next.js server process.
//
// Jobs:
//   1. Email queue processor  — every 2 minutes
//   2. Medication reminders   — every 5 minutes
// ─────────────────────────────────────────────

import cron from 'node-cron';
import { processEmailQueue, processMedicationReminders } from './emailProcessor';

let initialized = false;

export function initCronJobs(): void {
  // Guard against double-initialization (e.g., hot-reload in dev)
  if (initialized) return;
  initialized = true;

  // ── Job 1: Email retry queue — runs every 2 minutes ──────────────
  cron.schedule('*/2 * * * *', async () => {
    console.log('[Cron] Running email queue processor...');
    try {
      await processEmailQueue();
    } catch (err) {
      console.error('[Cron] Email processor error:', err);
    }
  });

  // ── Job 2: Medication reminders — runs every 5 minutes ───────────
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Processing medication reminders...');
    try {
      await processMedicationReminders();
    } catch (err) {
      console.error('[Cron] Medication reminder error:', err);
    }
  });

  console.log('[Cron] Background jobs initialized (email: */2min, reminders: */5min)');
}
