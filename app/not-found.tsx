import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24">
      <p className="text-xs uppercase tracking-[0.18em] text-brass-deep">404</p>
      <h1 className="serif mt-3 text-4xl">That page is not on the line.</h1>
      <Link href="/" className="mt-6 inline-block text-sm font-semibold">Back to SiteRing</Link>
    </main>
  );
}
