import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Eye, ShieldCheck } from "lucide-react";
import { MetricCards } from "@/components/admin/metric-cards";
import { CustomersTable } from "@/components/admin/customers-table";
import { ConversationsExplorer } from "@/components/admin/conversations-explorer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminCustomerRow, AdminMetrics } from "@/lib/admin";
import type { CallLog } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Admin Demo" };

const now = Date.now();
const hrs = (h: number) => new Date(now - h * 3_600_000).toISOString();

const DEMO_METRICS: AdminMetrics = {
  mrrPence: 1_800_000,
  activeSubscribers: 120,
  trialingSubscribers: 0,
  totalCustomers: 128,
  totalMinutesUsed: 41_230,
  overageMinutes: 1_840,
  overageRevenuePence: 18_400,
};

const DEMO_CUSTOMERS: AdminCustomerRow[] = [
  {
    userId: "c1",
    businessName: "AquaFix Plumbing Ltd",
    ownerName: "Dave Smith",
    tradeType: "Plumbing",
    assignedNumber: "+442045771234",
    status: "active",
    minutesUsed: 486,
    minutesCap: 500,
    forwardingActive: true,
    isAdmin: false,
    createdAt: hrs(2000),
  },
  {
    userId: "c2",
    businessName: "SparkRight Electrical",
    ownerName: "Lena Wright",
    tradeType: "Electrical",
    assignedNumber: "+442045775678",
    status: "active",
    minutesUsed: 512,
    minutesCap: 500,
    forwardingActive: true,
    isAdmin: false,
    createdAt: hrs(1500),
  },
  {
    userId: "c3",
    businessName: "BrickSolid Builders",
    ownerName: "Tom Baker",
    tradeType: "General Building",
    assignedNumber: "+442045779012",
    status: "past_due",
    minutesUsed: 203,
    minutesCap: 500,
    forwardingActive: true,
    isAdmin: false,
    createdAt: hrs(900),
  },
  {
    userId: "c4",
    businessName: "KeyMaster Locksmiths",
    ownerName: "Ali Khan",
    tradeType: "Locksmith",
    assignedNumber: "+442045773456",
    status: "active",
    minutesUsed: 96,
    minutesCap: 750,
    forwardingActive: false,
    isAdmin: false,
    createdAt: hrs(400),
  },
];

const DIRECTORY = Object.fromEntries(
  DEMO_CUSTOMERS.map((c) => [
    c.userId,
    { business: c.businessName, trade: c.tradeType },
  ]),
);

const DEMO_CALLS: CallLog[] = [
  {
    id: "a1",
    user_id: "c1",
    caller_name: "Sarah Mitchell",
    caller_phone: "+447700900123",
    trade_issue_summary: "Burst pipe — water through kitchen ceiling",
    location_postcode: "E14 9RT",
    urgency_level: "Emergency",
    ai_summary:
      "Emergency burst pipe at E14 9RT. Caller Sarah Mitchell needs same-night attendance.",
    recording_url: null,
    full_transcript:
      "AI: Good evening, you've reached AquaFix Plumbing…\nCaller: Water's pouring through my ceiling, can someone come tonight?\nAI: I've logged this as an emergency — they'll call you back within minutes.",
    duration_seconds: 95,
    created_at: hrs(1),
  },
  {
    id: "a2",
    user_id: "c2",
    caller_name: "James O'Brien",
    caller_phone: "+447700900456",
    trade_issue_summary: "Consumer unit upgrade quote — 3-bed semi",
    location_postcode: "M20 4BX",
    urgency_level: "Standard Quote",
    ai_summary:
      "Quote request: consumer unit replacement for 3-bed semi in M20 4BX.",
    recording_url: null,
    full_transcript:
      "AI: Good afternoon, SparkRight Electrical…\nCaller: Looking for a quote on a new consumer unit.\nAI: Logged as a standard quote — they'll call you back shortly.",
    duration_seconds: 134,
    created_at: hrs(5),
  },
  {
    id: "a3",
    user_id: "c1",
    caller_name: "Sarah Mitchell",
    caller_phone: "+447700900123",
    trade_issue_summary: "Follow-up: engineer arrival time",
    location_postcode: "E14 9RT",
    urgency_level: "General Enquiry",
    ai_summary: "Repeat caller asking for engineer ETA on the burst-pipe job.",
    recording_url: null,
    full_transcript:
      "AI: Good evening, AquaFix Plumbing…\nCaller: It's Sarah again — any idea when the engineer will arrive?\nAI: I've flagged your message as urgent and they'll update you right away.",
    duration_seconds: 64,
    created_at: hrs(3),
  },
  {
    id: "a4",
    user_id: "c4",
    caller_name: "Priya Patel",
    caller_phone: "+447700900789",
    trade_issue_summary: "Front door lock jammed — can't lock up",
    location_postcode: "B15 2TT",
    urgency_level: "Emergency",
    ai_summary:
      "Emergency lock replacement in B15 2TT. Caller cannot secure property tonight.",
    recording_url: null,
    full_transcript:
      "AI: KeyMaster Locksmiths, how can I help?\nCaller: My lock's jammed and I can't lock up.\nAI: Flagged as an emergency — they'll contact you straight away.",
    duration_seconds: 78,
    created_at: hrs(26),
  },
];

export default function AdminDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container flex min-h-[4rem] flex-wrap items-center gap-3 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500 text-white shadow-lg shadow-violet-500/30">
            <ShieldCheck size={18} />
          </span>
          <span className="text-lg font-bold tracking-tight">
            SiteRing <span className="text-violet-400">Admin</span>
          </span>
          <div className="flex flex-1 items-center justify-end gap-2">
            <Badge variant="secondary">
              <Eye size={12} /> Demo Preview
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <ArrowLeft size={16} /> Back to site
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container space-y-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Platform Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Demo mode — sample data. The live /admin route is restricted to
            staff accounts.
          </p>
        </div>

        <MetricCards metrics={DEMO_METRICS} />

        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomersTable initial={DEMO_CUSTOMERS} demo />
          </CardContent>
        </Card>

        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <ConversationsExplorer calls={DEMO_CALLS} directory={DIRECTORY} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
