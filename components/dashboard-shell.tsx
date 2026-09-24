import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatUkPhone } from "@/lib/phone";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/calls", label: "Calls" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardShell({
  children,
  businessName,
  phoneNumber,
  email,
}: {
  children: React.ReactNode;
  businessName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Logo compact />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{businessName || email}</span>
            <ThemeToggle />
            <form action="/api/auth/signout" method="post">
              <button className="rounded-full border border-line px-3 py-2" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 md:grid-cols-[200px_1fr]">
        <aside className="space-y-6">
          <nav className="flex gap-2 md:flex-col">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-full px-3 py-2 text-sm hover:bg-card">
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="text-sm text-muted">
            Line<br />
            <span className="font-medium text-ink">{phoneNumber ? formatUkPhone(phoneNumber) : "Not assigned"}</span>
          </p>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
