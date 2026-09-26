"use client";

import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <PhoneCall size={18} />
          </span>
          <span className="text-lg font-bold tracking-tight">
            SiteRing <span className="text-emerald-400">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex">
          <Link
            href="#problem"
            className="transition-colors hover:text-foreground"
          >
            The Problem
          </Link>
          <Link
            href="#solution"
            className="transition-colors hover:text-foreground"
          >
            The Solution
          </Link>
          <Link
            href="#services"
            className="transition-colors hover:text-foreground"
          >
            What You Get
          </Link>
          <Link
            href="#live-demo"
            className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
          >
            Live Demo Call
          </Link>
          <Link
            href="#pricing"
            className="transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
          <Link href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden sm:inline-flex"
          >
            <Link href="/login">Log in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/onboarding">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
