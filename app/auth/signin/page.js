'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function SignInPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    affiliateCode: ''
  });
  const [message, setMessage] = useState('');

  async function handleSignup(event) {
    event.preventDefault();
    setMessage('שולח את הבקשה...');

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'שליחת הבקשה נכשלה.');
      }

      setMessage('הבקשה נשלחה בהצלחה. החשבון ממתין לאישור ידני משלמה.');
    } catch (error) {
      setMessage(error.message || 'שליחת הבקשה נכשלה.');
    }
  }

  return (
    <main className="mx-auto max-w-5xl">
      <section className="glass-panel grid gap-8 p-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/55">Welcome</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">כניסה והרשמה</h1>
          <p className="mt-4 text-sm leading-8 text-white/68">
            התחברות עם Google או פתיחת חשבון דרך טופס רגיל. כל חשבון חדש עובר למסך המתנה לאישור VIP, ושלמה
            מקבל התראה אוטומטית.
          </p>

          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950"
          >
            התחברות עם Google
          </button>
        </div>

        <form onSubmit={handleSignup} className="grid gap-4">
          {[
            ['name', 'שם מלא'],
            ['email', 'אימייל'],
            ['phone', 'טלפון לאימות'],
            ['company', 'שם העסק'],
            ['affiliateCode', 'קוד שותף (אופציונלי)']
          ].map(([key, label]) => (
            <label key={key} className="space-y-2">
              <span className="text-sm text-white/65">{label}</span>
              <input
                value={form[key]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                className="input-shell"
              />
            </label>
          ))}

          <button type="submit" className="mt-2 rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950">
            שלח הרשמה
          </button>

          {message ? (
            <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
              {message}
            </div>
          ) : null}
        </form>
      </section>
    </main>
  );
}
