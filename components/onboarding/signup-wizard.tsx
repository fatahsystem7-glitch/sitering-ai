"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Copy,
  FileCheck2,
  Loader2,
  ShieldCheck,
  Upload,
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
  "Emergency callouts",
  "Repairs & maintenance",
  "Installations",
  "Quotes & surveys",
  "Servicing contracts",
  "Commercial work",
];

const GREETING_STYLES = [
  "Friendly and casual",
  "Professional and formal",
  "Short and to the point",
];

const ID_TYPES = ["Passport", "UK Driving Licence", "National ID Card"];

const TOTAL_STEPS = 5;

const STEP_META = [
  {
    title: "Your business",
    description: "The basics about the company your AI receptionist answers for.",
  },
  {
    title: "Your account",
    description: "Where we send your Client ID and what we forward emergencies to.",
  },
  {
    title: "Registered address",
    description: "Telnyx requires a UK address that matches your proof of address.",
  },
  {
    title: "Receptionist setup",
    description: "How your AI should answer and what it should know.",
  },
  {
    title: "Identity verification",
    description: "Required by Telnyx before we can issue your phone number.",
  },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.pdf,image/*,application/pdf";

type FormState = {
  business_name: string;
  trade_type: string;
  company_number: string;
  vat_number: string;
  owner_name: string;
  email: string;
  phone_number: string;
  emergency_forwarding_number: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  service_areas: string;
  services_offered: string[];
  operating_hours: string;
  callout_fee: string;
  greeting_style: string;
  custom_instructions: string;
  id_document_type: string;
  consent: boolean;
};

const INITIAL: FormState = {
  business_name: "",
  trade_type: "",
  company_number: "",
  vat_number: "",
  owner_name: "",
  email: "",
  phone_number: "",
  emergency_forwarding_number: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  service_areas: "",
  services_offered: ["Emergency callouts", "Repairs & maintenance", "Quotes & surveys"],
  operating_hours: "Mon–Fri 8am–6pm, emergencies 24/7",
  callout_fee: "",
  greeting_style: "Friendly and casual",
  custom_instructions: "",
  id_document_type: "Passport",
  consent: false,
};

function FileField({
  id,
  label,
  hint,
  file,
  onPick,
}: {
  id: string;
  label: string;
  hint: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <span className="text-red-400">*</span>
      </Label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-left transition",
          file
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-border bg-muted/20 hover:border-emerald-500/40 hover:bg-emerald-500/5",
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            file
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          {file ? <FileCheck2 size={18} /> : <Upload size={18} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {file ? file.name : "Choose a file or take a photo"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {file
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB · tap to replace`
              : hint}
          </span>
        </span>
      </button>
    </div>
  );
}

export function SignupWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [poaDoc, setPoaDoc] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleService(name: string) {
    setForm((f) => ({
      ...f,
      services_offered: f.services_offered.includes(name)
        ? f.services_offered.filter((s) => s !== name)
        : [...f.services_offered, name],
    }));
  }

  function validate(current: number): string | null {
    if (current === 1) {
      if (form.business_name.trim().length < 2)
        return "Please enter your business name.";
      if (!form.trade_type) return "Please select your trade.";
    }
    if (current === 2) {
      if (form.owner_name.trim().length < 2) return "Please enter your full name.";
      if (!EMAIL_RE.test(form.email.trim()))
        return "Please enter a valid email address.";
      if (form.phone_number.trim().length < 6)
        return "Please enter a contact number.";
    }
    if (current === 3) {
      if (form.address_line1.trim().length < 2)
        return "Please enter the first line of your address.";
      if (form.city.trim().length < 2) return "Please enter your town or city.";
      if (form.postcode.trim().length < 3) return "Please enter your postcode.";
    }
    if (current === 4) {
      if (form.services_offered.length === 0)
        return "Pick at least one service your AI should handle.";
    }
    if (current === 5) {
      for (const [file, label] of [
        [idDoc, "a copy of your passport or driving licence"],
        [poaDoc, "a copy of your proof of address"],
      ] as const) {
        if (!file) return `Please upload ${label}.`;
        if (file.size > MAX_FILE_BYTES)
          return "Each document must be 10 MB or smaller.";
      }
      if (!form.consent)
        return "Please confirm the declaration so we can verify your number.";
    }
    return null;
  }

  function next() {
    const issue = validate(step);
    if (issue) return setError(issue);
    setError(null);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    const issue = validate(5);
    if (issue) return setError(issue);

    setError(null);
    setLoading(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "services_offered") return;
        body.append(key, typeof value === "string" ? value : String(value));
      });
      form.services_offered.forEach((s) => body.append("services_offered", s));
      body.append("id_document", idDoc as File);
      body.append("proof_of_address", poaDoc as File);

      const res = await fetch("/api/onboarding", { method: "POST", body });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        const details = json?.details as Record<string, string[]> | undefined;
        const first = details ? Object.values(details)[0]?.[0] : undefined;
        throw new Error(
          first ?? json?.error ?? "Something went wrong. Please try again.",
        );
      }

      setClientId(json.client_id as string);
      setWarning((json.warning as string) ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyId() {
    if (!clientId) return;
    try {
      await navigator.clipboard.writeText(clientId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the ID is on screen to copy manually */
    }
  }

  // ── Success screen ────────────────────────────────────────────
  if (clientId) {
    return (
      <Card className="card-glow border-emerald-500/30">
        <CardHeader>
          <span className="bg-emerald-500/12 mb-2 flex h-12 w-12 items-center justify-center rounded-xl text-emerald-400 ring-1 ring-emerald-500/25">
            <BadgeCheck size={24} />
          </span>
          <CardTitle className="text-2xl">You&apos;re all set up</CardTitle>
          <CardDescription>
            Your account and documents are saved. Verification with Telnyx
            usually completes within one working day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Your Client ID — this is your dashboard login
            </p>
            <p className="mt-2 break-all font-mono text-lg font-bold">{clientId}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyId}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy Client ID"}
              </Button>
              <Button size="sm" asChild>
                <Link href={`/login?client_id=${clientId}`}>
                  Go to my dashboard <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Save this ID somewhere safe — it&apos;s the only credential you need
            to log into your dashboard. We&apos;ve also emailed a copy to{" "}
            <span className="font-medium text-foreground">{form.email}</span>.
          </p>

          {warning && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-300">
              {warning}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const meta = STEP_META[step - 1];

  return (
    <Card className="card-glow">
      <CardHeader>
        <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <span>
            Step {step} of {TOTAL_STEPS}
          </span>
          <span className="text-emerald-400">Free setup</span>
        </div>
        <Progress value={(step / TOTAL_STEPS) * 100} />
        <CardTitle className="pt-4 text-xl">{meta.title}</CardTitle>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
            {error}
          </p>
        )}

        {/* ── Step 1 · Business ── */}
        {step === 1 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="business_name">
                Business name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="business_name"
                placeholder="e.g. Baxter Plumbing & Heating Ltd"
                value={form.business_name}
                onChange={(e) => set("business_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Trade <span className="text-red-400">*</span>
              </Label>
              <Select
                value={form.trade_type}
                onValueChange={(v) => set("trade_type", v)}
              >
                <SelectTrigger>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_number">Company number</Label>
                <Input
                  id="company_number"
                  placeholder="Optional · 12345678"
                  value={form.company_number}
                  onChange={(e) => set("company_number", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat_number">VAT number</Label>
                <Input
                  id="vat_number"
                  placeholder="Optional · GB123456789"
                  value={form.vat_number}
                  onChange={(e) => set("vat_number", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* ── Step 2 · Account ── */}
        {step === 2 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="owner_name">
                Your full name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="owner_name"
                autoComplete="name"
                placeholder="As it appears on your ID"
                value={form.owner_name}
                onChange={(e) => set("owner_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-400">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@yourbusiness.co.uk"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone_number">
                  Mobile number <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="phone_number"
                  type="tel"
                  autoComplete="tel"
                  placeholder="07700 900123"
                  value={form.phone_number}
                  onChange={(e) => set("phone_number", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_forwarding_number">
                  Emergency forwarding number
                </Label>
                <Input
                  id="emergency_forwarding_number"
                  type="tel"
                  placeholder="Defaults to your mobile"
                  value={form.emergency_forwarding_number}
                  onChange={(e) =>
                    set("emergency_forwarding_number", e.target.value)
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Urgent calls are put straight through to your emergency number —
              everything else is captured as a lead in your dashboard.
            </p>
          </>
        )}

        {/* ── Step 3 · Address ── */}
        {step === 3 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="address_line1">
                Address line 1 <span className="text-red-400">*</span>
              </Label>
              <Input
                id="address_line1"
                autoComplete="address-line1"
                placeholder="12 Victoria Road"
                value={form.address_line1}
                onChange={(e) => set("address_line1", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line2">Address line 2</Label>
              <Input
                id="address_line2"
                autoComplete="address-line2"
                placeholder="Optional"
                value={form.address_line2}
                onChange={(e) => set("address_line2", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">
                  Town / city <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="city"
                  autoComplete="address-level2"
                  placeholder="Leeds"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">
                  Postcode <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="postcode"
                  autoComplete="postal-code"
                  placeholder="LS1 4AP"
                  value={form.postcode}
                  onChange={(e) => set("postcode", e.target.value)}
                />
              </div>
            </div>
            <p className="rounded-xl border border-border bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
              Telnyx must match this address to the proof of address you upload
              in the final step, so please use your registered business or home
              address.
            </p>
          </>
        )}

        {/* ── Step 4 · Receptionist profile ── */}
        {step === 4 && (
          <>
            <div className="space-y-2">
              <Label>
                What should the AI handle? <span className="text-red-400">*</span>
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {SERVICE_OPTIONS.map((s) => {
                  const active = form.services_offered.includes(s);
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleService(s)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm transition",
                        active
                          ? "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                          : "border-border bg-muted/20 text-muted-foreground hover:border-emerald-500/30",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                          active
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border",
                        )}
                      >
                        {active && <Check size={13} />}
                      </span>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="service_areas">Areas you cover</Label>
                <Input
                  id="service_areas"
                  placeholder="Leeds, Bradford, Wakefield"
                  value={form.service_areas}
                  onChange={(e) => set("service_areas", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="callout_fee">Callout fee</Label>
                <Input
                  id="callout_fee"
                  placeholder="£75 + VAT"
                  value={form.callout_fee}
                  onChange={(e) => set("callout_fee", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="operating_hours">Working hours</Label>
              <Input
                id="operating_hours"
                placeholder="Mon–Fri 8am–6pm, emergencies 24/7"
                value={form.operating_hours}
                onChange={(e) => set("operating_hours", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Greeting style</Label>
              <Select
                value={form.greeting_style}
                onValueChange={(v) => set("greeting_style", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a tone" />
                </SelectTrigger>
                <SelectContent>
                  {GREETING_STYLES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom_instructions">
                Anything else the AI should know?
              </Label>
              <Textarea
                id="custom_instructions"
                rows={4}
                placeholder="e.g. We don't take on new-build work. Always ask for a postcode and whether there's water leaking."
                value={form.custom_instructions}
                onChange={(e) => set("custom_instructions", e.target.value)}
              />
            </div>
          </>
        )}

        {/* ── Step 5 · Telnyx verification uploads ── */}
        {step === 5 && (
          <>
            <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
              <p className="text-xs text-muted-foreground">
                UK telecoms regulation means our carrier{" "}
                <span className="font-semibold text-foreground">Telnyx</span>{" "}
                must verify who a phone number is issued to. Your documents are
                stored encrypted in a private bucket, used only for
                verification, and never shared.
              </p>
            </div>

            <div className="space-y-2">
              <Label>ID document type</Label>
              <Select
                value={form.id_document_type}
                onValueChange={(v) => set("id_document_type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FileField
              id="id_document"
              label="Copy of your ID (passport or driving licence)"
              hint="JPG, PNG, HEIC or PDF · max 10 MB · all four corners visible"
              file={idDoc}
              onPick={setIdDoc}
            />

            <FileField
              id="proof_of_address"
              label="Copy of your proof of address"
              hint="Utility bill, council tax or bank statement from the last 3 months"
              file={poaDoc}
              onPick={setPoaDoc}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-emerald-500"
                checked={form.consent}
                onChange={(e) => set("consent", e.target.checked)}
              />
              <span className="text-xs text-muted-foreground">
                I confirm these documents are genuine and belong to me, and I
                consent to SiteRing AI sharing them with Telnyx for the sole
                purpose of verifying and issuing my business phone number.
              </span>
            </label>
          </>
        )}
      </CardContent>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 p-6 pt-5">
        {step > 1 ? (
          <Button variant="ghost" onClick={back} disabled={loading}>
            <ArrowLeft size={16} /> Back
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Already onboarded?{" "}
            <Link href="/login" className="font-semibold text-emerald-400 hover:underline">
              Log in with your Client ID
            </Link>
          </span>
        )}

        {step < TOTAL_STEPS ? (
          <Button onClick={next}>
            Continue <ArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="animate-spin" size={16} />}
            {loading ? "Creating your account…" : "Create my account"}
          </Button>
        )}
      </div>
    </Card>
  );
}
