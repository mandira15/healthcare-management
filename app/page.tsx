import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-white p-6">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-6">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Healthcare Manager</h1>
        <p className="text-xl text-gray-600 mb-8">
          Smart appointment scheduling with AI-powered summaries,
          real-time slot availability, and automated follow-up reminders.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login" className="btn-primary text-center px-8 py-3 text-base">
            Sign In
          </Link>
          <Link href="/register" className="btn-secondary text-center px-8 py-3 text-base">
            Create Account
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-3 gap-6 text-left">
          {[
            { icon: '🩺', title: 'For Patients', desc: 'Book appointments, view AI summaries, get medication reminders' },
            { icon: '👨‍⚕️', title: 'For Doctors', desc: 'Manage schedule, enter clinical notes, auto-generate prescriptions' },
            { icon: '🏥', title: 'For Admins', desc: 'Oversee all users, monitor email queue, manage doctors' },
          ].map((f) => (
            <div key={f.title} className="card text-center">
              <div className="text-3xl mb-2">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
