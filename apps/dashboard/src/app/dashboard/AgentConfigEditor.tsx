'use client';

import { useState } from 'react';
import { ui } from '@/lib/ui';

export default function AgentConfigEditor({ config }: { config: any }) {
  const [form, setForm] = useState({
    display_name: config.display_name ?? '',
    greeting: config.greeting ?? '',
    system_prompt: config.system_prompt ?? '',
    voice_id: config.voice_id ?? '',
    escalation_number: config.escalation_number ?? '',
    temperature: config.temperature ?? 0.5,
    is_active: config.is_active ?? true,
  });
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const set = (k: string) => (e: any) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));

  async function save() {
    setState('saving');
    const res = await fetch('/api/agent-config', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: config.id, ...form, temperature: Number(form.temperature) }),
    });
    if (res.ok) {
      setState('saved');
      setMessage('Saved — live on your next incoming call.');
      setTimeout(() => setState('idle'), 3000);
    } else {
      const body = await res.json().catch(() => ({}));
      setState('error');
      setMessage(body.error ?? 'Could not save.');
    }
  }

  return (
    <div style={ui.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Receptionist settings</h2>
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
          Active
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={ui.label}>Receptionist name</label>
        <input style={ui.input} value={form.display_name} onChange={set('display_name')} />
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={ui.label}>Greeting</label>
        <input style={ui.input} value={form.greeting} onChange={set('greeting')} />
        <p style={ui.hint}>The first thing every caller hears.</p>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={ui.label}>Instructions</label>
        <textarea
          rows={9}
          style={{ ...ui.input, resize: 'vertical', lineHeight: 1.5 }}
          value={form.system_prompt}
          onChange={set('system_prompt')}
        />
        <p style={ui.hint}>
          Tell it how to handle your calls — what to ask, what to never promise, when to
          take a message. Changes apply to the next call, no restart needed.
        </p>
      </div>

      <div style={{ ...ui.row, marginTop: 14 }}>
        <div>
          <label style={ui.label}>Transfer number</label>
          <input
            style={ui.input}
            placeholder="+447700900123"
            value={form.escalation_number}
            onChange={set('escalation_number')}
          />
          <p style={ui.hint}>Emergencies get put through here.</p>
        </div>
        <div>
          <label style={ui.label}>Fish Audio voice ID</label>
          <input style={ui.input} value={form.voice_id} onChange={set('voice_id')} />
          <p style={ui.hint}>Paste any voice ID from your Fish Audio library.</p>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={ui.label}>Creativity — {Number(form.temperature).toFixed(2)}</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={form.temperature}
          onChange={set('temperature')}
          style={{ width: '100%' }}
        />
        <p style={ui.hint}>Lower is more predictable and on-script. 0.5 suits most trades.</p>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={save} disabled={state === 'saving'} style={ui.button}>
          {state === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {state !== 'idle' && state !== 'saving' && (
          <span style={{ fontSize: 13, color: state === 'error' ? '#991b1b' : '#065f46' }}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
