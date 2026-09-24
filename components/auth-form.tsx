"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/paths";

export function AuthForm({ mode, nextPath }: { mode: "login" | "signup"; nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const destination = safeNextPath(nextPath, mode === "signup" ? "/onboarding" : "/dashboard");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const origin = window.location.origin;
        const { data, error: signError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(destination)}` },
        });
        if (signError) throw signError;
        if (data.session) {
          router.push(destination);
          router.refresh();
          return;
        }
        setNotice("Check your email to confirm the account, then come back to finish setup.");
      } else {
        const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
        if (signError) throw signError;
        router.push(destination);
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        Email
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-line px-4 py-3" />
      </label>
      <label className="block text-sm font-medium">
        Password
        <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-2xl border border-line px-4 py-3" />
      </label>
      {error ? <p className="text-sm text-signal">{error}</p> : null}
      {notice ? <p className="text-sm text-pine">{notice}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-ink py-3 text-sm font-semibold text-paper disabled:opacity-60">
        {pending ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
      <p className="text-sm text-muted">
        {mode === "signup" ? (
          <>Already have a line? <Link href="/login" className="font-semibold text-ink">Log in</Link></>
        ) : (
          <>New contractor? <Link href="/signup" className="font-semibold text-ink">Get the line</Link></>
        )}
      </p>
    </form>
  );
}
