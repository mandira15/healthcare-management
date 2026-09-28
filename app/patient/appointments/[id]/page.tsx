'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface PreVisitSummary {
  urgencyLevel?: string;
  chiefComplaint?: string;
  preliminaryCare?: {
    alopathy?: {
      immediateSteps?: string[];
      warningSigns?: string[];
    };
    ayurveda?: {
      homeRemedies?: string[];
      dietaryAdvice?: string[];
    };
  };
  suggestedQuestions?: string[];
  disclaimer?: string;
  error?: string;
}

interface AppointmentDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  symptomText?: string;
  preVisitSummary: PreVisitSummary | null;
  postVisitSummary: {
    summary?: string;
    medicationSchedule?: Array<{ medicine: string; dosage: string; frequency: string }>;
    followUpSteps?: string[];
    error?: string;
  } | null;
  doctor: { id: string; name: string; doctorProfile: { specialization: string } | null };
  patient: { id: string; name: string };
}

export default function PatientAppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [appt, setAppt] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingAI, setRetryingAI] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function load() {
    const res = await fetch(`/api/appointments/${id}`);
    const data = await res.json();
    setAppt(data.appointment);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function retryPreVisitAI() {
    setRetryingAI(true);
    await fetch(`/api/appointments/${id}/pre-visit`, { method: 'POST' });
    await load();
    setRetryingAI(false);
  }

  async function handleCancel() {
    if (!confirm('Cancel this appointment?')) return;
    setCancelling(true);
    await fetch(`/api/appointments/${id}/cancel`, { method: 'POST' });
    await load();
    setCancelling(false);
  }

  if (loading) return <Spinner />;
  if (!appt) return <div className="p-8 text-center text-gray-500">Appointment not found</div>;

  const preVisit = appt.preVisitSummary;
  const postVisit = appt.postVisitSummary;
  const preAIFailed = preVisit && 'error' in preVisit;
  const postAIFailed = postVisit && 'error' in postVisit;

  const urgencyColor: Record<string, string> = {
    High: 'bg-red-100 text-red-700 border-red-200',
    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Low: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/patient/dashboard" className="text-primary-600 hover:underline text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Appointment Detail</h1>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {appt.doctor.name.startsWith('Dr.') ? appt.doctor.name : `Dr. ${appt.doctor.name}`}
              </h2>
              <p className="text-gray-500">{appt.doctor.doctorProfile?.specialization}</p>
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${
              appt.status === 'CONFIRMED' ? 'badge-confirmed' :
              appt.status === 'CANCELLED' ? 'badge-cancelled' :
              appt.status === 'COMPLETED' ? 'badge-completed' : 'badge-pending'
            }`}>{appt.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Date</p><p className="font-medium">{appt.date}</p></div>
            <div><p className="text-gray-500">Time</p><p className="font-medium">{appt.startTime} – {appt.endTime}</p></div>
          </div>
          {appt.symptomText && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-gray-500 text-sm mb-1">Reported symptoms</p>
              <p className="text-gray-700 text-sm">{appt.symptomText}</p>
            </div>
          )}
          {appt.status === 'CONFIRMED' && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
              <button onClick={handleCancel} disabled={cancelling} className="btn-danger text-sm">
                {cancelling ? 'Cancelling…' : 'Cancel Appointment'}
              </button>
            </div>
          )}
        </div>

        {/* Pre-visit AI Summary */}
        {appt.symptomText && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <span>🤖</span> Pre-Visit AI Summary
              </h3>
              {preVisit && !preAIFailed && (
                <button
                  onClick={retryPreVisitAI}
                  disabled={retryingAI}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium hover:underline flex items-center gap-1"
                >
                  {retryingAI ? 'Refreshing…' : '↻ Refresh Analysis'}
                </button>
              )}
            </div>

            {!preVisit && (
              <p className="text-gray-500 text-sm">AI summary is being generated…</p>
            )}

            {preAIFailed && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm mb-3">
                  AI summary unavailable — the summary could not be generated automatically.
                </p>
                <button onClick={retryPreVisitAI} disabled={retryingAI} className="btn-primary text-sm">
                  {retryingAI ? 'Retrying…' : '↻ Retry AI Summary'}
                </button>
              </div>
            )}

            {preVisit && !preAIFailed && 'urgencyLevel' in preVisit && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${urgencyColor[preVisit.urgencyLevel ?? 'Low']}`}>
                    Urgency: {preVisit.urgencyLevel}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">Chief Complaint</p>
                  <p className="text-gray-900 font-medium">{preVisit.chiefComplaint}</p>
                </div>

                {/* Preliminary Steps Before Reaching Doctor: Allopathy & Ayurveda */}
                {preVisit.preliminaryCare ? (
                  <div className="pt-3 border-t border-gray-100 space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <span>🛡️</span> Preliminary Steps Before Reaching Doctor
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Supportive home care and relief guidelines while waiting for your appointment:
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Allopathy Card */}
                      <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg text-base leading-none">💊</span>
                            <div>
                              <h5 className="font-semibold text-blue-950 text-sm">Allopathy (Modern Care)</h5>
                              <p className="text-[11px] text-blue-700">Clinical relief & monitoring</p>
                            </div>
                          </div>

                          {preVisit.preliminaryCare.alopathy?.immediateSteps && preVisit.preliminaryCare.alopathy.immediateSteps.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider mb-1">
                                Immediate Relief Steps:
                              </p>
                              <ul className="space-y-1">
                                {preVisit.preliminaryCare.alopathy.immediateSteps.map((step, i) => (
                                  <li key={i} className="text-xs text-blue-950 flex items-start gap-1.5">
                                    <span className="text-blue-500 font-bold">•</span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {preVisit.preliminaryCare.alopathy?.warningSigns && preVisit.preliminaryCare.alopathy.warningSigns.length > 0 && (
                            <div className="pt-2 border-t border-blue-200/60">
                              <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <span>⚠️</span> Red-Flag Warning Signs:
                              </p>
                              <ul className="space-y-1">
                                {preVisit.preliminaryCare.alopathy.warningSigns.map((sign, i) => (
                                  <li key={i} className="text-xs text-red-900 bg-red-50/90 border border-red-100 rounded px-2 py-1 flex items-start gap-1.5">
                                    <span className="text-red-500 font-bold">!</span>
                                    <span>{sign}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ayurveda Card */}
                      <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 border border-emerald-200/80 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-base leading-none">🌿</span>
                            <div>
                              <h5 className="font-semibold text-emerald-950 text-sm">Ayurveda (Holistic Care)</h5>
                              <p className="text-[11px] text-emerald-700">Herbal remedies & body balance</p>
                            </div>
                          </div>

                          {preVisit.preliminaryCare.ayurveda?.homeRemedies && preVisit.preliminaryCare.ayurveda.homeRemedies.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-emerald-900 uppercase tracking-wider mb-1">
                                Home & Herbal Remedies:
                              </p>
                              <ul className="space-y-1">
                                {preVisit.preliminaryCare.ayurveda.homeRemedies.map((remedy, i) => (
                                  <li key={i} className="text-xs text-emerald-950 flex items-start gap-1.5">
                                    <span className="text-emerald-500 font-bold">•</span>
                                    <span>{remedy}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {preVisit.preliminaryCare.ayurveda?.dietaryAdvice && preVisit.preliminaryCare.ayurveda.dietaryAdvice.length > 0 && (
                            <div className="pt-2 border-t border-emerald-200/60">
                              <p className="text-[11px] font-semibold text-emerald-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <span>🥗</span> Dietary & Lifestyle Tips (Pathya):
                              </p>
                              <ul className="space-y-1">
                                {preVisit.preliminaryCare.ayurveda.dietaryAdvice.map((advice, i) => (
                                  <li key={i} className="text-xs text-emerald-900 bg-white/70 border border-emerald-100 rounded px-2 py-1 flex items-start gap-1.5">
                                    <span className="text-emerald-600 font-bold">✓</span>
                                    <span>{advice}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* If appointment was created before this feature, provide button to generate preliminary care */
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between text-xs text-amber-800">
                    <span>Ayurvedic and Allopathic preliminary steps can be generated for this appointment.</span>
                    <button
                      onClick={retryPreVisitAI}
                      disabled={retryingAI}
                      className="px-2.5 py-1 bg-amber-600 text-white rounded font-medium hover:bg-amber-700"
                    >
                      {retryingAI ? 'Generating…' : 'Generate Now'}
                    </button>
                  </div>
                )}

                {preVisit.suggestedQuestions && preVisit.suggestedQuestions.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">Suggested Questions for Your Doctor</p>
                    <ul className="space-y-1.5">
                      {preVisit.suggestedQuestions.map((q, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-primary-600 font-medium">{i + 1}.</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-2">
                  <p className="text-[11px] text-gray-500 italic bg-gray-50 border border-gray-200/80 rounded-lg p-2.5">
                    ℹ️ {preVisit.disclaimer || 'These preliminary steps are for supportive comfort before your appointment and do not replace professional medical evaluation or emergency care.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Post-visit Summary */}
        {postVisit && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">📋 Post-Visit Summary</h3>
            {postAIFailed ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">AI summary unavailable, please review manually.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {'summary' in postVisit && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Summary</p>
                    <p className="text-gray-800">{postVisit.summary}</p>
                  </div>
                )}
                {'medicationSchedule' in postVisit && postVisit.medicationSchedule!.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">💊 Medication Schedule</p>
                    <div className="space-y-2">
                      {postVisit.medicationSchedule!.map((med, i) => (
                        <div key={i} className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
                          <p className="font-medium text-blue-900">{med.medicine}</p>
                          <p className="text-blue-700">{med.dosage} · {med.frequency}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {'followUpSteps' in postVisit && postVisit.followUpSteps!.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Follow-up Steps</p>
                    <ul className="space-y-1">
                      {postVisit.followUpSteps!.map((step, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-green-600">✓</span> {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
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
