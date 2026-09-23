"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe,
  LogOut,
  MessagesSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { signOut } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview", icon: ShieldCheck, exact: true },
  { href: "/admin/customers", label: "Customers", icon: Users, exact: false },
  {
    href: "/admin/conversations",
    label: "Conversations",
    icon: MessagesSquare,
    exact: false,
  },
];

export function AdminHeader({ adminName }: { adminName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="container flex min-h-[4rem] flex-wrap items-center gap-3 py-3">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500 text-white shadow-lg shadow-violet-500/30">
            <ShieldCheck size={18} />
          </span>
          <span className="hidden text-lg font-bold tracking-tight sm:inline">
            SiteRing <span className="text-violet-400">Admin</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 rounded-xl bg-muted/50 p-1">
          {TABS.map((t) => {
            const active = t.exact
              ? pathname === t.href
              : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon size={15} />
                <span className="hidden md:inline">{t.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2">
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {adminName}
          </Badge>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <Globe size={16} />
              <span className="hidden sm:inline">View site</span>
            </Link>
          </Button>
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
