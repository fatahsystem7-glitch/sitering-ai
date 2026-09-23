import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Eye, PhoneCall } from "lucide-react";
import { StatCards } from "@/components/dashboard/stat-cards";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { SetupCard } from "@/components/dashboard/setup-card";
import { CallsTable } from "@/components/dashboard/calls-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CallLog } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Live Demo" };

/** Realistic mock data so the product can be previewed without a backend. */
const DEMO_CALLS: CallLog[] = [
  {
    id: "demo-1",
    user_id: "demo",
    caller_name: "Sarah Mitchell",
    caller_phone: "+447700900123",
    trade_issue_summary: "Burst pipe — water pouring through kitchen ceiling",
    location_postcode: "E14 9RT",
    urgency_level: "Emergency",
    full_transcript:
      "AI: Good evening, you've reached AquaFix Plumbing. How can I help?\nCaller: Hi, it's Sarah — water's pouring through my kitchen ceiling, can someone come out tonight?\nAI: I'm sorry to hear that, Sarah. Can I take your postcode?\nCaller: E14 9RT, flat 12.\nAI: Thank you. And is water still flowing now?\nCaller: Yes, it's getting worse!\nAI: I've logged this as an emergency for AquaFix Plumbing. They'll call you back within minutes. Is this the best number to reach you on?\nCaller: Yes, this one.\nAI: Perfect — help is on the way, Sarah.",
    duration_seconds: 95,
    ai_summary: null,
    recording_url: null,
    created_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: "demo-2",
    user_id: "demo",
    caller_name: "James O'Brien",
    caller_phone: "+447700900456",
    trade_issue_summary: "Consumer unit upgrade quote — 3-bed semi",
    location_postcode: "M20 4BX",
    urgency_level: "Standard Quote",
    full_transcript:
      "AI: Good afternoon, you've reached AquaFix Plumbing. How can I help?\nCaller: Hi, I'm looking for a quote to replace an old fuse box with a modern consumer unit.\nAI: Of course. Can I take your name and postcode?\nCaller: James O'Brien, M20 4BX.\nAI: Thank you, James. Is this a standard quote request, or is anything unsafe right now?\nCaller: Just a standard quote, no rush.\nAI: Got it — AquaFix Plumbing will call you back shortly to arrange the quote.",
    duration_seconds: 134,
    ai_summary: null,
    recording_url: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "demo-3",
    user_id: "demo",
    caller_name: "Priya Patel",
    caller_phone: "+447700900789",
    trade_issue_summary: "Front door lock jammed — can't lock up tonight",
    location_postcode: "B15 2TT",
    urgency_level: "Emergency",
    full_transcript:
      "AI: Good evening, you've reached AquaFix Plumbing. How can I help?\nCaller: My front door lock has jammed and I can't lock up. I'm in B15.\nAI: I understand — that sounds urgent. Can I take your name?\nCaller: Priya Patel.\nAI: Thank you, Priya. I've flagged this as an emergency lock replacement and AquaFix Plumbing will contact you straight away.",
    duration_seconds: 78,
    ai_summary: null,
    recording_url: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    id: "demo-4",
    user_id: "demo",
    caller_name: "Tom Baker",
    caller_phone: "+447700900321",
    trade_issue_summary: "Bathroom refit enquiry — rough pricing",
    location_postcode: "LS6 3HN",
    urgency_level: "General Enquiry",
    full_transcript:
      "AI: Good morning, you've reached AquaFix Plumbing. How can I help?\nCaller: Just wondering roughly what a full bathroom refit costs these days?\nAI: Happy to help — can I take your name and postcode first?\nCaller: Tom Baker, LS6 3HN.\nAI: Thank you, Tom. AquaFix Plumbing will give you a call back to discuss pricing and availability.",
    duration_seconds: 61,
    ai_summary: null,
    recording_url: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 49).toISOString(),
  },
  {
    id: "demo-5",
    user_id: "demo",
    caller_name: "Unknown",
    caller_phone: "+447700900654",
    trade_issue_summary: "Electrical sockets tripping repeatedly",
    location_postcode: "G41 2ER",
    urgency_level: "Standard Quote",
    full_transcript:
      "AI: Good afternoon, you've reached AquaFix Plumbing. How can I help?\nCaller: Our sockets keep tripping the electrics. Need someone to look at it this week.\nAI: Certainly. Can I take your name and postcode?\nCaller: I'd rather not say — G41 2ER.\nAI: No problem. AquaFix Plumbing will call this number back to arrange a visit.",
    duration_seconds: 88,
    ai_summary: null,
    recording_url: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 74).toISOString(),
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Demo header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container flex min-h-[4rem] flex-wrap items-center gap-3 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <PhoneCall size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              AquaFix Plumbing Ltd
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              +442045771234
            </p>
          </div>
          <Badge>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            AI Active
          </Badge>
          <Badge variant="secondary">
            <Eye size={12} /> Demo Preview
          </Badge>
        </div>
      </header>

      <main className="container space-y-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Good to see you, Dave 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              Here&apos;s what your AI receptionist has been up to.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <ArrowLeft size={16} /> Back to site
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-5 py-3.5 text-sm text-muted-foreground">
          <span className="font-semibold text-emerald-300">Demo mode</span> —
          this dashboard is showing realistic sample data. Search the call log,
          open a transcript, and try the forwarding-code copy button.
        </div>

        <StatCards totalCalls={128} leadsThisMonth={34} emergencies={6} />

        <div className="grid gap-6 lg:grid-cols-2">
          <UsageMeter used={347} cap={500} />
          <SetupCard assignedNumber="+442045771234" />
        </div>

        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">
              Recent Call Logs & Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CallsTable calls={DEMO_CALLS} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
