'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Doctor {
  id: string;
  name: string;
  email: string;
  calendarConnected: boolean;
  createdAt: string;
  doctorProfile?: { specialization: string; slotDurationMinutes: number } | null;
}

export default function AdminDoctorsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    specialization: '',
    slotDurationMinutes: 30,
    clinicName: '',
    clinicAddress: '',
    city: '',
    latitude: '',
    longitude: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadDoctors() {
    const res = await fetch('/api/admin/users?role=DOCTOR');
    const data = await res.json();
    if (res.status === 401 || res.status === 403) { router.push('/login'); return; }
    setDoctors(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => { loadDoctors(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');

    const payload: any = {
      name: form.name,
      email: form.email,
      password: form.password,
      specialization: form.specialization,
      slotDurationMinutes: form.slotDurationMinutes,
      clinicName: form.clinicName || undefined,
      clinicAddress: form.clinicAddress || undefined,
      city: form.city || undefined,
    };

    if (form.latitude && !isNaN(Number(form.latitude))) {
      payload.latitude = Number(form.latitude);
    }
    if (form.longitude && !isNaN(Number(form.longitude))) {
      payload.longitude = Number(form.longitude);
    }

    const res = await fetch('/api/doctors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Failed to create doctor'); }
    else {
      setSuccess(`Dr. ${form.name} created successfully`);
      setForm({
        name: '',
        email: '',
        password: '',
        specialization: '',
        slotDurationMinutes: 30,
        clinicName: '',
        clinicAddress: '',
        city: '',
        latitude: '',
        longitude: '',
      });
      setShowForm(false);
      await loadDoctors();
    }
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/admin/dashboard" className="text-primary-600 hover:underline text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold">Manage Doctors</h1>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Doctors ({doctors.length})</h2>
            <p className="text-sm text-gray-500">Create and manage doctor accounts & locations</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Cancel' : '+ Add Doctor'}
          </button>
        </div>

        {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">✓ {success}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

        {/* Create doctor form */}
        {showForm && (
          <div className="card mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">New Doctor Account</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'name', label: 'Full Name', type: 'text', required: true },
                { key: 'email', label: 'Email', type: 'email', required: true },
                { key: 'password', label: 'Password (min 8 chars)', type: 'password', required: true },
                { key: 'specialization', label: 'Specialization', type: 'text', required: true },
                { key: 'clinicName', label: 'Clinic / Hospital Name', type: 'text', required: false },
                { key: 'clinicAddress', label: 'Address', type: 'text', required: false },
                { key: 'city', label: 'City', type: 'text', required: false },
                { key: 'latitude', label: 'Latitude (e.g. 23.23)', type: 'number', required: false, step: 'any' },
                { key: 'longitude', label: 'Longitude (e.g. 77.43)', type: 'number', required: false, step: 'any' },
              ].map(({ key, label, type, required, step }: any) => (
                <div key={key}>
                  <label className="label text-xs">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type={type}
                    required={required}
                    step={step}
                    className="input text-xs"
                    value={(form as any)[key] ?? ''}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <label className="label text-xs">Slot Duration (min)</label>
                <select className="input text-xs" value={form.slotDurationMinutes}
                  onChange={e => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })}>
                  {[15, 20, 30, 45, 60].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? 'Creating…' : 'Create Doctor'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Doctor list */}
        {loading ? <p className="text-gray-500 text-sm">Loading…</p> : (
          <div className="space-y-3">
            {doctors.map(doc => (
              <div key={doc.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Dr. {doc.name}</p>
                  <p className="text-sm text-gray-500">{doc.email}</p>
                  <p className="text-sm text-gray-600">{doc.doctorProfile?.specialization} · {doc.doctorProfile?.slotDurationMinutes}min slots</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">DOCTOR</span>
                  {doc.calendarConnected && <span className="text-xs text-green-600">📅 Calendar</span>}
                  <span className="text-xs text-gray-400">Since {new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {doctors.length === 0 && <p className="text-gray-400 text-sm">No doctors yet. Create one above.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
