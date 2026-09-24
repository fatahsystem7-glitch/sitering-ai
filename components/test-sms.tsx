"use client";

import { useState } from "react";

export function TestSms({ bookingUrl }: { bookingUrl: string | null }) {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/booking-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    const body = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) setError(body.error ?? "Text failed.");
    else setMessage("Test text sent.");
  }

  return (
    <form onSubmit={send} className="rounded-3xl border border-line bg-card p-6">
      <h2 className="serif text-2xl">Test the booking text</h2>
      <p className="mt-2 text-sm text-muted">
        {bookingUrl ? "Sends the saved booking link to a mobile you control." : "Save a booking link first."}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input value={to} onChange={(event) => setTo(event.target.value)} placeholder="07…" className="flex-1 rounded-2xl border border-line px-4 py-3 text-sm" disabled={!bookingUrl} />
        <button disabled={!bookingUrl || pending} className="rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-60">
          {pending ? "Sending…" : "Send test"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-signal">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-pine">{message}</p> : null}
    </form>
  );
}
