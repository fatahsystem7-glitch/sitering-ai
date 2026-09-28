'use client';

import { useState } from 'react';
import { browserClient } from '@/lib/supabase';

/**
 * Contractor sign-up. Supabase Auth sends the confirmation email automatically
 * (Custom SMTP configured in the dashboard); the DB trigger creates the tenant,
 * ownership row and a default receptionist config.
 */
export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [trade, setTrade] = useState('plumber');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');

    const supabase = browserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        data: { business_name: businessName, trade },
      },
    });

    if (error) {
      setState('error');
      setMessage(error.message);
      return;
    }
    setState('sent');
    setMessage(`We've emailed a confirmation link to ${email}. Click it to activate your account.`);
  }

  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Create your sitering account</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Your AI receptionist, answering in minutes.</p>

      {state === 'sent' ? (
        <p style={{ padding: 16, background: '#ecfdf5', borderRadius: 8 }}>{message}</p>
      ) : (
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <input required placeholder="Business name" value={businessName}
                 onChange={(e) => setBusinessName(e.target.value)} style={input} />
          <select value={trade} onChange={(e) => setTrade(e.target.value)} style={input}>
            {['plumber', 'electrician', 'roofer', 'builder', 'heating engineer', 'other'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input required type="email" placeholder="Work email" value={email}
                 onChange={(e) => setEmail(e.target.value)} style={input} />
          <input required type="password" minLength={8} placeholder="Password (8+ characters)"
                 value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
          <button type="submit" disabled={state === 'sending'} style={button}>
            {state === 'sending' ? 'Creating account…' : 'Create account'}
          </button>
          {state === 'error' && <p style={{ color: '#b91c1c' }}>{message}</p>}
        </form>
      )}
    </main>
  );
}

const input: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 8, border: '1px solid #d4d4d8', fontSize: 15,
};
const button: React.CSSProperties = {
  padding: '11px 12px', borderRadius: 8, border: 0, background: '#111827',
  color: '#fff', fontSize: 15, cursor: 'pointer',
};
