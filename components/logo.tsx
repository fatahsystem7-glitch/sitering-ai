import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
      <span className="relative grid h-9 w-9 place-items-center rounded-full border border-brass bg-card">
        <span className="h-3.5 w-3.5 rounded-full border-[1.6px] border-brass" />
        <span className="absolute h-1.5 w-1.5 rounded-full bg-brass" />
      </span>
      <span className="leading-none">
        <span className="serif block text-lg tracking-tight">SiteRing</span>
        {compact ? null : <span className="text-[11px] uppercase tracking-[0.16em] text-muted">AI receptionist</span>}
      </span>
    </Link>
  );
}
