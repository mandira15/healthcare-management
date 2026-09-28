'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  doctor: { name: string; doctorProfile: { specialization: string } | null };
  preVisitSummary: { urgencyLevel?: string; error?: string } | null;
}

interface User { name: string; email: string; role: string }

export default function PatientDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/appointments').then(r => r.json()),
    ]).then(([me, appts]) => {
      if (!me.user) { router.push('/login'); return; }
      setUser(me.user);
      setAppointments(appts.appointments ?? []);
    }).finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (loading) return <LoadingSpinner />;

  const upcoming = appointments.filter(a => a.status === 'CONFIRMED' && a.date >= new Date().toISOString().slice(0, 10));
  const past = appointments.filter(a => a.status === 'COMPLETED');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar name={user?.name ?? ''} role="PATIENT" onLogout={handleLogout} />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="text-gray-500">Manage your appointments and health records</p>
        </div>

        {/* Calendar connect banner */}
        <div className="card mb-6 flex items-center justify-between bg-blue-50 border-blue-200">
          <div>
            <p className="font-medium text-blue-900">Connect Google Calendar</p>
            <p className="text-sm text-blue-700">Sync your appointments automatically</p>
          </div>
          <a href="/api/auth/google" className="btn-primary text-sm">Connect</a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Upcoming', value: upcoming.length, color: 'text-blue-600' },
            { label: 'Completed', value: past.length, color: 'text-green-600' },
            { label: 'Total', value: appointments.length, color: 'text-gray-600' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Link
            href="/patient/doctors/nearby"
            className="btn-primary bg-sky-600 hover:bg-sky-700 flex items-center gap-2 text-sm py-2.5 px-5 shadow-sm"
          >
            <span>📍</span>
            <span>Find Doctors Near Me</span>
          </Link>
          <Link href="/patient/book" className="btn-secondary text-sm py-2.5 px-5">
            + Book Appointment
          </Link>
        </div>

        {/* Upcoming */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Appointments</h2>
          {upcoming.length === 0
            ? <p className="text-gray-500 text-sm">No upcoming appointments. <Link href="/patient/book" className="text-primary-600 hover:underline">Book one now</Link></p>
            : <div className="space-y-3">
              {upcoming.map(a => <AppointmentCard key={a.id} appt={a} role="patient" />)}
            </div>
          }
        </section>

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Appointments</h2>
            <div className="space-y-3">
              {past.map(a => <AppointmentCard key={a.id} appt={a} role="patient" />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AppointmentCard({ appt, role }: { appt: Appointment; role: string }) {
  const urgency = (appt.preVisitSummary as { urgencyLevel?: string } | null)?.urgencyLevel;
  const urgencyColor = urgency === 'High' ? 'text-red-600' : urgency === 'Medium' ? 'text-yellow-600' : 'text-green-600';

  return (
    <Link href={`/patient/appointments/${appt.id}`}>
      <div className="card hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">Dr. {appt.doctor.name}</p>
          <p className="text-sm text-gray-500">{appt.doctor.doctorProfile?.specialization}</p>
          <p className="text-sm text-gray-600 mt-1">{appt.date} · {appt.startTime}–{appt.endTime}</p>
          {urgency && <p className={`text-xs font-medium mt-1 ${urgencyColor}`}>⚠ {urgency} urgency</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={appt.status} />
          <span className="text-xs text-primary-600">View →</span>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = {
    CONFIRMED: 'badge-confirmed',
    CANCELLED: 'badge-cancelled',
    COMPLETED: 'badge-completed',
    PENDING: 'badge-pending',
  }[status] ?? 'badge-pending';
  return <span className={cls}>{status}</span>;
}

function Navbar({ name, role, onLogout }: { name: string; role: string; onLogout: () => void }) {
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary-600 font-bold text-lg">Healthcare Manager</span>
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{role}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{name}</span>
          <button onClick={onLogout} className="text-sm text-red-600 hover:underline">Logout</button>
        </div>
      </div>
    </nav>
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
    </div>
  );
}
