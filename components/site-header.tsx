"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#trades", label: "Trades" },
];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href={signedIn ? "/dashboard" : "/login"} className="hidden text-sm font-medium md:inline">
            {signedIn ? "Dashboard" : "Log in"}
          </Link>
          <Link
            href={signedIn ? "/dashboard/settings" : "/signup"}
            className="hidden rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper md:inline"
          >
            {signedIn ? "Settings" : "Get the line"}
          </Link>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-line md:hidden"
            aria-label="Open menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="block h-0.5 w-4 bg-ink" />
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-line px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Dashboard" : "Log in"}</Link>
            <Link href="/signup" className="font-semibold">
              Get the line — £150/month
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
