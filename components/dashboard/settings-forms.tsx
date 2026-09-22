"use client";

import { useFormState, useFormStatus } from "react-dom";
import { BellRing, Building2, Loader2 } from "lucide-react";
import {
  updateBusinessDetails,
  updateEmergencyNumber,
  type ActionResult,
} from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Profile } from "@/lib/supabase/types";

const TRADES = [
  "Plumbing",
  "Electrical",
  "General Building",
  "Locksmith",
  "Heating & Gas",
  "Roofing",
  "Painting & Decorating",
  "Other Trade",
];

const initialState: ActionResult = { ok: true };

export function BusinessDetailsForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useFormState(updateBusinessDetails, initialState);

  return (
    <Card className="bg-card/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 size={18} className="text-emerald-400" />
          Business Details
        </CardTitle>
        <CardDescription>
          Used by your AI receptionist when answering calls.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business name *</Label>
              <Input
                id="business_name"
                name="business_name"
                required
                defaultValue={profile.business_name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner name</Label>
              <Input
                id="owner_name"
                name="owner_name"
                defaultValue={profile.owner_name ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Business phone</Label>
              <Input
                id="phone_number"
                name="phone_number"
                type="tel"
                defaultValue={profile.phone_number ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade_type">Trade focus</Label>
              <Select
                name="trade_type"
                defaultValue={profile.trade_type ?? undefined}
              >
                <SelectTrigger id="trade_type">
                  <SelectValue placeholder="Select trade" />
                </SelectTrigger>
                <SelectContent>
                  {TRADES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!state.ok && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {state.error}
            </p>
          )}
          <SubmitButton label="Save business details" />
        </form>
      </CardContent>
    </Card>
  );
}

export function EmergencyNumberForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useFormState(updateEmergencyNumber, initialState);

  return (
    <Card className="bg-card/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing size={18} className="text-emerald-400" />
          Emergency Forwarding
        </CardTitle>
        <CardDescription>
          Urgent calls are escalated to this number in real time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emergency_forwarding_number">
              Emergency forwarding number *
            </Label>
            <Input
              id="emergency_forwarding_number"
              name="emergency_forwarding_number"
              type="tel"
              required
              defaultValue={profile.emergency_forwarding_number}
              placeholder="e.g. 07700 900123"
            />
          </div>
          {!state.ok && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {state.error}
            </p>
          )}
          <SubmitButton label="Save emergency number" />
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 size={16} className="animate-spin" />}
      {label}
    </Button>
  );
}
