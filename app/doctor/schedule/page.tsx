'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DoctorProfile {
  specialization: string;
  slotDurationMinutes: number;
  workingHours: string;
  leaveDates: string;
  bio?: string;
  clinicName?: string;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export default function DoctorSchedulePage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [workingHours, setWorkingHours] = useState<Record<string, { start: string; end: string }>>({});
  const [leaveDates, setLeaveDates] = useState<string[]>([]);
  const [newLeave, setNewLeave] = useState('');
  const [slotDuration, setSlotDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [addingLeave, setAddingLeave] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.user || data.user.role !== 'DOCTOR') { router.push('/login'); return; }
      setUserId(data.user.userId);
      return fetch(`/api/doctors/${data.user.userId}`).then(r => r.json()).then(d => {
        const p = d.doctor?.doctorProfile;
        if (!p) return;
        setProfile(p);
        setWorkingHours(JSON.parse(p.workingHours || '{}'));
        setLeaveDates(JSON.parse(p.leaveDates || '[]'));
        setSlotDuration(p.slotDurationMinutes ?? 30);
      });
    });
  }, [router]);

  function toggleDay(day: string) {
    setWorkingHours(prev => {
      const next = { ...prev };
      if (next[day]) delete next[day];
      else next[day] = { start: '09:00', end: '17:00' };
      return next;
    });
  }

  function updateDayTime(day: string, field: 'start' | 'end', value: string) {
    setWorkingHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  async function handleSaveSchedule() {
    setSaving(true);
    setSaved(false);
    setError('');
    const res = await fetch(`/api/doctors/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingHours, slotDurationMinutes: slotDuration }),
    });
    if (res.ok) setSaved(true);
    else setError('Failed to save');
    setSaving(false);
  }

  async function handleAddLeave() {
    if (!newLeave) return;
    setAddingLeave(true);
    const res = await fetch(`/api/doctors/${userId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newLeave }),
    });
    const data = await res.json();
    if (res.ok) {
      setLeaveDates(prev => [...prev, newLeave]);
      setNewLeave('');
      if (data.cancelledCount > 0) {
        alert(`Leave added. ${data.cancelledCount} appointment(s) were automatically cancelled and patients notified.`);
      }
    }
    setAddingLeave(false);
  }

  async function handleRemoveLeave(date: string) {
    await fetch(`/api/doctors/${userId}/leave?date=${date}`, { method: 'DELETE' });
    setLeaveDates(prev => prev.filter(d => d !== date));
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/doctor/dashboard" className="text-primary-600 hover:underline text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold">Manage Schedule</h1>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Slot duration */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Appointment Duration</h2>
          <div className="flex items-center gap-4">
            <label className="label w-auto mb-0">Slot duration (minutes)</label>
            <select className="input w-32" value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))}>
              {[15, 20, 30, 45, 60].map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
        </div>

        {/* Working hours */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Working Hours</h2>
          <div className="space-y-3">
            {DAYS.map(day => (
              <div key={day} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-32">
                  <input type="checkbox" id={day} checked={!!workingHours[day]}
                    onChange={() => toggleDay(day)} className="rounded" />
                  <label htmlFor={day} className="text-sm font-medium text-gray-700">{DAY_LABELS[day]}</label>
                </div>
                {workingHours[day] && (
                  <div className="flex items-center gap-2">
                    <input type="time" className="input w-32" value={workingHours[day].start}
                      onChange={e => updateDayTime(day, 'start', e.target.value)} />
                    <span className="text-gray-500 text-sm">to</span>
                    <input type="time" className="input w-32" value={workingHours[day].end}
                      onChange={e => updateDayTime(day, 'end', e.target.value)} />
                  </div>
                )}
              </div>
            ))}
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          {saved && <p className="text-green-600 text-sm mt-2">✓ Schedule saved</p>}
          <div className="mt-4">
            <button onClick={handleSaveSchedule} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>
        </div>

        {/* Leave dates */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-1">Leave Dates</h2>
          <p className="text-sm text-gray-500 mb-4">Adding a leave date will automatically cancel any existing appointments on that day and notify patients.</p>
          <div className="flex gap-2 mb-4">
            <input type="date" className="input" min={today} value={newLeave} onChange={e => setNewLeave(e.target.value)} />
            <button onClick={handleAddLeave} disabled={addingLeave || !newLeave} className="btn-primary whitespace-nowrap">
              {addingLeave ? 'Adding…' : '+ Add Leave'}
            </button>
          </div>
          {leaveDates.length === 0
            ? <p className="text-sm text-gray-400">No leave dates set</p>
            : (
              <div className="flex flex-wrap gap-2">
                {leaveDates.sort().map(d => (
                  <div key={d} className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-3 py-1 text-sm">
                    <span className="text-red-700">{d}</span>
                    <button onClick={() => handleRemoveLeave(d)} className="text-red-400 hover:text-red-600 ml-1">✕</button>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
