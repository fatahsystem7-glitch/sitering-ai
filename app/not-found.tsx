import Link from "next/link";
import { PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <PhoneOff size={26} />
      </span>
      <h1 className="text-3xl font-bold tracking-tight">
        Line&apos;s dead — 404
      </h1>
      <p className="max-w-sm text-muted-foreground">
        This page doesn&apos;t exist. Unlike our AI receptionist, it can&apos;t
        take a message.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
