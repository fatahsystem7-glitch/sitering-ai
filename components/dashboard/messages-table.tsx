"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import type { MessageLog, UrgencyLevel } from "@/lib/supabase/types";

interface Props {
  messages: MessageLog[];
}

function urgencyVariant(u: UrgencyLevel): "destructive" | "warning" | "muted" {
  if (u === "Emergency") return "destructive";
  if (u === "Standard Quote") return "warning";
  return "muted";
}

export function MessagesTable({ messages }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MessageLog | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) =>
      [m.contact_name, m.contact_phone, m.body, m.summary, m.transcript]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [messages, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Search messages, names or numbers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
          <MessageSquare size={24} className="text-muted-foreground" />
          <p className="font-medium">
            {messages.length === 0
              ? "No messages yet"
              : "No messages match your search"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {messages.length === 0
              ? "Texts, missed-call text-backs and voicemail transcripts will appear here as soon as your number goes live."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSelected(m)}
                className="flex w-full flex-col gap-1.5 rounded-2xl border border-border bg-card/50 p-4 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {m.contact_name ?? m.contact_phone ?? "Unknown contact"}
                  </span>
                  <Badge variant="outline" className="uppercase">
                    {m.channel}
                  </Badge>
                  <Badge variant={urgencyVariant(m.urgency_level)}>
                    {m.urgency_level}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTime(m.created_at)}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {m.summary ?? m.body ?? m.transcript ?? "—"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent side="right" className="overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.contact_name ?? selected.contact_phone ?? "Unknown contact"}
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(selected.created_at)} · {selected.channel} ·{" "}
                  {selected.direction}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant={urgencyVariant(selected.urgency_level)}>
                  {selected.urgency_level}
                </Badge>
                {selected.contact_phone && (
                  <Badge variant="outline" className="font-mono">
                    {selected.contact_phone}
                  </Badge>
                )}
              </div>

              {selected.summary && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Summary
                  </p>
                  <p className="mt-1">{selected.summary}</p>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Full transcript
                </p>
                <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200">
                  {selected.transcript || selected.body || "No transcript recorded."}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
