"use client";

import { useMemo, useState } from "react";
import { AudioLines, Building2, FileText, History, Search } from "lucide-react";
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

export type BusinessDirectory = Record<
  string,
  { business: string; trade: string | null }
>;

function urgencyVariant(u: UrgencyLevel): "destructive" | "warning" | "muted" {
  if (u === "Emergency") return "destructive";
  if (u === "Standard Quote") return "warning";
  return "muted";
}

export function ConversationsExplorer({
  calls,
  directory,
}: {
  calls: CallLog[];
  directory: BusinessDirectory;
}) {
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState("all");
  const [selected, setSelected] = useState<CallLog | null>(null);

  /** How many calls each phone number has made (repeat-caller detection). */
  const callCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of calls) {
      if (!c.caller_phone) continue;
      map.set(c.caller_phone, (map.get(c.caller_phone) ?? 0) + 1);
    }
    return map;
  }, [calls]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calls.filter((c) => {
      const biz = directory[c.user_id ?? ""];
      const matchesQuery =
        !q ||
        [
          c.caller_name,
          c.caller_phone,
          c.trade_issue_summary,
          c.location_postcode,
          biz?.business,
        ]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q));
      return matchesQuery && (urgency === "all" || c.urgency_level === urgency);
    });
  }, [calls, directory, query, urgency]);

  const selectedHistory = useMemo(() => {
    if (!selected?.caller_phone) return [];
    return calls
      .filter(
        (c) => c.caller_phone === selected.caller_phone && c.id !== selected.id,
      )
      .slice(0, 10);
  }, [calls, selected]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search business, caller, phone, postcode or issue…"
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

      <div className="rounded-2xl border border-border bg-card/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Business</TableHead>
              <TableHead>Caller</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="hidden lg:table-cell">Issue</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((call) => {
              const biz = directory[call.user_id ?? ""];
              const repeats = call.caller_phone
                ? (callCounts.get(call.caller_phone) ?? 1)
                : 1;
              return (
                <TableRow
                  key={call.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(call)}
                >
                  <TableCell>
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Building2
                        size={13}
                        className="shrink-0 text-muted-foreground"
                      />
                      {biz?.business ?? "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {biz?.trade ?? ""}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">
                      {call.caller_name ?? "Unknown"}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {call.caller_phone ?? "—"}
                    </p>
                    {repeats > 1 && (
                      <Badge variant="secondary" className="mt-1">
                        <History size={11} /> ×{repeats} calls
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                    {formatDateTime(call.created_at)}
                  </TableCell>
                  <TableCell className="hidden max-w-60 truncate text-muted-foreground lg:table-cell">
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
                      <span className="hidden sm:inline">Inspect</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No conversations match your search.
        </p>
      )}

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
                  {directory[selected.user_id ?? ""]?.business ?? "Unknown business"}{" "}
                  · {formatDateTime(selected.created_at)} ·{" "}
                  {formatDuration(selected.duration_seconds)}
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
                    Lead contact
                  </p>
                  <p>
                    {selected.caller_name ?? "Unknown"} ·{" "}
                    <span className="font-mono">
                      {selected.caller_phone ?? "—"}
                    </span>
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    AI summary
                  </p>
                  <p>
                    {selected.ai_summary ?? selected.trade_issue_summary ?? "—"}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <AudioLines size={13} /> Call audio
                </p>
                {selected.recording_url ? (
                  <audio
                    controls
                    src={selected.recording_url}
                    className="w-full"
                    preload="none"
                  />
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    No recording attached — the voice agent sends one when
                    available.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Full transcript
                </p>
                <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200">
                  {selected.full_transcript ||
                    "No transcript recorded for this call."}
                </div>
              </div>

              {selectedHistory.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <History size={13} /> Caller history (
                    {selectedHistory.length} more)
                  </p>
                  <ul className="space-y-1.5">
                    {selectedHistory.map((h) => (
                      <li
                        key={h.id}
                        className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">
                          {formatDateTime(h.created_at)}
                        </span>{" "}
                        — {h.trade_issue_summary ?? "No summary"} (
                        {h.urgency_level})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
