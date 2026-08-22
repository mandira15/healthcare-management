'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  attempts: number;
  nextRetryAt: string;
  appointmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminEmailLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    const url = statusFilter ? `/api/admin/email-logs?status=${statusFilter}` : '/api/admin/email-logs';
    const res = await fetch(url);
    const data = await res.json();
    if (res.status === 401 || res.status === 403) { router.push('/login'); return; }
    setLogs(data.logs ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { loadLogs(); }, [statusFilter]);

  async function handleRetry(id: string) {
    setRetrying(id);
    await fetch('/api/admin/email-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadLogs();
    setRetrying(null);
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    SENT: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    PERMANENTLY_FAILED: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/admin/dashboard" className="text-primary-600 hover:underline text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold">Email Retry Queue</h1>
          <span className="text-sm text-gray-500">({total} total)</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Info banner */}
        <div className="card mb-6 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Email Retry System:</strong> Cron runs every 2 min · Backoff: 1→5→15 min · After 3 attempts → PERMANENTLY_FAILED.
            Use the Retry button to reset a permanently failed email.
          </p>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {['', 'PENDING', 'SENT', 'FAILED', 'PERMANENTLY_FAILED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>

        {loading ? <p className="text-gray-500 text-sm">Loading…</p> : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Recipient', 'Subject', 'Status', 'Attempts', 'Next Retry', 'Created', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No emails found</td></tr>
                  )}
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{log.recipient}</td>
                      <td className="px-4 py-3 max-w-xs truncate" title={log.subject}>{log.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[log.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{log.attempts} / 3</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {log.status === 'SENT' ? '—' : new Date(log.nextRetryAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {log.status === 'PERMANENTLY_FAILED' && (
                          <button onClick={() => handleRetry(log.id)} disabled={retrying === log.id}
                            className="text-xs btn-primary py-1 px-2">
                            {retrying === log.id ? '…' : 'Retry'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
