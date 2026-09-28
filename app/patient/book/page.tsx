'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Doctor {
  id: string;
  name: string;
  doctorProfile: {
    specialization: string;
    slotDurationMinutes: number;
    workingHours: string;
    bio?: string;
    clinicName?: string;
  } | null;
}

interface Slot {
  startTime: string;
  endTime: string;
  available: boolean;
}

type Step = 'doctor' | 'slot' | 'symptoms' | 'confirm';

function BookContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDoctorId = searchParams.get('doctorId');

  const [step, setStep] = useState<Step>('doctor');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [slotError, setSlotError] = useState('');

  useEffect(() => {
    fetch('/api/doctors')
      .then((r) => r.json())
      .then((d) => {
        const docList = d.doctors ?? [];
        setDoctors(docList);
        if (preselectedDoctorId) {
          const match = docList.find((doc: Doctor) => doc.id === preselectedDoctorId);
          if (match) {
            setSelectedDoctor(match);
            setStep('slot');
          }
        }
      });
  }, [preselectedDoctorId]);

  async function loadSlots(doctorId: string, date: string) {
    if (!date) return;
    setSlotsLoading(true);
    setSlotError('');
    try {
      const res = await fetch(`/api/doctors/${doctorId}/slots?date=${date}`);
      const data = await res.json();
      if (data.onLeave) { setSlotError('Doctor is on leave this day. Please choose another date.'); setSlots([]); return; }
      if (data.offDay) { setSlotError('Doctor does not work this day.'); setSlots([]); return; }
      setSlots(data.slots ?? []);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleBook() {
    if (!selectedDoctor || !selectedSlot) return;
    setBooking(true);
    setError('');
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          date: selectedDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          symptomText: symptoms || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Booking failed'); return; }
      router.push(`/patient/appointments/${data.appointment.id}`);
    } finally {
      setBooking(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/patient/dashboard" className="text-primary-600 hover:underline text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Book Appointment</h1>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Stepper */}
        <div className="flex items-center mb-8">
          {(['doctor', 'slot', 'symptoms', 'confirm'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === s ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i + 1}
              </div>
              <span className="ml-2 text-sm capitalize hidden sm:inline">{s}</span>
              {i < 3 && <div className="h-0.5 w-8 bg-gray-200 mx-2" />}
            </div>
          ))}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

        {/* Step 1: Choose Doctor */}
        {step === 'doctor' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Choose a Doctor</h2>
            <div className="space-y-3">
              {doctors.map(doc => (
                <div key={doc.id}
                  onClick={() => { setSelectedDoctor(doc); setStep('slot'); }}
                  className="card cursor-pointer hover:shadow-md hover:border-primary-300 transition-all flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Dr. {doc.name}</p>
                    <p className="text-sm text-gray-500">{doc.doctorProfile?.specialization}</p>
                    {doc.doctorProfile?.clinicName && <p className="text-xs text-gray-400">{doc.doctorProfile.clinicName}</p>}
                  </div>
                  <span className="text-primary-600 text-sm">Select →</span>
                </div>
              ))}
              {doctors.length === 0 && <p className="text-gray-500 text-sm">No doctors available</p>}
            </div>
          </div>
        )}

        {/* Step 2: Choose Slot */}
        {step === 'slot' && selectedDoctor && (
          <div>
            <h2 className="text-xl font-semibold mb-1">Choose Date & Time</h2>
            <p className="text-gray-500 text-sm mb-4">Dr. {selectedDoctor.name} · {selectedDoctor.doctorProfile?.specialization}</p>
            <div className="mb-4">
              <label className="label">Date</label>
              <input type="date" className="input" min={today}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot(null);
                  loadSlots(selectedDoctor.id, e.target.value);
                }}
              />
            </div>
            {slotError && <p className="text-red-600 text-sm mb-3">{slotError}</p>}
            {slotsLoading && <p className="text-gray-500 text-sm">Loading slots…</p>}
            {slots.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
                {slots.map(slot => (
                  <button key={slot.startTime}
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all
                      ${!slot.available ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-100' :
                        selectedSlot?.startTime === slot.startTime ? 'bg-primary-600 text-white border-primary-600' :
                        'bg-white text-gray-700 border-gray-200 hover:border-primary-400'}`}>
                    {slot.startTime}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep('doctor')} className="btn-secondary">← Back</button>
              <button disabled={!selectedSlot} onClick={() => setStep('symptoms')} className="btn-primary">Continue</button>
            </div>
          </div>
        )}

        {/* Step 3: Symptoms */}
        {step === 'symptoms' && (
          <div>
            <h2 className="text-xl font-semibold mb-1">Describe Your Symptoms</h2>
            <p className="text-gray-500 text-sm mb-4">Our AI will generate a pre-visit summary to help your doctor prepare.</p>
            <textarea
              className="input min-h-[120px] resize-none mb-4"
              placeholder="Describe your symptoms, how long you've had them, any relevant medical history…"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setStep('slot')} className="btn-secondary">← Back</button>
              <button onClick={() => setStep('confirm')} className="btn-primary">Continue</button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && selectedDoctor && selectedSlot && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Confirm Booking</h2>
            <div className="card mb-6">
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Doctor', value: `Dr. ${selectedDoctor.name}` },
                  { label: 'Specialization', value: selectedDoctor.doctorProfile?.specialization },
                  { label: 'Date', value: selectedDate },
                  { label: 'Time', value: `${selectedSlot.startTime} – ${selectedSlot.endTime}` },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-gray-500">{r.label}</span>
                    <span className="font-medium text-gray-900">{r.value}</span>
                  </div>
                ))}
                {symptoms && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-gray-500 mb-1">Symptoms</p>
                    <p className="text-gray-700">{symptoms}</p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              ✓ A confirmation email will be sent. {symptoms && '✓ AI pre-visit summary will be generated.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep('symptoms')} className="btn-secondary">← Back</button>
              <button onClick={handleBook} disabled={booking} className="btn-primary">
                {booking ? 'Booking…' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
        </div>
      }
    >
      <BookContent />
    </Suspense>
  );
}
