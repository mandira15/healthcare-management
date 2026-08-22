'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  symptomText?: string;
  patient: { name: string; email: string };
}

export default function DoctorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'upcoming' | 'all'>('today');

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/appointments').then(r => r.json()),
    ]).then(([me, appts]) => {
      if (!me.user || me.user.role !== 'DOCTOR') { router.push('/login'); return; }
      setUser(me.user);
      setAppointments(appts.appointments ?? []);
    }).finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (loading) return <Spinner />;

  const today = new Date().toISOString().slice(0, 10);
  const filtered = appointments.filter(a => {
    if (a.status === 'CANCELLED') return false;
    if (filter === 'today') return a.date === today;
    if (filter === 'upcoming') return a.date > today;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary-600 font-bold text-lg">Healthcare Manager</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">DOCTOR</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/doctor/schedule" className="text-sm text-primary-600 hover:underline">Schedule</Link>
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Doctor Dashboard</h1>
          <p className="text-gray-500">Welcome back, Dr. {user?.name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Today's", count: appointments.filter(a => a.date === today && a.status !== 'CANCELLED').length },
            { label: 'Upcoming', count: appointments.filter(a => a.date > today && a.status !== 'CANCELLED').length },
            { label: 'Completed', count: appointments.filter(a => a.status === 'COMPLETED').length },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className="text-3xl font-bold text-primary-600">{s.count}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label} Appointments</div>
            </div>
          ))}
        </div>

        {/* Calendar connect */}
        <div className="card mb-6 bg-blue-50 border-blue-200 flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-900">Connect Google Calendar</p>
            <p className="text-sm text-blue-700">Sync appointments to your calendar</p>
          </div>
          <a href="/api/auth/google" className="btn-primary text-sm">Connect</a>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {(['today', 'upcoming', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${filter === f ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Appointments list */}
        <div className="space-y-3">
          {filtered.length === 0
            ? <p className="text-gray-500 text-sm py-4">No appointments for this filter</p>
            : filtered.map(appt => (
              <Link key={appt.id} href={`/doctor/appointments/${appt.id}`}>
                <div className="card hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{appt.patient.name}</p>
                      <p className="text-sm text-gray-500">{appt.patient.email}</p>
                      <p className="text-sm text-gray-600 mt-1">{appt.date} · {appt.startTime}–{appt.endTime}</p>
                      {appt.symptomText && (
                        <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">Symptoms: {appt.symptomText}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={appt.status === 'CONFIRMED' ? 'badge-confirmed' : appt.status === 'COMPLETED' ? 'badge-completed' : 'badge-pending'}>
                        {appt.status}
                      </span>
                      <span className="text-xs text-primary-600">Open →</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          }
        </div>
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
