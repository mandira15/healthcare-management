'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User { id: string; name: string; email: string; role: string; calendarConnected: boolean; createdAt: string; doctorProfile?: { specialization: string } | null }
interface Appointment { id: string; date: string; status: string; patient: { name: string }; doctor: { name: string } }
interface Stats { totalUsers: number; totalDoctors: number; totalPatients: number; totalAppointments: number; confirmedAppointments: number }

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'appointments'>('overview');

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/appointments').then(r => r.json()),
    ]).then(([me, usersData, apptData]) => {
      if (!me.user || me.user.role !== 'ADMIN') { router.push('/login'); return; }
      setUser(me.user);
      setUsers(usersData.users ?? []);
      setAppointments(apptData.appointments ?? []);
    }).finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (loading) return <Spinner />;

  const stats: Stats = {
    totalUsers: users.length,
    totalDoctors: users.filter(u => u.role === 'DOCTOR').length,
    totalPatients: users.filter(u => u.role === 'PATIENT').length,
    totalAppointments: appointments.length,
    confirmedAppointments: appointments.filter(a => a.status === 'CONFIRMED').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary-600 font-bold text-lg">Healthcare Manager</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">ADMIN</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/doctors" className="text-sm text-primary-600 hover:underline">Doctors</Link>
            <Link href="/admin/email-logs" className="text-sm text-primary-600 hover:underline">Email Logs</Link>
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">System overview and management</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Users', value: stats.totalUsers, color: 'text-gray-700' },
            { label: 'Doctors', value: stats.totalDoctors, color: 'text-blue-600' },
            { label: 'Patients', value: stats.totalPatients, color: 'text-green-600' },
            { label: 'Appointments', value: stats.totalAppointments, color: 'text-purple-600' },
            { label: 'Confirmed', value: stats.confirmedAppointments, color: 'text-primary-600' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['overview', 'users', 'appointments'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {activeTab === 'users' && (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Name', 'Email', 'Role', 'Calendar', 'Joined'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'DOCTOR' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">{u.calendarConnected ? '✓' : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Appointments tab */}
        {activeTab === 'appointments' && (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Patient', 'Doctor', 'Date', 'Time', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {appointments.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{a.patient?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{(a as unknown as { doctor: { name: string } }).doctor?.name ?? '—'}</td>
                      <td className="px-4 py-3">{a.date}</td>
                      <td className="px-4 py-3 text-gray-500">{(a as unknown as { startTime: string }).startTime}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          a.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                          a.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                          a.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold mb-3">Quick Links</h3>
              <div className="space-y-2">
                <Link href="/admin/doctors" className="flex items-center gap-2 text-sm text-primary-600 hover:underline">→ Manage Doctors</Link>
                <Link href="/admin/email-logs" className="flex items-center gap-2 text-sm text-primary-600 hover:underline">→ Email Retry Queue</Link>
              </div>
            </div>
            <div className="card">
              <h3 className="font-semibold mb-3">System Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Email cron</span><span className="text-green-600">● every 2 min</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Reminder cron</span><span className="text-green-600">● every 5 min</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Database</span><span className="text-green-600">● SQLite</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" /></div>;
}
