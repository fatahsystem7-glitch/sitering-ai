import { formatUkPhone, telHref } from "@/lib/phone";

export function DemoCallButton({ number }: { number: string | null }) {
  if (!number) {
    return (
      <span className="inline-flex items-center gap-3 rounded-full border border-dashed border-line px-5 py-3 text-sm text-muted">
        Live Demo Call — number not set
      </span>
    );
  }

  return (
    <a
      href={telHref(number)}
      className="inline-flex items-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper shadow-[var(--shadow)]"
    >
      <span className="pulse-dot" />
      Live Demo Call
      <span className="font-normal text-paper/80">{formatUkPhone(number)}</span>
    </a>
  );
}
