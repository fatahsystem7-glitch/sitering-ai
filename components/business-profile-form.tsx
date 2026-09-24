"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBusinessProfile } from "@/app/actions/profile";
import { TRADE_OPTIONS } from "@/lib/trades";
import { EMPTY_SERVICE, type ServiceItem } from "@/lib/types";

export type ProfileFormState = {
  business_name: string;
  trade_type: string;
  service_areas: string;
  callout_fee: string;
  operating_hours: string;
  website_url: string;
  booking_url: string;
  custom_instructions: string;
  services: ServiceItem[];
};

const field = "mt-2 w-full rounded-2xl border border-line px-4 py-3 text-sm";

export function BusinessProfileForm({
  initial,
  submitLabel = "Save profile",
  nextHref,
}: {
  initial: ProfileFormState;
  submitLabel?: string;
  nextHref?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileFormState>(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [importing, setImporting] = useState(false);

  function set<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateService(index: number, key: keyof ServiceItem, value: string) {
    setForm((current) => ({
      ...current,
      services: current.services.map((service, i) => (i === index ? { ...service, [key]: value } : service)),
    }));
  }

  async function onImport() {
    setError(null);
    setStatus(null);
    if (!form.website_url.trim()) {
      setError("Add a website address before importing.");
      return;
    }
    setImporting(true);
    try {
      const response = await fetch("/api/import-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.website_url.trim() }),
      });
      const body = (await response.json()) as { error?: string; profile?: Partial<ProfileFormState> };
      if (!response.ok || !body.profile) {
        setError(body.error ?? "Import failed.");
        return;
      }
      const imported = body.profile;
      setForm((current) => ({
        ...current,
        business_name: imported.business_name || current.business_name,
        trade_type: imported.trade_type || current.trade_type,
        service_areas: imported.service_areas || current.service_areas,
        callout_fee: imported.callout_fee || current.callout_fee,
        operating_hours: imported.operating_hours || current.operating_hours,
        booking_url: imported.booking_url || current.booking_url,
        website_url: imported.website_url || current.website_url,
        custom_instructions: imported.custom_instructions || current.custom_instructions,
        services: imported.services && imported.services.length > 0 ? imported.services : current.services,
      }));
      setStatus("Imported what the site actually said. Check the prices before you save.");
    } catch {
      setError("Import failed. Try again in a moment.");
    } finally {
      setImporting(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setStatus(null);
    const result = await saveBusinessProfile(form);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStatus(result.message ?? "Saved.");
    if (nextHref) router.push(nextHref);
    else router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-medium">
          Business name
          <input className={field} value={form.business_name} onChange={(event) => set("business_name", event.target.value)} required />
        </label>
        <label className="block text-sm font-medium">
          Trade category
          <select className={field} value={form.trade_type} onChange={(event) => set("trade_type", event.target.value)} required>
            <option value="">Choose a trade</option>
            {TRADE_OPTIONS.map((trade) => (
              <option key={trade} value={trade}>{trade}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium md:col-span-2">
          Primary service postcodes / areas
          <input className={field} value={form.service_areas} onChange={(event) => set("service_areas", event.target.value)} placeholder="HA1–HA3, NW10, Watford" required />
        </label>
        <label className="block text-sm font-medium">
          Emergency call-out fee
          <input className={field} value={form.callout_fee} onChange={(event) => set("callout_fee", event.target.value)} placeholder="£95 plus VAT, waived if the job goes ahead" />
        </label>
        <label className="block text-sm font-medium">
          Standard operating hours
          <input className={field} value={form.operating_hours} onChange={(event) => set("operating_hours", event.target.value)} placeholder="Mon–Fri 8am–6pm, emergencies any time" />
        </label>
        <label className="block text-sm font-medium">
          Website URL
          <input className={field} value={form.website_url} onChange={(event) => set("website_url", event.target.value)} placeholder="https://" inputMode="url" />
        </label>
        <div className="flex items-end">
          <button type="button" onClick={onImport} disabled={importing} className="w-full rounded-full border border-line bg-card px-4 py-3 text-sm font-semibold disabled:opacity-60">
            {importing ? "Reading the site…" : "Import from URL"}
          </button>
        </div>
        <label className="block text-sm font-medium md:col-span-2">
          Online booking / calendar link
          <input className={field} value={form.booking_url} onChange={(event) => set("booking_url", event.target.value)} placeholder="https://calendly.com/your-firm" inputMode="url" />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Services</legend>
        <p className="mt-1 text-sm text-muted">Add, edit, or remove the jobs the receptionist is allowed to quote.</p>
        <div className="mt-4 space-y-3">
          {form.services.map((service, index) => (
            <div key={index} className="grid gap-2 rounded-2xl border border-line bg-card-2 p-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
              <input aria-label="Service name" className="rounded-xl border border-line px-3 py-2 text-sm" value={service.name} onChange={(event) => updateService(index, "name", event.target.value)} placeholder="Name" />
              <input aria-label="Price or estimate" className="rounded-xl border border-line px-3 py-2 text-sm" value={service.price} onChange={(event) => updateService(index, "price", event.target.value)} placeholder="£80" />
              <input aria-label="Duration" className="rounded-xl border border-line px-3 py-2 text-sm" value={service.duration} onChange={(event) => updateService(index, "duration", event.target.value)} placeholder="45 mins" />
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-sm text-signal"
                onClick={() => set("services", form.services.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-brass-deep"
          onClick={() => set("services", [...form.services, { name: "", price: "", duration: "" }])}
        >
          Add service
        </button>
        {form.services.length === 0 ? (
          <button type="button" className="mt-2 block text-sm text-muted" onClick={() => set("services", [{ ...EMPTY_SERVICE }])}>
            Restore the default call-out
          </button>
        ) : null}
      </fieldset>

      <label className="block text-sm font-medium">
        Custom AI instructions / FAQ notes
        <textarea
          className={`${field} min-h-36`}
          value={form.custom_instructions}
          onChange={(event) => set("custom_instructions", event.target.value)}
          placeholder="We don't do gas. Always ask if there is parking for a van. Boiler swaps start from £1,800."
        />
      </label>

      {error ? <p className="text-sm text-signal">{error}</p> : null}
      {status ? <p className="text-sm text-pine">{status}</p> : null}

      <button type="submit" disabled={pending} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper disabled:opacity-60">
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
