import type { Metadata } from 'next';
import './globals.css';
import { initCronJobs } from '@/lib/cron';

// Initialize background cron jobs once when the Next.js server starts.
// This singleton import pattern works because Next.js evaluates
// server-side modules once per server process.
initCronJobs();

export const metadata: Metadata = {
  title: 'Healthcare Manager',
  description: 'Appointment & Follow-up Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
