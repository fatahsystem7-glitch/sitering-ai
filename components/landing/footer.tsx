import Link from "next/link";
import { PhoneCall } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60 py-12">
      <div className="container flex flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <PhoneCall size={16} />
          </span>
          <span className="font-bold tracking-tight">
            SiteRing <span className="text-emerald-400">AI</span>
          </span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href="#benefits" className="hover:text-foreground">
            Benefits
          </Link>
          <Link href="#pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="#faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Log in
          </Link>
          <Link href="/signup" className="hover:text-foreground">
            Sign up
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          © {year} SiteRing AI Ltd. Built for UK trades.
        </p>
      </div>
    </footer>
  );
}
