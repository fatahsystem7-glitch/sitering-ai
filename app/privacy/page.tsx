import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="serif text-4xl">Privacy</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
          <p>SiteRing stores the business profile you enter, the calls answered on your number, and callback messages. That data is used to run the receptionist and show it back to you.</p>
          <p>Call audio is processed by Twilio, LiveKit, Cartesia, and OpenAI to transcribe, decide a reply, and speak it. Do not ask callers for card numbers or passwords; the receptionist is instructed not to collect them.</p>
          <p>This page is a product summary, not a substitute for a solicitor-drafted privacy notice before you take paying customers.</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
