import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreditCard, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  BusinessDetailsForm,
  EmergencyNumberForm,
} from "@/components/dashboard/settings-forms";
import { BillingButtons } from "@/components/dashboard/billing-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  inactive: "Inactive",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
};

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/settings");

  const [{ data: profile }, { data: telephony }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("telephony_provisioning")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ]);

  if (!profile) redirect("/login?next=/dashboard/settings");

  const statusActive =
    profile.subscription_status === "active" ||
    profile.subscription_status === "trialing";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your business details, emergency routing and billing.
        </p>
      </div>

      <BusinessDetailsForm profile={profile} />
      <EmergencyNumberForm profile={profile} />

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone size={18} className="text-emerald-400" />
            Your SiteRing Number
          </CardTitle>
          <CardDescription>
            Forward missed calls to this number from your mobile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="inline-block rounded-xl bg-zinc-900 px-4 py-2.5 font-mono text-lg font-bold text-emerald-300 ring-1 ring-emerald-500/25">
            {telephony?.assigned_phone_number ?? "Provisioning…"}
          </p>
          <p className="font-mono text-sm text-muted-foreground">
            Forwarding code: **61*
            {telephony?.assigned_phone_number?.replace(/\s/g, "") ??
              "YOUR_SITERING_NUMBER"}
            #
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">
            Missed-Call Forwarding Setup
          </CardTitle>
          <CardDescription>
            Standard GSM codes — work on EE, O2, Vodafone, Three and most UK
            networks. Takes 30 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-300">
                1
              </span>
              <span className="pt-0.5">
                Open your phone&apos;s dialler and type{" "}
                <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
                  **61*
                  {telephony?.assigned_phone_number?.replace(/\s/g, "") ??
                    "YOUR_SITERING_NUMBER"}
                  #
                </code>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-300">
                2
              </span>
              <span className="pt-0.5">
                Press call — your network confirms forwarding is active. Missed
                calls now reach your AI receptionist instead of voicemail.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-300">
                3
              </span>
              <span className="pt-0.5">
                To switch forwarding off at any time, dial{" "}
                <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
                  ##61#
                </code>{" "}
                and press call.
              </span>
            </li>
          </ol>
          <p className="rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
            iPhone alternative: Settings → Phone → Call Forwarding. Forwarding
            only triggers on calls you don&apos;t answer — answered calls are
            never affected.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard size={18} className="text-emerald-400" />
            Subscription & Billing
          </CardTitle>
          <CardDescription>
            £150/mo · 500 minutes included · £0.10/min overage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={statusActive ? "default" : "warning"}>
              {STATUS_LABEL[profile.subscription_status] ??
                profile.subscription_status}
            </Badge>
          </div>
          <BillingButtons status={profile.subscription_status} />
        </CardContent>
      </Card>
    </div>
  );
}
