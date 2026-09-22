import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Benefits } from "@/components/landing/benefits";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Benefits />
        <HowItWorks />
        <Pricing />
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
                Join UK contractors who never miss a lead. Live in minutes, free
                for 7 days.
              </p>
              <Button size="lg" className="mt-8" asChild>
                <Link href="/signup">
                  Start 7-Day Trial <ArrowRight size={18} />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
