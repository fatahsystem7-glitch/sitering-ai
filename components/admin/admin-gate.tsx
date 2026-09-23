"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Client-side defence-in-depth for /admin.
 * The server layout already redirects non-admins before this ever renders —
 * this guards against any client-side navigation edge cases.
 */
export function AdminGate({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  if (!isAdmin) {
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/25">
          <ShieldAlert size={26} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Access denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This area is restricted to SiteRing administrators.
        </p>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
