export const metadata = {
  title: 'sitering-ai',
  description: 'AI receptionists for UK trade contractors',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, background: '#fafafa', color: '#111827' }}>{children}</body>
    </html>
  );
}
