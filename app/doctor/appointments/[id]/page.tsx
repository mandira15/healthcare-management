'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface AppointmentDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  symptomText?: string;
  preVisitSummary: {
    urgencyLevel?: string;
    chiefComplaint?: string;
    suggestedQuestions?: string[];
    error?: string;
  } | null;
  postVisitSummary: {
    summary?: string;
    medicationSchedule?: Array<{ medicine: string; dosage: string; frequency: string }>;
    followUpSteps?: string[];
    error?: string;
  } | null;
  postVisitNotes?: string;
  patient: { name: string; email: string };
  doctor: { name: string };
}

export default function DoctorAppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [appt, setAppt] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [postResult, setPostResult] = useState<{ summary: unknown; aiAvailable: boolean } | null>(null);
  const [retryingPostAI, setRetryingPostAI] = useState(false);

  async function load() {
    const res = await fetch(`/api/appointments/${id}`);
    const data = await res.json();
    setAppt(data.appointment);
    setNotes(data.appointment?.postVisitNotes ?? '');
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function submitNotes() {
    setSubmitting(true);
    const res = await fetch(`/api/appointments/${id}/post-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postVisitNotes: notes }),
    });
    const data = await res.json();
    setPostResult(data);
    await load();
    setSubmitting(false);
  }

  async function retryPostVisitAI() {
    if (!appt?.postVisitNotes) return;
    setRetryingPostAI(true);
    const res = await fetch(`/api/appointments/${id}/post-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postVisitNotes: appt.postVisitNotes }),
    });
    await res.json();
    await load();
    setRetryingPostAI(false);
  }

  if (loading) return <Spinner />;
  if (!appt) return <div className="p-8 text-center text-gray-500">Appointment not found</div>;

  const preVisit = appt.preVisitSummary;
  const postVisit = appt.postVisitSummary;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/doctor/dashboard" className="text-primary-600 hover:underline text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold">Appointment — {appt.patient.name}</h1>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Patient + appointment info */}
        <div className="card">
          <div className="flex justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">{appt.patient.name}</h2>
              <p className="text-gray-500">{appt.patient.email}</p>
            </div>
            <span className={appt.status === 'CONFIRMED' ? 'badge-confirmed' : appt.status === 'COMPLETED' ? 'badge-completed' : 'badge-pending'}>{appt.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Date</p><p className="font-medium">{appt.date}</p></div>
            <div><p className="text-gray-500">Time</p><p className="font-medium">{appt.startTime} – {appt.endTime}</p></div>
          </div>
          {appt.symptomText && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Patient Symptoms</p>
              <p className="text-gray-700 text-sm">{appt.symptomText}</p>
            </div>
          )}
        </div>

        {/* Pre-visit AI summary (for doctor to prepare) */}
        {preVisit && !('error' in preVisit) && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">🤖 Pre-Visit AI Analysis</h3>
            <div className="space-y-3">
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium ${
                  preVisit.urgencyLevel === 'High' ? 'bg-red-100 text-red-700 border-red-200' :
                  preVisit.urgencyLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                  'bg-green-100 text-green-700 border-green-200'}`}>
                  ⚠ {preVisit.urgencyLevel} Urgency
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Chief Complaint</p>
                <p className="text-gray-800">{preVisit.chiefComplaint}</p>
              </div>
              {preVisit.suggestedQuestions && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Suggested Questions</p>
                  <ul className="space-y-1">
                    {preVisit.suggestedQuestions.map((q, i) => (
                      <li key={i} className="text-sm text-gray-700">• {q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Post-visit notes form */}
        {appt.status !== 'CANCELLED' && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">📝 Post-Visit Clinical Notes</h3>
            {appt.status === 'COMPLETED' && !postVisit?.error ? (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">{appt.postVisitSummary && 'summary' in appt.postVisitSummary ? appt.postVisitSummary.summary : 'Notes submitted.'}</div>
                {postVisit?.error && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-yellow-800 text-sm mb-2">AI summary unavailable</p>
                    <button onClick={retryPostVisitAI} disabled={retryingPostAI} className="btn-primary text-sm">
                      {retryingPostAI ? 'Retrying…' : '↻ Retry AI Summary'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="label">Clinical Notes</label>
                <textarea
                  className="input min-h-[150px] resize-none mb-3"
                  placeholder="Enter diagnosis, treatment plan, prescriptions, follow-up instructions…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <p className="text-xs text-gray-500 mb-3">AI will convert these notes to a patient-friendly summary with medication schedule.</p>
                <button onClick={submitNotes} disabled={submitting || !notes.trim()} className="btn-primary">
                  {submitting ? 'Submitting…' : 'Submit & Generate Summary'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Post-visit result */}
        {postResult && (
          <div className="card bg-green-50 border-green-200">
            <p className="text-green-800 font-medium">
              {postResult.aiAvailable ? '✓ Post-visit summary generated and sent to patient' : '⚠ Notes saved. AI summary failed — patient will be notified.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
    </div>
  );
}
