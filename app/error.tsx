"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/25">
        <TriangleAlert size={26} />
      </span>
      <h1 className="text-3xl font-bold tracking-tight">
        Something dropped the call
      </h1>
      <p className="max-w-sm text-muted-foreground">
        An unexpected error occurred. Try again — if it persists, contact
        support.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
