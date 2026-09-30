import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentClient } from "@/lib/client-session";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const client = await getCurrentClient();
  if (!client) redirect("/login?next=/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader client={client} />
      <main className="container flex-1 py-8">{children}</main>
      <footer className="border-t border-border/60 py-6">
        <div className="container flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} SiteRing AI Ltd</p>
          <nav className="flex flex-wrap items-center gap-5">
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <a href="mailto:support@sitering.ai" className="hover:text-foreground">
              Support
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
