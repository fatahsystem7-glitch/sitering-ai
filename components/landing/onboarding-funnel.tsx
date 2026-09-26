"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Loader2,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TRADES = [
  "Plumbing",
  "Electrical",
  "Heating & Gas",
  "General Building",
  "Roofing",
  "Joinery & Carpentry",
  "Painting & Decorating",
  "Locksmith",
  "Landscaping",
  "Other Trade",
];

const SERVICE_OPTIONS = [
  "Custom website",
  "Automated lead capture",
  "Online booking form",
  "Missed-call text-back",
  "24/7 AI receptionist",
];

const TOTAL_STEPS = 4;

const STEP_META = [
  { title: "About your business", description: "Let's start with the basics." },
  { title: "How can we reach you?", description: "We'll send your setup details here." },
  { title: "What do you need?", description: "Pick everything you'd like set up." },
  { title: "Review & submit", description: "Check it over and we'll take it from here." },
];

type FormState = {
  business_name: string;
  trade_type: string;
  contact_name: string;
  email: string;
  phone_number: string;
  service_requirements: string[];
  service_area: string;
  message: string;
};

const INITIAL: FormState = {
  business_name: "",
  trade_type: "",
  contact_name: "",
  email: "",
  phone_number: "",
  service_requirements: ["Custom website", "Automated lead capture", "Missed-call text-back"],
  service_area: "",
  message: "",
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function OnboardingFunnel() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleService(name: string) {
    setForm((f) => ({
      ...f,
      service_requirements: f.service_requirements.includes(name)
        ? f.service_requirements.filter((s) => s !== name)
        : [...f.service_requirements, name],
    }));
  }

  function validate(current: number): string | null {
    if (current === 1) {
      if (!form.business_name.trim()) return "Please enter your business name.";
      if (!form.trade_type) return "Please select your trade.";
    }
    if (current === 2) {
      if (!form.contact_name.trim()) return "Please enter your name.";
      if (!EMAIL_RE.test(form.email.trim()))
        return "Please enter a valid email address.";
      if (!form.phone_number.trim()) return "Please enter a contact number.";
    }
    if (current === 3) {
      if (form.service_requirements.length === 0)
        return "Please choose at least one service.";
    }
    return null;
  }

  function next() {
    const err = validate(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function submit() {
    for (let s = 1; s <= 3; s += 1) {
      const err = validate(s);
      if (err) {
        setError(err);
        setStep(s);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          business_name: form.business_name.trim(),
          trade_type: form.trade_type,
          contact_name: form.contact_name.trim(),
          email: form.email.trim(),
          phone_number: form.phone_number.trim(),
          service_requirements: form.service_requirements,
          service_area: form.service_area.trim(),
          message: form.message.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const pct = Math.round((step / TOTAL_STEPS) * 100);

  if (done) {
    return (
      <Card className="card-glow relative w-full overflow-hidden border-emerald-500/30">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <PartyPopper size={30} />
          </span>
          <h3 className="mt-5 text-2xl font-bold">You&apos;re in! 🎉</h3>
          <p className="mt-2 max-w-md text-muted-foreground">
            Thanks {form.contact_name.split(" ")[0] || "there"} — we&apos;ve
            received your details for{" "}
            <span className="font-semibold text-foreground">
              {form.business_name}
            </span>{" "}
            and our team will be in touch within one business day to start your
            build.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">
                Create your account <ArrowRight size={18} />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#top">Back to top</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const meta = STEP_META[step - 1];

  return (
    <Card className="card-glow w-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Step {step} of {TOTAL_STEPS}
          </span>
          <span>{pct}% complete</span>
        </div>
        <Progress value={pct} />
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            {step === TOTAL_STEPS && (
              <Sparkles size={18} className="text-emerald-400" />
            )}
            {meta.title}
          </CardTitle>
          <CardDescription className="mt-1">{meta.description}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business name *</Label>
              <Input
                id="business_name"
                placeholder="e.g. AquaFix Plumbing Ltd"
                value={form.business_name}
                onChange={(e) => set("business_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade_type">Trade type *</Label>
              <Select
                value={form.trade_type}
                onValueChange={(v) => set("trade_type", v)}
              >
                <SelectTrigger id="trade_type">
                  <SelectValue placeholder="Select your trade" />
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
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Your name *</Label>
              <Input
                id="contact_name"
                autoComplete="name"
                placeholder="e.g. Dave Sutcliffe"
                value={form.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@yourbusiness.co.uk"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Mobile number *</Label>
              <Input
                id="phone_number"
                type="tel"
                autoComplete="tel"
                placeholder="e.g. 07700 900123"
                value={form.phone_number}
                onChange={(e) => set("phone_number", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Services you&apos;re interested in *</Label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {SERVICE_OPTIONS.map((name) => {
                  const active = form.service_requirements.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleService(name)}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        active
                          ? "border-emerald-500/60 bg-emerald-500/10 text-foreground"
                          : "border-border bg-card/40 text-muted-foreground hover:border-emerald-500/30 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                          active
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border",
                        )}
                      >
                        {active && <Check size={14} />}
                      </span>
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_area">Coverage area / town</Label>
              <Input
                id="service_area"
                placeholder="e.g. Bradford & surrounding areas"
                value={form.service_area}
                onChange={(e) => set("service_area", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Anything else? (optional)</Label>
              <Textarea
                id="message"
                rows={3}
                placeholder="Tell us about your current setup or what you're hoping to achieve…"
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* STEP 4 — Review */}
        {step === 4 && (
          <div className="space-y-4">
            <dl className="divide-y divide-border rounded-xl border border-border bg-card/40">
              <ReviewRow label="Business" value={form.business_name} />
              <ReviewRow label="Trade" value={form.trade_type} />
              <ReviewRow label="Name" value={form.contact_name} />
              <ReviewRow label="Email" value={form.email} />
              <ReviewRow label="Mobile" value={form.phone_number} />
              <ReviewRow
                label="Services"
                value={form.service_requirements.join(", ")}
              />
              {form.service_area && (
                <ReviewRow label="Coverage" value={form.service_area} />
              )}
              {form.message && (
                <ReviewRow label="Notes" value={form.message} />
              )}
            </dl>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <BadgeCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
              By submitting you agree to be contacted about your setup. No
              payment required now — we build first, you go live when you&apos;re
              happy.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}
      </CardContent>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 p-6">
        {step > 1 ? (
          <Button variant="ghost" onClick={back} disabled={loading}>
            <ArrowLeft size={16} /> Back
          </Button>
        ) : (
          <span />
        )}
        {step < TOTAL_STEPS ? (
          <Button onClick={next}>
            Continue <ArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            Complete signup <Check size={16} />
          </Button>
        )}
      </div>
    </Card>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-sm">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
