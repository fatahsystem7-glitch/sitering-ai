import Link from "next/link";
import { ArrowRight, PhoneCall } from "lucide-react";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { Solution } from "@/components/landing/solution";
import { DemoCall } from "@/components/landing/demo-call";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { getDemoPhoneNumber, telHref } from "@/lib/demo-phone";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const demoNumber = await getDemoPhoneNumber();
  const demoTel = telHref(demoNumber);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* 1. Direct-response headline + subheadline */}
        <Hero demoNumber={demoNumber} demoTel={demoTel} />
        {/* 2. The Problem — missed calls = lost money */}
        <Problem />
        {/* 3. The Solution — 24/7 AI receptionist */}
        <Solution />
        {/* 4. Live Test Call demonstration */}
        <DemoCall demoNumber={demoNumber} demoTel={demoTel} />
        {/* 5. How it works — 3-step setup */}
        <HowItWorks />
        {/* 6. Pricing + direct buy */}
        <Pricing />
        {/* 7. FAQ & Guarantees */}
        <Faq />

        {/* Final CTA */}
        <section className="container py-16 md:py-24">
          <div className="card-glow relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-transparent p-10 text-center md:p-16">
            <div className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
                Your next £500 job is ringing right now.{" "}
                <span className="text-gradient">Answer it.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Call the live demo and hear it for yourself — or get SiteRing AI
                working for your business today.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <a href={demoTel}>
                    <PhoneCall size={18} /> Call {demoNumber}
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/signup">
                    Get SiteRing AI <ArrowRight size={18} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
