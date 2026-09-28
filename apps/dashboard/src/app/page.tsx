import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '5rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>sitering-ai</h1>
      <p style={{ fontSize: 18, color: '#4b5563' }}>
        An AI receptionist that answers every call for UK trade businesses — books jobs,
        takes details, and never misses a lead.
      </p>
      <Link
        href="/signup"
        style={{
          display: 'inline-block', marginTop: 20, padding: '11px 18px',
          background: '#111827', color: '#fff', borderRadius: 8, textDecoration: 'none',
        }}
      >
        Get your number
      </Link>
    </main>
  );
}
