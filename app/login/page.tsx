import { SiteHeader } from "@/components/site-header";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-deep">Account</p>
        <h1 className="serif mt-3 text-4xl">Log in</h1>
        <p className="mt-2 text-sm text-muted">Back to the line, the calls, and the prices the receptionist is allowed to quote.</p>
        <div className="mt-8">
          <AuthForm mode="login" nextPath={params.next} />
        </div>
      </main>
    </>
  );
}
