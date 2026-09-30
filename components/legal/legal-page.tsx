import type { Metadata } from "next";
import Link from "next/link";
import { PhoneCall, Scale } from "lucide-react";

/**
 * Shared page template for the legal documents (Terms of Service,
 * Privacy Policy). Renders the standard SiteRing chrome — header, contents
 * rail, section typography and footer links — so each document only
 * supplies its own prose.
 */

export type LegalSection = {
  id: string;
  heading: string;
  body: React.ReactNode;
};

export type LegalDocument = {
  title: string;
  description: string;
  lastUpdated: string; // ISO date
  sections: LegalSection[];
};

export function legalMetadata(doc: LegalDocument): Metadata {
  return {
    title: doc.title,
    description: doc.description,
  };
}

export function LegalPage({ doc }: { doc: LegalDocument }) {
  const updated = new Date(doc.lastUpdated).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative min-h-screen bg-background">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]" />

      <header className="relative border-b border-border/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <PhoneCall size={18} />
            </span>
            <span className="text-lg font-bold tracking-tight">
              SiteRing <span className="text-emerald-400">AI</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Back to site
          </Link>
        </div>
      </header>

      <main className="container relative py-12">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25">
              <Scale size={20} />
            </span>
            <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Legal
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            {doc.title}
          </h1>
          <p className="mt-3 text-muted-foreground">{doc.description}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {updated}
          </p>

          <nav
            aria-label="Contents"
            className="mt-8 rounded-2xl border border-border bg-card/60 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Contents
            </p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {doc.sections.map((section, i) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-muted-foreground transition-colors hover:text-emerald-400"
                  >
                    {i + 1}. {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10 pb-8">
            {doc.sections.map((section, i) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-xl font-bold tracking-tight">
                  <span className="mr-2 text-emerald-400">{i + 1}.</span>
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_a]:font-semibold [&_a]:text-emerald-400 [&_a:hover]:underline [&_li]:ml-5 [&_li]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:text-muted-foreground [&_strong]:text-foreground">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <footer className="border-t border-border/60 py-8">
            <p className="text-sm text-muted-foreground">
              Questions about this document? Email{" "}
              <a href="mailto:legal@sitering.ai">legal@sitering.ai</a> or write
              to SiteRing AI Ltd, United Kingdom.
            </p>
            <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <Link href="/terms" className="font-semibold text-emerald-400 hover:underline">
                Terms of Service
              </Link>
              <Link href="/privacy" className="font-semibold text-emerald-400 hover:underline">
                Privacy Policy
              </Link>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
              <Link href="/onboarding" className="hover:text-foreground">
                Sign up
              </Link>
              <Link href="/login" className="hover:text-foreground">
                Log in
              </Link>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
