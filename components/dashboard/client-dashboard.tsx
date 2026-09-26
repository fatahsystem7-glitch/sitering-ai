"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  FileText,
  Gauge,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCards } from "@/components/dashboard/stat-cards";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { SetupCard } from "@/components/dashboard/setup-card";
import { CallsTable } from "@/components/dashboard/calls-table";
import { MessagesTable } from "@/components/dashboard/messages-table";
import { AccountSettingsForm } from "@/components/dashboard/account-settings-form";
import { cn } from "@/lib/utils";
import type { CallLog, Client, MessageLog } from "@/lib/supabase/types";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "calls", label: "Call logs", icon: FileText },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VERIFICATION_COPY: Record<
  string,
  { label: string; tone: "muted" | "warning" | "default"; body: string }
> = {
  pending: {
    label: "Documents needed",
    tone: "warning",
    body: "We still need your ID and proof of address before Telnyx can issue your number.",
  },
  submitted: {
    label: "Documents received",
    tone: "warning",
    body: "Your ID and proof of address are with us — we've submitted them to Telnyx for verification.",
  },
  in_review: {
    label: "In review with Telnyx",
    tone: "warning",
    body: "Telnyx is reviewing your documents. This usually completes within one working day.",
  },
  verified: {
    label: "Verified",
    tone: "default",
    body: "Your identity is verified and your number is cleared for use.",
  },
  rejected: {
    label: "Action required",
    tone: "muted",
    body: "Telnyx couldn't verify your documents. Please contact support so we can re-submit.",
  },
};

export function ClientDashboard({
  client,
  calls,
  messages,
}: {
  client: Client;
  calls: CallLog[];
  messages: MessageLog[];
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const [copied, setCopied] = useState(false);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const leadsThisMonth = calls.filter(
    (c) =>
      new Date(c.created_at) >= startOfMonth &&
      (c.urgency_level === "Emergency" || c.urgency_level === "Standard Quote"),
  ).length;
  const emergencies = calls.filter((c) => c.urgency_level === "Emergency").length;

  const verification =
    VERIFICATION_COPY[client.telnyx_verification_status] ??
    VERIFICATION_COPY.pending;

  async function copyClientId() {
    try {
      await navigator.clipboard.writeText(client.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Good to see you, {client.owner_name.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything your AI receptionist has handled, in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={copyClientId}
          className="group rounded-xl border border-border bg-card/60 px-4 py-2.5 text-left transition hover:border-emerald-500/40"
          title="Copy your Client ID"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Client ID
          </span>
          <span className="flex items-center gap-2 font-mono text-xs">
            {client.id}
            {copied ? (
              <Check size={13} className="text-emerald-400" />
            ) : (
              <Copy size={13} className="text-muted-foreground" />
            )}
          </span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card/50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
              tab === t.id
                ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <t.icon size={16} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <Card
            className={cn(
              "border-emerald-500/30 bg-emerald-500/5",
              verification.tone === "warning" && "border-amber-500/30 bg-amber-500/5",
            )}
          >
            <CardContent className="flex flex-wrap items-center gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/60 text-emerald-400">
                <ShieldCheck size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  Telnyx verification
                  <Badge
                    variant={
                      verification.tone === "default" ? "default" : "warning"
                    }
                  >
                    {verification.label}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">{verification.body}</p>
              </div>
            </CardContent>
          </Card>

          <StatCards
            totalCalls={calls.length}
            leadsThisMonth={leadsThisMonth}
            emergencies={emergencies}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <UsageMeter
              used={client.minutes_used_this_period}
              cap={client.monthly_cap_minutes}
            />
            <SetupCard assignedNumber={client.assigned_phone_number} />
          </div>

          <Card className="bg-card/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge size={18} className="text-emerald-400" />
                Latest activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CallsTable calls={calls.slice(0, 10)} />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "calls" && (
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Call logs & transcripts</CardTitle>
          </CardHeader>
          <CardContent>
            <CallsTable calls={calls} />
          </CardContent>
        </Card>
      )}

      {tab === "messages" && (
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Message transcripts</CardTitle>
          </CardHeader>
          <CardContent>
            <MessagesTable messages={messages} />
          </CardContent>
        </Card>
      )}

      {tab === "settings" && (
        <div className="space-y-6">
          <AccountSettingsForm client={client} />

          <Card className="bg-card/70">
            <CardHeader>
              <CardTitle className="text-base">Verification documents</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Photo ID", client.id_document_path, client.id_document_type],
                ["Proof of address", client.proof_of_address_path, null],
              ].map(([label, path, extra]) => (
                <div
                  key={label as string}
                  className="rounded-xl border border-border/60 bg-muted/20 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 font-medium">
                    {path ? "Uploaded & stored securely" : "Not uploaded yet"}
                  </p>
                  {extra && (
                    <p className="text-xs text-muted-foreground">{extra as string}</p>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                For your security, documents can&apos;t be downloaded from the
                dashboard. Contact support if you need to replace one.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/70">
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Client ID</span>
                <span className="font-mono text-xs">{client.id}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Assigned number</span>
                <span className="font-mono text-xs">
                  {client.assigned_phone_number ?? "Provisioning…"}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Subscription</span>
                <Badge variant="outline">{client.subscription_status}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Registered address</span>
                <span className="text-right text-xs">
                  {[
                    client.address_line1,
                    client.address_line2,
                    client.city,
                    client.postcode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="mailto:support@sitering.ai">Contact support</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
