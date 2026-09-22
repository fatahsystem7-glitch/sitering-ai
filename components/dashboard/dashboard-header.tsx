import Link from "next/link";
import { LogOut, PhoneCall, Settings } from "lucide-react";
import { signOut } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Profile, TelephonyProvisioning } from "@/lib/supabase/types";

interface Props {
  profile: Profile;
  telephony: TelephonyProvisioning | null;
}

export function DashboardHeader({ profile, telephony }: Props) {
  const isActive =
    profile.subscription_status === "active" ||
    profile.subscription_status === "trialing";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="container flex min-h-[4rem] flex-wrap items-center gap-3 py-3">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <PhoneCall size={18} />
          </span>
          <span className="hidden text-lg font-bold tracking-tight sm:inline">
            SiteRing <span className="text-emerald-400">AI</span>
          </span>
        </Link>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {profile.business_name}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {telephony?.assigned_phone_number ?? "Provisioning your UK number…"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isActive ? (
            <Badge>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              AI Active
            </Badge>
          ) : (
            <Badge variant="warning">Trial / Inactive</Badge>
          )}

          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/settings">
              <Settings size={16} />
              <span className="hidden sm:inline">Settings</span>
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
