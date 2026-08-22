import nodemailer from 'nodemailer';
import prisma from './prisma';

// ─────────────────────────────────────────────
// Nodemailer transporter (Gmail + App Password)
// ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ─────────────────────────────────────────────
// queueEmail — writes an EmailLog row with PENDING status.
// Actual sending is done by the cron job (emailProcessor.ts).
// This never throws; logging errors are caught internally.
// ─────────────────────────────────────────────
export async function queueEmail(
  recipient: string,
  subject: string,
  body: string,
  appointmentId?: string,
  userId?: string
): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        recipient,
        subject,
        body,
        status: 'PENDING',
        attempts: 0,
        nextRetryAt: new Date(),
        appointmentId: appointmentId ?? null,
        userId: userId ?? null,
      },
    });
  } catch (err) {
    console.error('[Mailer] Failed to queue email to', recipient, err);
  }
}

// ─────────────────────────────────────────────
// sendImmediate — used by the cron processor to actually send.
// Returns true on success, false on failure.
// ─────────────────────────────────────────────
export async function sendImmediate(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"Healthcare Manager" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error('[Mailer] Send failed to', to, err);
    return false;
  }
}

// ─────────────────────────────────────────────
// Email template builders
// ─────────────────────────────────────────────
export function buildBookingConfirmEmail(data: {
  patientName: string;
  doctorName: string;
  date: string;
  startTime: string;
  endTime: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#2563eb">Appointment Confirmed ✓</h2>
      <p>Dear <strong>${data.patientName}</strong>,</p>
      <p>Your appointment has been confirmed:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Doctor</b></td><td style="padding:8px;border:1px solid #e5e7eb">${data.doctorName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Date</b></td><td style="padding:8px;border:1px solid #e5e7eb">${data.date}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Time</b></td><td style="padding:8px;border:1px solid #e5e7eb">${data.startTime} – ${data.endTime}</td></tr>
      </table>
      <p style="color:#6b7280;margin-top:24px">Please arrive 10 minutes early. If you need to cancel, do so at least 2 hours in advance.</p>
    </div>`;
}

export function buildCancellationEmail(data: {
  patientName: string;
  doctorName: string;
  date: string;
  startTime: string;
  reason?: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#ef4444">Appointment Cancelled</h2>
      <p>Dear <strong>${data.patientName}</strong>,</p>
      <p>We regret to inform you that your appointment has been cancelled:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Doctor</b></td><td style="padding:8px;border:1px solid #e5e7eb">${data.doctorName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Date</b></td><td style="padding:8px;border:1px solid #e5e7eb">${data.date}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Time</b></td><td style="padding:8px;border:1px solid #e5e7eb">${data.startTime}</td></tr>
        ${data.reason ? `<tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Reason</b></td><td style="padding:8px;border:1px solid #e5e7eb">${data.reason}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px">Please book a new appointment at your convenience.</p>
    </div>`;
}

export function buildMedicationReminderEmail(data: {
  patientName: string;
  medicine: string;
  dosage: string;
  frequency: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#2563eb">💊 Medication Reminder</h2>
      <p>Dear <strong>${data.patientName}</strong>,</p>
      <p>This is a reminder to take your medication:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Medicine</b></td><td style="padding:8px;border:1px solid #e5e7eb">${data.medicine}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Dosage</b></td><td style="padding:8px;border:1px solid #e5e7eb">${data.dosage}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb"><b>Frequency</b></td><td style="padding:8px;border:1px solid #e5e7eb">${data.frequency}</td></tr>
      </table>
    </div>`;
}

export function buildPostVisitEmail(data: {
  patientName: string;
  doctorName: string;
  summary: string;
  followUpSteps: string[];
}): string {
  const steps = data.followUpSteps.map(s => `<li>${s}</li>`).join('');
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#2563eb">Post-Visit Summary</h2>
      <p>Dear <strong>${data.patientName}</strong>,</p>
      <p>Here is your visit summary from Dr. ${data.doctorName}:</p>
      <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0">
        <p>${data.summary}</p>
      </div>
      ${steps ? `<h3>Follow-up Steps</h3><ul>${steps}</ul>` : ''}
    </div>`;
}
