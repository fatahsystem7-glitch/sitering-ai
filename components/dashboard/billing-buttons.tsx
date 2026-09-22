"use client";

import { useState } from "react";
import { CreditCard, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubscriptionStatus } from "@/lib/supabase/types";

interface Props {
  status: SubscriptionStatus;
}

export function BillingButtons({ status }: Props) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsCheckout = status === "inactive" || status === "canceled";

  async function startCheckout() {
    setLoading("checkout");
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url)
        throw new Error(data.error ?? "Checkout failed.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setLoading(null);
    }
  }

  async function openPortal() {
    setLoading("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Portal failed.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {needsCheckout ? (
          <Button onClick={startCheckout} disabled={loading !== null}>
            {loading === "checkout" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Rocket size={16} />
            )}
            Start subscription — £150/mo
          </Button>
        ) : (
          <Button
            onClick={openPortal}
            disabled={loading !== null}
            variant="outline"
          >
            {loading === "portal" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CreditCard size={16} />
            )}
            Manage billing in Stripe
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
