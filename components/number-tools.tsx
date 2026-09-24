"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { provisionPhoneNumber, registerExistingNumber } from "@/app/actions/profile";
import { formatUkPhone } from "@/lib/phone";

export function NumberTools({ phoneNumber }: { phoneNumber: string | null }) {
  const router = useRouter();
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function buy() {
    setPending(true);
    setError(null);
    const result = await provisionPhoneNumber();
    setPending(false);
    if (!result.ok) setError(result.message);
    else setMessage(result.message ?? "Number assigned.");
    router.refresh();
  }

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await registerExistingNumber(manual);
    setPending(false);
    if (!result.ok) setError(result.message);
    else setMessage(result.message ?? "Registered.");
    router.refresh();
  }

  return (
    <section className="rounded-3xl border border-line bg-card p-6">
      <h2 className="serif text-2xl">UK number</h2>
      <p className="mt-2 text-sm text-muted">
        {phoneNumber
          ? `${formatUkPhone(phoneNumber)} is the number callers dial. The receptionist loads this profile from it.`
          : "Buy a new +44 number, or register one you already hold in Twilio."}
      </p>
      {phoneNumber ? null : (
        <button type="button" onClick={buy} disabled={pending} className="mt-4 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper disabled:opacity-60">
          {pending ? "Working…" : "Assign a +44 number"}
        </button>
      )}
      <form onSubmit={register} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input value={manual} onChange={(event) => setManual(event.target.value)} placeholder="+44…" className="flex-1 rounded-2xl border border-line px-4 py-3 text-sm" />
        <button type="submit" disabled={pending} className="rounded-full border border-line px-4 py-3 text-sm font-semibold">
          Register existing
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-signal">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-pine">{message}</p> : null}
    </section>
  );
}
