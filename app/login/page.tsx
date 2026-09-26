"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, PhoneCall } from "lucide-react";
import { loginWithClientId } from "@/app/login/actions";
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [clientId, setClientId] = useState(searchParams.get("client_id") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await loginWithClientId(clientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(next.startsWith("/dashboard") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong signing in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Link
          href="/"
          className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
        >
          <PhoneCall size={20} />
        </Link>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Log in with the Client ID you received when you onboarded.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}
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
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" size={16} />}
            Open my dashboard
          </Button>
          <p className="text-sm text-muted-foreground">
            No account yet?{" "}
            <Link
              href="/onboarding"
              className="font-semibold text-emerald-400 hover:underline"
            >
              Start onboarding
            </Link>
          </p>
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
