import type { CSSProperties } from 'react';

export const ui = {
  page: {
    maxWidth: 780,
    margin: '3rem auto',
    padding: '0 20px',
    fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
    color: '#111827',
  } as CSSProperties,
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 18,
  } as CSSProperties,
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 5,
    color: '#374151',
  } as CSSProperties,
  input: {
    width: '100%',
    padding: '9px 11px',
    borderRadius: 8,
    border: '1px solid #d4d4d8',
    fontSize: 14,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  } as CSSProperties,
  button: {
    padding: '10px 16px',
    borderRadius: 8,
    border: 0,
    background: '#111827',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  } as CSSProperties,
  ghostButton: {
    padding: '9px 14px',
    borderRadius: 8,
    border: '1px solid #d4d4d8',
    background: '#fff',
    fontSize: 14,
    cursor: 'pointer',
  } as CSSProperties,
  hint: { fontSize: 12.5, color: '#6b7280', marginTop: 4 } as CSSProperties,
  row: { display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' } as CSSProperties,
};

/** Colour-coded pill for bundle / tenant status. */
export function statusTone(status?: string | null): CSSProperties {
  const map: Record<string, [string, string]> = {
    'twilio-approved': ['#065f46', '#d1fae5'],
    active: ['#065f46', '#d1fae5'],
    provisioned: ['#065f46', '#d1fae5'],
    'provisionally-approved': ['#065f46', '#d1fae5'],
    'pending-review': ['#92400e', '#fef3c7'],
    'in-review': ['#92400e', '#fef3c7'],
    onboarding: ['#92400e', '#fef3c7'],
    pending: ['#92400e', '#fef3c7'],
    draft: ['#374151', '#f3f4f6'],
    'twilio-rejected': ['#991b1b', '#fee2e2'],
    failed: ['#991b1b', '#fee2e2'],
  };
  const [color, background] = map[status ?? ''] ?? ['#374151', '#f3f4f6'];
  return {
    color,
    background,
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'capitalize',
  };
}
