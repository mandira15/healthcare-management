'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  SUPPORTED_SYMPTOMS,
  RED_FLAG_SYMPTOMS,
} from '@/lib/stomachHealth';

interface AnalysisResult {
  isRedFlag: boolean;
  prediction?: string;
  displayName?: string;
  description?: string;
  confidence?: number;
  confidencePercentage?: number;
  probabilities?: Record<string, number>;
  modelName?: string;
  matchedSymptoms?: string[];
  duration?: string;
  severity?: string;
  generalGuidance?: string[];
  whenToConsult?: string[];
  suggestedSpecialty?: string;
  disclaimer: string;
  // Red flag fields
  redFlagWarnings?: Array<{ id: string; label: string; warning: string }>;
  safetyNotice?: string;
  recommendedAction?: string;
}

export default function StomachHealthPage() {
  const router = useRouter();

  // Selected state
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedRedFlags, setSelectedRedFlags] = useState<string[]>([]);
  const [severity, setSeverity] = useState<string>('mild');
  const [duration, setDuration] = useState<string>('1-2 days');

  // Request state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceOffline, setServiceOffline] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // Toggle helpers
  function toggleSymptom(id: string) {
    setSelectedSymptoms(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  function toggleRedFlag(id: string) {
    setSelectedRedFlags(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  }

  // Handle Submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setServiceOffline(false);

    if (selectedSymptoms.length === 0 && selectedRedFlags.length === 0) {
      setError('Please select at least one symptom or warning sign to evaluate.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/stomach/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: selectedSymptoms,
          redFlags: selectedRedFlags,
          severity,
          duration,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 503 || data.serviceUnavailable) {
          setServiceOffline(true);
        }
        setError(data.error || 'Failed to complete analysis.');
        return;
      }

      setResult(data);
      // Smooth scroll to results
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      setError('Network communication failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSelectedSymptoms([]);
    setSelectedRedFlags([]);
    setResult(null);
    setError(null);
    setServiceOffline(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const upperGiSymptoms = SUPPORTED_SYMPTOMS.filter(s => s.category === 'upper_gi');
  const lowerGiSymptoms = SUPPORTED_SYMPTOMS.filter(s => s.category === 'lower_gi');
  const systemicSymptoms = SUPPORTED_SYMPTOMS.filter(s => s.category === 'systemic');

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/patient/dashboard"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🩺</span>
            <span className="text-sm font-bold text-gray-900">Stomach Health Assistant</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Mandatory Medical Disclaimer Banner */}
        <div className="p-4 mb-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="font-semibold">Important Medical Notice</p>
              <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                This tool provides general health information and triage triage guidance using a trained Machine Learning model. It is <strong>NOT a medical diagnosis</strong>. Please consult a qualified healthcare professional for medical diagnosis and clinical treatment.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Digestive Health & Symptom Evaluator
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Select your experienced symptoms below to receive an ML-based evaluation, confidence score, and self-care recommendations.
          </p>
        </div>

        {/* Symptom Input Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Red Flag Warning Checklist */}
          <div className="card border-red-200 bg-red-50/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-600 text-base font-bold">🚨 Critical Safety Check (Red Flags)</span>
            </div>
            <p className="text-xs text-red-700 mb-4">
              Check any of the following if present. Red flags trigger an emergency safety warning instead of standard model triage.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {RED_FLAG_SYMPTOMS.map(rf => {
                const checked = selectedRedFlags.includes(rf.id);
                return (
                  <label
                    key={rf.id}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      checked
                        ? 'bg-red-100 border-red-400 text-red-950 font-medium'
                        : 'bg-white border-red-100 text-gray-700 hover:border-red-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRedFlag(rf.id)}
                      className="mt-0.5 rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    <span>{rf.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 2: Structured Symptoms Selector */}
          <div className="card">
            <h2 className="text-base font-bold text-gray-900 mb-1">Select Your Symptoms</h2>
            <p className="text-xs text-gray-500 mb-4">
              Select all symptoms you have been experiencing in the stomach or digestive tract.
            </p>

            {/* Upper GI */}
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                Upper Digestive (Stomach, Esophagus)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {upperGiSymptoms.map(sym => {
                  const checked = selectedSymptoms.includes(sym.id);
                  return (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => toggleSymptom(sym.id)}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all flex items-start gap-2 ${
                        checked
                          ? 'bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-400 font-medium'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`text-sm ${checked ? 'text-amber-600' : 'text-gray-400'}`}>
                        {checked ? '☑' : '☐'}
                      </span>
                      <div>
                        <div className="font-medium">{sym.label}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{sym.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lower GI */}
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                Lower Digestive & Intestines
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {lowerGiSymptoms.map(sym => {
                  const checked = selectedSymptoms.includes(sym.id);
                  return (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => toggleSymptom(sym.id)}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all flex items-start gap-2 ${
                        checked
                          ? 'bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-400 font-medium'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`text-sm ${checked ? 'text-amber-600' : 'text-gray-400'}`}>
                        {checked ? '☑' : '☐'}
                      </span>
                      <div>
                        <div className="font-medium">{sym.label}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{sym.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Systemic */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                Systemic & General Signs
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {systemicSymptoms.map(sym => {
                  const checked = selectedSymptoms.includes(sym.id);
                  return (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => toggleSymptom(sym.id)}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all flex items-start gap-2 ${
                        checked
                          ? 'bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-400 font-medium'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`text-sm ${checked ? 'text-amber-600' : 'text-gray-400'}`}>
                        {checked ? '☑' : '☐'}
                      </span>
                      <div>
                        <div className="font-medium">{sym.label}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{sym.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Duration and Severity */}
          <div className="card grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                How long have you had these symptoms?
              </label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full text-sm border-gray-300 rounded-lg shadow-xs focus:ring-amber-500 focus:border-amber-500 py-2 px-3 bg-white border"
              >
                <option value="Less than 24 hours">Less than 24 hours</option>
                <option value="1-2 days">1 - 2 days</option>
                <option value="3-5 days">3 - 5 days</option>
                <option value="1-2 weeks">1 - 2 weeks</option>
                <option value="More than 2 weeks">More than 2 weeks (Chronic)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Current Discomfort Severity
              </label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value)}
                className="w-full text-sm border-gray-300 rounded-lg shadow-xs focus:ring-amber-500 focus:border-amber-500 py-2 px-3 bg-white border"
              >
                <option value="mild">Mild (Noticeable but does not interrupt activities)</option>
                <option value="moderate">Moderate (Interferes with normal daily routine)</option>
                <option value="severe">Severe (Intense, debilitating discomfort)</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
              <span>{error}</span>
              {serviceOffline && (
                <span className="text-[11px] font-mono text-red-600 bg-red-100 px-2 py-0.5 rounded ml-2">
                  Check: python app.py
                </span>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm py-2.5 px-6 shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="animate-spin text-base">⟳</span>
                  <span>Evaluating with ML Model...</span>
                </>
              ) : (
                <>
                  <span>🩺</span>
                  <span>Analyze Symptoms</span>
                </>
              )}
            </button>

            {(selectedSymptoms.length > 0 || selectedRedFlags.length > 0 || result) && (
              <button
                type="button"
                onClick={handleReset}
                className="btn-secondary text-sm py-2 px-4"
              >
                Clear / Reset
              </button>
            )}
          </div>
        </form>

        {/* ─────────────────────────────────────────────
            ANALYSIS RESULT DISPLAY
        ───────────────────────────────────────────── */}
        {result && (
          <div className="mt-10 space-y-6 animate-fadeIn">
            {/* If Red Flag is Triggered */}
            {result.isRedFlag ? (
              <div className="card border-2 border-red-500 bg-red-50 shadow-md">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center text-2xl shrink-0">
                    ⚠️
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-red-900">
                      Seek Immediate Medical Evaluation
                    </h2>
                    <p className="text-sm text-red-800 mt-1 font-medium">
                      {result.safetyNotice}
                    </p>

                    {/* Identified Red Flags */}
                    <div className="mt-4 p-3 bg-white rounded-lg border border-red-200">
                      <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider mb-2">
                        Flagged Warning Symptoms:
                      </h4>
                      <ul className="space-y-1.5 text-xs text-red-800">
                        {result.redFlagWarnings?.map(rf => (
                          <li key={rf.id} className="flex items-start gap-2">
                            <span className="text-red-500 font-bold">•</span>
                            <div>
                              <span className="font-semibold">{rf.label}:</span>{' '}
                              <span>{rf.warning}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href="/patient/doctors/nearby?specialty=Gastroenterologist"
                        className="btn-primary bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-4"
                      >
                        Find Emergency / Urgent Gastroenterologist
                      </Link>
                      <a
                        href="tel:112"
                        className="btn-secondary text-sm py-2 px-4 border-red-300 text-red-700 bg-white hover:bg-red-50"
                      >
                        Call Emergency Services (112)
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Regular ML Prediction Card */
              <div className="card border border-amber-200 bg-white shadow-sm overflow-hidden">
                {/* Result Header */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 p-5 -m-6 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                        Machine Learning Triage Result
                      </span>
                      <h2 className="text-2xl font-extrabold text-gray-900 mt-0.5">
                        {result.displayName}
                      </h2>
                    </div>
                    <div className="text-right sm:self-center">
                      <div className="text-xs text-gray-500">Model Confidence</div>
                      <div className="text-2xl font-black text-amber-600">
                        {result.confidencePercentage}%
                      </div>
                    </div>
                  </div>

                  {/* Confidence progress bar */}
                  <div className="w-full bg-amber-100 h-2.5 rounded-full mt-3 overflow-hidden">
                    <div
                      className="bg-amber-600 h-full rounded-full transition-all duration-700"
                      style={{ width: `${result.confidencePercentage}%` }}
                    />
                  </div>
                </div>

                {/* Condition Description */}
                <div className="mb-6">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {result.description}
                  </p>
                </div>

                {/* Evaluated Symptoms */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Evaluated Symptoms ({result.matchedSymptoms?.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.matchedSymptoms?.map((sym, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-full font-medium"
                      >
                        ✓ {sym}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Other Probabilities / Distribution */}
                {result.probabilities && (
                  <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                      Differential Probability Distribution (Model: {result.modelName})
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(result.probabilities).map(([cond, prob]) => {
                        const pct = Math.round(prob * 100);
                        const isTop = cond === result.prediction;
                        return (
                          <div key={cond} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className={isTop ? 'font-bold text-amber-900' : 'text-gray-600'}>
                                {cond} {isTop && '(Predicted Match)'}
                              </span>
                              <span className={isTop ? 'font-bold text-amber-900' : 'text-gray-500'}>
                                {pct}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isTop ? 'bg-amber-500' : 'bg-gray-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* General Guidance */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>General Self-Care & Lifestyle Guidance</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-gray-600 bg-emerald-50/60 border border-emerald-100 p-4 rounded-xl">
                    {result.generalGuidance?.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* When to Consult */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <span>🩺</span>
                    <span>When to Consult a Physician</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-gray-600 bg-sky-50/60 border border-sky-100 p-4 rounded-xl">
                    {result.whenToConsult?.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-sky-600 font-bold">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Connect with Doctor Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-teal-800 font-semibold uppercase tracking-wider">
                      Suggested Medical Specialty
                    </div>
                    <div className="text-base font-bold text-gray-900 mt-0.5">
                      Consult a {result.suggestedSpecialty}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Find verified doctors nearby to discuss your symptoms and get an accurate clinical evaluation.
                    </p>
                  </div>
                  <Link
                    href={`/patient/doctors/nearby?specialty=${encodeURIComponent(
                      result.suggestedSpecialty || 'Gastroenterologist'
                    )}&concern=${encodeURIComponent(result.displayName || 'Stomach concern')}`}
                    className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-4 whitespace-nowrap self-stretch sm:self-auto text-center"
                  >
                    Find Recommended Doctor →
                  </Link>
                </div>

                {/* Disclaimer Footnote */}
                <div className="mt-6 pt-4 border-t border-gray-100 text-[11px] text-gray-400 text-center">
                  {result.disclaimer}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
