"use client";

import { useState } from "react";
import { Check, Copy, PhoneForwarded } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  assignedNumber: string | null;
}

export function SetupCard({ assignedNumber }: Props) {
  const [copied, setCopied] = useState(false);

  const forwardCode = assignedNumber
    ? `**61*${assignedNumber.replace(/\s/g, "")}#`
    : "**61*YOUR_SITERING_NUMBER#";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(forwardCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — user can copy manually */
    }
  }

  const steps = [
    "Open your phone's dialler (the normal call app).",
    `Type ${forwardCode} exactly as shown.`,
    "Press call — you'll see a confirmation from your network.",
    "Done! Missed calls now reach your AI receptionist. Dial ##61# anytime to switch off.",
  ];

  return (
    <Card className="bg-card/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneForwarded size={18} className="text-emerald-400" />
          Quick Setup — Forward Missed Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-900 px-4 py-3 ring-1 ring-emerald-500/25">
          <code className="truncate font-mono text-sm font-semibold text-emerald-300">
            {forwardCode}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCode}
            aria-label="Copy forwarding code"
          >
            {copied ? (
              <Check size={16} className="text-emerald-400" />
            ) : (
              <Copy size={16} />
            )}
          </Button>
        </div>

        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li
              key={s}
              className="flex items-start gap-3 text-sm text-muted-foreground"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-300">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>

        <p className="rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Works on{" "}
          <span className="font-semibold text-foreground">
            EE, O2, Vodafone & Three
          </span>{" "}
          (plus giffgaff, Tesco Mobile, Voxi & most MVNOs). iPhone: Settings →
          Phone → Call Forwarding also works.
        </p>
      </CardContent>
    </Card>
  );
}
