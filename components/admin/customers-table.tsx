"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PauseCircle, PlayCircle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  setAccountForwarding,
  setMinuteCap,
  type AdminActionResult,
} from "@/app/admin/actions";
import type { AdminCustomerRow } from "@/lib/admin";
import { cn } from "@/lib/utils";

function statusVariant(
  s: string,
): "default" | "warning" | "destructive" | "muted" {
  if (s === "active" || s === "trialing") return "default";
  if (s === "past_due") return "warning";
  if (s === "canceled" || s === "unpaid") return "destructive";
  return "muted";
}

export function CustomersTable({
  initial,
  demo = false,
}: {
  initial: AdminCustomerRow[];
  demo?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [caps, setCaps] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.businessName, r.ownerName, r.tradeType, r.assignedNumber]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  function applyLocal(userId: string, patch: Partial<AdminCustomerRow>) {
    setRows((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, ...patch } : r)),
    );
  }

  async function handleToggle(row: AdminCustomerRow) {
    setError(null);
    if (demo) {
      applyLocal(row.userId, { forwardingActive: !row.forwardingActive });
      return;
    }
    setPendingId(row.userId);
    const res: AdminActionResult = await setAccountForwarding(
      row.userId,
      !row.forwardingActive,
    );
    setPendingId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handleCapSave(row: AdminCustomerRow) {
    const raw = caps[row.userId];
    const cap = Number(raw);
    if (!raw || !Number.isInteger(cap) || cap < 0 || cap > 100_000) {
      setError("Enter a whole number between 0 and 100,000.");
      return;
    }
    setError(null);
    if (demo) {
      applyLocal(row.userId, { minutesCap: cap });
      setCaps((c) => ({ ...c, [row.userId]: "" }));
      return;
    }
    setPendingId(row.userId);
    const res: AdminActionResult = await setMinuteCap(row.userId, cap);
    setPendingId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCaps((c) => ({ ...c, [row.userId]: "" }));
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Search business, owner, trade or number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-border bg-card/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Business</TableHead>
              <TableHead className="hidden md:table-cell">Trade</TableHead>
              <TableHead className="hidden lg:table-cell">UK Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Minutes</TableHead>
              <TableHead>Minute Cap</TableHead>
              <TableHead className="text-right">Account</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const pct =
                r.minutesCap > 0
                  ? Math.min(100, (r.minutesUsed / r.minutesCap) * 100)
                  : 0;
              const busy = pendingId === r.userId;
              return (
                <TableRow key={r.userId}>
                  <TableCell>
                    <p className="font-semibold">{r.businessName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.ownerName ?? "—"}
                      {r.isAdmin && (
                        <Badge variant="secondary" className="ml-2">
                          admin
                        </Badge>
                      )}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {r.tradeType ?? "—"}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">
                    {r.assignedNumber ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    {!r.forwardingActive && (
                      <Badge variant="muted" className="ml-1.5">
                        paused
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="w-32">
                      <p className="mb-1 font-mono text-xs">
                        {r.minutesUsed}/{r.minutesCap}
                      </p>
                      <Progress
                        value={pct}
                        indicatorClassName={cn(
                          pct >= 100
                            ? "bg-red-500"
                            : pct >= 80
                              ? "bg-amber-400"
                              : "bg-violet-500",
                        )}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100000}
                        placeholder={String(r.minutesCap)}
                        value={caps[r.userId] ?? ""}
                        onChange={(e) =>
                          setCaps((c) => ({ ...c, [r.userId]: e.target.value }))
                        }
                        className="h-8 w-20 px-2 font-mono text-xs"
                        aria-label={`Minute cap for ${r.businessName}`}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !(caps[r.userId] ?? "").trim()}
                        onClick={() => handleCapSave(r)}
                      >
                        {busy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={r.forwardingActive ? "outline" : "default"}
                      disabled={busy}
                      onClick={() => handleToggle(r)}
                    >
                      {busy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : r.forwardingActive ? (
                        <PauseCircle size={14} />
                      ) : (
                        <PlayCircle size={14} />
                      )}
                      {r.forwardingActive ? "Pause" : "Resume"}
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
          No customers match your search.
        </p>
      )}
    </div>
  );
}
