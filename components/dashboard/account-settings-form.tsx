"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Building2, Loader2, Save } from "lucide-react";
import { updateAccountSettings, type ActionResult } from "@/app/dashboard/actions";
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
import type { Client } from "@/lib/supabase/types";

const initialState: ActionResult = { ok: true };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
      Save changes
    </Button>
  );
}

export function AccountSettingsForm({ client }: { client: Client }) {
  const [state, formAction] = useFormState(updateAccountSettings, initialState);

  return (
    <Card className="bg-card/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 size={18} className="text-emerald-400" />
          Account & receptionist settings
        </CardTitle>
        <CardDescription>
          Changes take effect on your next inbound call.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {!state.ok && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {state.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business name *</Label>
              <Input
                id="business_name"
                name="business_name"
                required
                defaultValue={client.business_name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade_type">Trade</Label>
              <Input
                id="trade_type"
                name="trade_type"
                defaultValue={client.trade_type ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_name">Your name *</Label>
              <Input
                id="owner_name"
                name="owner_name"
                required
                defaultValue={client.owner_name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={client.email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Mobile number</Label>
              <Input
                id="phone_number"
                name="phone_number"
                type="tel"
                defaultValue={client.phone_number ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency_forwarding_number">
                Emergency forwarding number
              </Label>
              <Input
                id="emergency_forwarding_number"
                name="emergency_forwarding_number"
                type="tel"
                defaultValue={client.emergency_forwarding_number}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_areas">Areas you cover</Label>
              <Input
                id="service_areas"
                name="service_areas"
                defaultValue={client.service_areas ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callout_fee">Callout fee</Label>
              <Input
                id="callout_fee"
                name="callout_fee"
                defaultValue={client.callout_fee ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operating_hours">Working hours</Label>
              <Input
                id="operating_hours"
                name="operating_hours"
                defaultValue={client.operating_hours ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="greeting_style">Greeting style</Label>
              <Input
                id="greeting_style"
                name="greeting_style"
                defaultValue={client.greeting_style ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_instructions">
              Anything else the AI should know?
            </Label>
            <Textarea
              id="custom_instructions"
              name="custom_instructions"
              rows={4}
              defaultValue={client.custom_instructions ?? ""}
            />
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton />
            {state.ok && (
              <span className="text-sm text-muted-foreground">
                Your settings are saved automatically to Supabase.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
