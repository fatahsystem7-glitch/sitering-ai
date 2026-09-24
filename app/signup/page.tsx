"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, PhoneCall } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const TRADES = [
  "Plumbing",
  "Electrical",
  "General Building",
  "Locksmith",
  "Heating & Gas",
  "Roofing",
  "Painting & Decorating",
  "Other Trade",
];

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    businessName: "",
    ownerName: "",
    phoneNumber: "",
    tradeType: "",
    emergencyNumber: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.tradeType) {
      setError("Please select your trade.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            business_name: form.businessName.trim(),
            owner_name: form.ownerName.trim() || null,
            phone_number: form.phoneNumber.trim() || null,
            trade_type: form.tradeType,
            emergency_forwarding_number: form.emergencyNumber.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/onboarding`,
        },
      });
      if (signUpError) throw signUpError;

      // If email confirmation is disabled, a session exists → go to dashboard.
      // Otherwise show the "check your inbox" state.
      if (data.session) {
        router.push("/dashboard/onboarding");
        router.refresh();
      } else {
        router.push("/login?next=/dashboard");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong signing up.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[100px]" />

      <Card className="relative w-full max-w-lg">
        <CardHeader className="text-center">
          <Link
            href="/"
            className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
          >
            <PhoneCall size={20} />
          </Link>
          <CardTitle className="text-2xl">Get SiteRing AI</CardTitle>
          <CardDescription>
            £150/mo · 500 minutes included · 30-day money-back guarantee
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                {error}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="businessName">Business name *</Label>
                <Input
                  id="businessName"
                  required
                  placeholder="e.g. AquaFix Plumbing Ltd"
                  value={form.businessName}
                  onChange={(e) => set("businessName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Your name</Label>
                <Input
                  id="ownerName"
                  autoComplete="name"
                  placeholder="e.g. Dave Smith"
                  value={form.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tradeType">Trade *</Label>
                <Select
                  value={form.tradeType}
                  onValueChange={(v) => set("tradeType", v)}
                >
                  <SelectTrigger id="tradeType">
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@yourbusiness.co.uk"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Business phone</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. 07700 900123"
                  value={form.phoneNumber}
                  onChange={(e) => set("phoneNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyNumber">
                  Emergency forwarding number *
                </Label>
                <Input
                  id="emergencyNumber"
                  type="tel"
                  required
                  placeholder="Your mobile for emergencies"
                  value={form.emergencyNumber}
                  onChange={(e) => set("emergencyNumber", e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              By signing up you agree to our Terms & Privacy Policy. Your
              profile and telephony row are created automatically. Next
              you&apos;ll set services, areas and the booking link — the same
              form lives in Settings.
            </p>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              Create account & continue
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-emerald-400 hover:underline"
              >
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
