// ─────────────────────────────────────────────
// reminderParser.ts
// Parses human-readable frequency strings from prescriptions
// into concrete next-due timestamps.
//
// Supported patterns:
//   "once daily" / "daily"         → +24h
//   "twice daily" / "2x daily"     → +12h
//   "three times daily" / "3x"     → +8h
//   "every N hours"                → +N hours
//   "every N days"                 → +N days
//   "weekly"                       → +7 days
//   Unknown → defaults to +24h
// ─────────────────────────────────────────────

export function parseFrequencyToNextDue(frequency: string): Date {
  const f = frequency.toLowerCase().trim();

  // every N hours
  const hoursMatch = f.match(/every\s+(\d+)\s+hours?/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    return addHours(hours);
  }

  // every N days
  const daysMatch = f.match(/every\s+(\d+)\s+days?/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return addHours(days * 24);
  }

  // three times daily / 3x
  if (/three times|3\s*x|3\s*times/.test(f)) return addHours(8);

  // twice daily / 2x / bid
  if (/twice|2\s*x|2\s*times|bid/.test(f)) return addHours(12);

  // once daily / daily / od
  if (/once|daily|od/.test(f)) return addHours(24);

  // weekly
  if (/weekly|once a week/.test(f)) return addHours(24 * 7);

  // Default: 24h
  console.warn(`[ReminderParser] Unknown frequency "${frequency}", defaulting to 24h`);
  return addHours(24);
}

function addHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ─────────────────────────────────────────────
// buildRemindersFromPrescription
// Given an appointmentId + patientUserId + Gemini medication schedule,
// returns MedicationReminder create-data objects ready for prisma.createMany.
// ─────────────────────────────────────────────
export function buildRemindersFromPrescription(
  appointmentId: string,
  userId: string,
  medicationSchedule: Array<{ medicine: string; dosage: string; frequency: string }>
): Array<{
  appointmentId: string;
  userId: string;
  medicine: string;
  dosage: string;
  frequency: string;
  nextDueAt: Date;
  sent: boolean;
}> {
  return medicationSchedule.map((med) => ({
    appointmentId,
    userId,
    medicine: med.medicine,
    dosage: med.dosage,
    frequency: med.frequency,
    nextDueAt: parseFrequencyToNextDue(med.frequency),
    sent: false,
  }));
}
