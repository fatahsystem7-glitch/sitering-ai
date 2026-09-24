"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";
import { saveReceptionProfile, type ActionResult } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BusinessProfile, ServiceItem } from "@/lib/supabase/types";

const initialState: ActionResult = { ok: true };

export function ReceptionProfileForm({
  profile,
}: {
  profile: BusinessProfile | null;
}) {
  const [state, formAction] = useFormState(saveReceptionProfile, initialState);
  const [website, setWebsite] = useState(profile?.website_url ?? "");
  const [areas, setAreas] = useState(profile?.service_areas ?? "");
  const [callout, setCallout] = useState(profile?.callout_fee ?? "");
  const [hours, setHours] = useState(profile?.operating_hours ?? "");
  const [booking, setBooking] = useState(profile?.booking_url ?? "");
  const [notes, setNotes] = useState(profile?.custom_instructions ?? "");
  const [services, setServices] = useState<ServiceItem[]>(
    profile?.services?.length
      ? profile.services
      : [{ name: "General Call-out", price: "£80", duration: "45 mins" }],
  );
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function importFromUrl() {
    setImportError(null);
    if (!website.trim()) {
      setImportError("Add a website address first.");
      return;
    }
    setImporting(true);
    try {
      const response = await fetch("/api/import-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: website.trim() }),
      });
      const body = (await response.json()) as {
        error?: string;
        profile?: Partial<BusinessProfile>;
      };
      if (!response.ok || !body.profile) {
        setImportError(body.error ?? "Import failed.");
        return;
      }
      const imported = body.profile;
      if (imported.service_areas) setAreas(imported.service_areas);
      if (imported.callout_fee) setCallout(imported.callout_fee);
      if (imported.operating_hours) setHours(imported.operating_hours);
      if (imported.booking_url) setBooking(imported.booking_url);
      if (imported.website_url) setWebsite(imported.website_url);
      if (imported.custom_instructions) setNotes(imported.custom_instructions);
      if (imported.services?.length) setServices(imported.services);
    } catch {
      setImportError("Import failed. Try again in a moment.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card className="bg-card/70">
      <CardHeader>
        <CardTitle className="text-base">Receptionist profile</CardTitle>
        <CardDescription>
          Saved to business_profiles and read on the next inbound call. Do not
          invent prices here — only list what the receptionist may quote.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="services" value={JSON.stringify(services)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="service_areas">Primary service postcodes / areas</Label>
              <Input
                id="service_areas"
                name="service_areas"
                value={areas}
                onChange={(event) => setAreas(event.target.value)}
                placeholder="HA1–HA3, NW10, Watford"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callout_fee">Emergency call-out fee</Label>
              <Input
                id="callout_fee"
                name="callout_fee"
                value={callout}
                onChange={(event) => setCallout(event.target.value)}
                placeholder="£95 plus VAT, waived if the job goes ahead"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operating_hours">Standard operating hours</Label>
              <Input
                id="operating_hours"
                name="operating_hours"
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                placeholder="Mon–Fri 8am–6pm, emergencies any time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website_url">Website URL</Label>
              <Input
                id="website_url"
                name="website_url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={importFromUrl}
                disabled={importing}
              >
                {importing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Import from URL
              </Button>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="booking_url">Online booking / calendar link</Label>
              <Input
                id="booking_url"
                name="booking_url"
                value={booking}
                onChange={(event) => setBooking(event.target.value)}
                placeholder="https://calendly.com/your-firm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Services</Label>
            <div className="space-y-2">
              {services.map((service, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
                  <Input
                    aria-label="Service name"
                    value={service.name}
                    onChange={(event) =>
                      setServices((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, name: event.target.value } : row,
                        ),
                      )
                    }
                    placeholder="Name"
                  />
                  <Input
                    aria-label="Price or estimate"
                    value={service.price}
                    onChange={(event) =>
                      setServices((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, price: event.target.value } : row,
                        ),
                      )
                    }
                    placeholder="£80"
                  />
                  <Input
                    aria-label="Duration"
                    value={service.duration}
                    onChange={(event) =>
                      setServices((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? { ...row, duration: event.target.value }
                            : row,
                        ),
                      )
                    }
                    placeholder="45 mins"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setServices((rows) => rows.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setServices((rows) => [...rows, { name: "", price: "", duration: "" }])
              }
            >
              Add service
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_instructions">Custom AI instructions / FAQ notes</Label>
            <Textarea
              id="custom_instructions"
              name="custom_instructions"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="We don't do gas. Always ask if there is parking for a van."
            />
          </div>

          {importError ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {importError}
            </p>
          ) : null}
          {!state.ok ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {state.error}
            </p>
          ) : null}
          <SaveButton />
        </form>
      </CardContent>
    </Card>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 size={16} className="animate-spin" /> : null}
      Save receptionist profile
    </Button>
  );
}
