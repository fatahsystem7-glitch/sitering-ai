"use client";

import { useMemo, useState } from "react";
import { FileText, Phone, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, formatDuration } from "@/lib/utils";
import type { CallLog, UrgencyLevel } from "@/lib/supabase/types";

interface Props {
  calls: CallLog[];
}

function urgencyVariant(u: UrgencyLevel): "destructive" | "warning" | "muted" {
  if (u === "Emergency") return "destructive";
  if (u === "Standard Quote") return "warning";
  return "muted";
}

export function CallsTable({ calls }: Props) {
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState<string>("all");
  const [selected, setSelected] = useState<CallLog | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calls.filter((c) => {
      const matchesQuery =
        !q ||
        [
          c.caller_name,
          c.caller_phone,
          c.trade_issue_summary,
          c.location_postcode,
        ]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q));
      const matchesUrgency = urgency === "all" || c.urgency_level === urgency;
      return matchesQuery && matchesUrgency;
    });
  }, [calls, query, urgency]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search name, phone, postcode or issue…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={urgency} onValueChange={setUrgency}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All urgencies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All urgencies</SelectItem>
            <SelectItem value="Emergency">Emergency</SelectItem>
            <SelectItem value="Standard Quote">Standard Quote</SelectItem>
            <SelectItem value="General Enquiry">General Enquiry</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
          <Phone size={24} className="text-muted-foreground" />
          <p className="font-medium">
            {calls.length === 0
              ? "No calls answered yet"
              : "No calls match your search"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {calls.length === 0
              ? "Once call forwarding is active, every answered call will appear here with a full transcript."
              : "Try a different search term or urgency filter."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Caller</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden sm:table-cell">Postcode</TableHead>
                <TableHead className="hidden lg:table-cell">Issue</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((call) => (
                <TableRow
                  key={call.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(call)}
                >
                  <TableCell>
                    <p className="font-semibold">
                      {call.caller_name ?? "Unknown"}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {call.caller_phone ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                    {formatDateTime(call.created_at)}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {call.location_postcode ?? "—"}
                  </TableCell>
                  <TableCell className="hidden max-w-[220px] truncate text-muted-foreground lg:table-cell">
                    {call.trade_issue_summary ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={urgencyVariant(call.urgency_level)}>
                      {call.urgency_level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(call);
                      }}
                    >
                      <FileText size={16} />
                      <span className="hidden sm:inline">Transcript</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Slide-over transcript drawer */}
      <Dialog
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent side="right" className="overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.caller_name ?? "Unknown caller"}
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(selected.created_at)} ·{" "}
                  {formatDuration(selected.duration_seconds)} call
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={urgencyVariant(selected.urgency_level)}>
                  {selected.urgency_level}
                </Badge>
                {selected.location_postcode && (
                  <Badge variant="outline" className="font-mono">
                    {selected.location_postcode}
                  </Badge>
                )}
              </div>

              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Phone
                  </p>
                  <p className="font-mono">{selected.caller_phone ?? "—"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Issue summary
                  </p>
                  <p>{selected.trade_issue_summary ?? "—"}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Full transcript
                </p>
                <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200">
                  {selected.full_transcript ||
                    "No transcript recorded for this call."}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
