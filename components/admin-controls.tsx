"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDemoPhone, setAccountStatus } from "@/app/actions/admin";

export function DemoPhoneForm({ current }: { current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await saveDemoPhone(value);
    setPending(false);
    setMessage(result.message);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-line bg-card p-5">
      <h2 className="serif text-2xl">Live demo number</h2>
      <p className="mt-2 text-sm text-muted">Stored in app_settings. The homepage uses this when it is set, otherwise NEXT_PUBLIC_DEMO_PHONE_NUMBER.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input value={value} onChange={(event) => setValue(event.target.value)} className="flex-1 rounded-2xl border border-line px-4 py-3 text-sm" placeholder="+44…" />
        <button disabled={pending} className="rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper">Save</button>
      </div>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </form>
  );
}

export function StatusSelect({ profileId, status }: { profileId: string; status: string }) {
  const router = useRouter();
  return (
    <select
      defaultValue={status || "trial"}
      className="rounded-xl border border-line bg-card px-2 py-1 text-sm"
      onChange={async (event) => {
        const next = event.target.value as "trial" | "active" | "suspended";
        await setAccountStatus(profileId, next);
        router.refresh();
      }}
    >
      <option value="trial">trial</option>
      <option value="active">active</option>
      <option value="suspended">suspended</option>
    </select>
  );
}
