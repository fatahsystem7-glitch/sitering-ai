"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, Lock, Mail, PhoneCall } from "lucide-react";
import {
  loginWithClientId,
  requestPasswordReset,
  signIn,
} from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Three entry points on one screen:
 *
 *  • login    — Supabase Auth email + password (accounts since migration 08).
 *  • forgot   — email a password-reset link.
 *  • clientid — the legacy Client ID, kept for accounts created before email
 *               login existed. `/login?client_id=…` lands straight here, so
 *               the links in older onboarding emails keep working.
 */
type Mode = "login" | "forgot" | "clientid";

const HEADINGS: Record<Mode, { title: string; description: string }> = {
  login: {
    title: "Welcome back",
    description: "Log in with the email and password you created at signup.",
  },
  forgot: {
    title: "Reset your password",
    description:
      "Enter the email you signed up with and we'll send you a reset link.",
  },
  clientid: {
    title: "Log in with your Client ID",
    description:
      "For accounts set up before email login — enter the Client ID from your onboarding email.",
  },
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>(
    searchParams.get("client_id") ? "clientid" : "login",
  );

  // Email + password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Legacy Client ID
  const [clientId, setClientId] = useState(searchParams.get("client_id") ?? "");
  const [clientIdLoading, setClientIdLoading] = useState(false);
  const [clientIdError, setClientIdError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = new FormData();
      body.set("email", email);
      body.set("password", password);
      body.set("next", next.startsWith("/") ? next : "/dashboard");

      const result = await signIn(body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong signing in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);
    try {
      const body = new FormData();
      body.set("email", resetEmail);
      const result = await requestPasswordReset(body);
      if (!result.ok) {
        setResetError(result.error);
        return;
      }
      setResetSent(true);
    } catch {
      setResetError("Something went wrong. Please try again.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleClientId(e: React.FormEvent) {
    e.preventDefault();
    setClientIdError(null);
    setClientIdLoading(true);
    try {
      const result = await loginWithClientId(clientId);
      if (!result.ok) {
        setClientIdError(result.error);
        return;
      }
      router.push(result.redirectTo);
      router.refresh();
    } catch {
      setClientIdError("Something went wrong signing in. Please try again.");
    } finally {
      setClientIdLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    if (mode === "forgot") return handleReset(e);
    if (mode === "clientid") return handleClientId(e);
    return handleSubmit(e);
  }

  function switchTo(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setResetError(null);
    setClientIdError(null);
  }

  const heading = HEADINGS[mode];
  const activeError = mode === "forgot" ? resetError : mode === "clientid" ? clientIdError : error;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Link
          href="/"
          className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
        >
          <PhoneCall size={20} />
        </Link>
        <CardTitle className="text-2xl">{heading.title}</CardTitle>
        <CardDescription>{heading.description}</CardDescription>
      </CardHeader>

      <form onSubmit={submit}>
        <CardContent className="space-y-4">
          {activeError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {activeError}
            </p>
          )}

          {mode === "login" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@yourbusiness.co.uk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetSent(false);
                      switchTo("forgot");
                    }}
                    className="text-xs font-medium text-emerald-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </>
          )}

          {mode === "forgot" &&
            (resetSent ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300">
                If an account exists for that email, a reset link is on its way.
                Check your inbox (and spam folder) — the link expires in an hour.
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="reset_email">Email</Label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="reset_email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@yourbusiness.co.uk"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            ))}

          {mode === "clientid" && (
            <div className="space-y-2">
              <Label htmlFor="client_id">Client ID</Label>
              <div className="relative">
                <KeyRound
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="client_id"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="3f2b8c10-9e7a-4a51-8d0e-6c1b2a9f4d33"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="pl-10 font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                It&apos;s the 36-character code shown at the end of onboarding and
                emailed to you.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={
              mode === "forgot"
                ? resetLoading
                : mode === "clientid"
                  ? clientIdLoading
                  : loading
            }
          >
            {((mode === "forgot" && resetLoading) ||
              (mode === "clientid" && clientIdLoading) ||
              (mode === "login" && loading)) && (
              <Loader2 className="animate-spin" size={16} />
            )}
            {mode === "forgot"
              ? resetSent
                ? "Check your inbox"
                : "Send reset link"
              : mode === "clientid"
                ? "Open my dashboard"
                : "Log in"}
          </Button>

          {mode === "login" && (
            <>
              <p className="text-sm text-muted-foreground">
                No account yet?{" "}
                <Link
                  href="/signup"
                  className="font-semibold text-emerald-400 hover:underline"
                >
                  Sign up
                </Link>{" "}
                — it takes about five minutes.
              </p>
              <button
                type="button"
                onClick={() => switchTo("clientid")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Set up before email login? Use your Client ID
              </button>
            </>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => switchTo("login")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to log in
            </button>
          )}

          {mode === "clientid" && (
            <button
              type="button"
              onClick={() => switchTo("login")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to email login
            </button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[100px]" />
      <Suspense>
        <div className="relative w-full max-w-md">
          <LoginForm />
        </div>
      </Suspense>
    </div>
  );
}
