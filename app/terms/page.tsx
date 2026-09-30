import { LegalPage, legalMetadata, type LegalDocument } from "@/components/legal/legal-page";

const legalDoc: LegalDocument = {
  title: "Terms of Service",
  description:
    "The agreement between you and SiteRing AI Ltd when you use our AI receptionist service.",
  lastUpdated: "2026-09-30",
  sections: [
    {
      id: "agreement",
      heading: "Agreement to these terms",
      body: (
        <>
          <p>
            These Terms of Service (&quot;Terms&quot;) form a binding agreement between
            you and SiteRing AI Ltd (&quot;SiteRing&quot;, &quot;we&quot;, &quot;us&quot;), a
            company registered in the United Kingdom. By creating an account,
            completing our onboarding form, or using our service in any way, you
            accept these Terms.
          </p>
          <p>
            If you are accepting on behalf of a business, you confirm you have
            authority to bind that business to these Terms.
          </p>
        </>
      ),
    },
    {
      id: "service",
      heading: "What we provide",
      body: (
        <>
          <p>
            SiteRing AI provides an AI-powered telephone receptionist service for
            UK trade businesses. The service includes:
          </p>
          <ol>
            <li>
              A dedicated UK phone number, provisioned through our carrier
              partner Twilio, that answers calls on behalf of your business.
            </li>
            <li>
              AI call handling: greeting callers, capturing job details,
              classifying urgency, and sending you alerts and transcripts.
            </li>
            <li>
              A dashboard where you can review call logs, messages and settings.
            </li>
          </ol>
          <p>
            We aim for continuous availability but do not promise uninterrupted
            service. The service depends on third parties (including telephony,
            speech and AI providers), and outages outside our control may occur.
          </p>
        </>
      ),
    },
    {
      id: "accounts",
      heading: "Your account and Client ID",
      body: (
        <>
          <p>
            When you sign up we issue you a unique Client ID. Your Client ID (and
            the session it creates) is the credential for your dashboard. Keep it
            confidential: anyone with it can view your call logs. Tell us
            immediately if you believe it has been compromised.
          </p>
          <p>
            You must give accurate, current information during onboarding —
            including your legal name, business details and address — because UK
            telecoms regulation requires our carrier to verify who each number is
            issued to. You confirm any documents you upload are genuine and belong
            to you.
          </p>
        </>
      ),
    },
    {
      id: "fees",
      heading: "Fees, billing and overage",
      body: (
        <>
          <p>
            The service is billed as a monthly subscription (currently £150 per
            month) including 500 minutes of call handling per billing period.
            Usage beyond the included minutes is billed per minute (currently
            £0.10 per minute). Prices exclude VAT where applicable.
          </p>
          <p>
            Payments are processed by our payment provider. If a payment fails,
            your subscription may be suspended or cancelled. We may change prices
            on renewal with at least 30 days&apos; notice.
          </p>
          <p>
            <strong>Money-back guarantee:</strong> if you are not satisfied within
            the first 30 days of a paid subscription, tell us and we will refund
            that month&apos;s subscription fee.
          </p>
        </>
      ),
    },
    {
      id: "acceptable-use",
      heading: "Acceptable use",
      body: (
        <>
          <p>You agree not to use the service to:</p>
          <ul>
            <li>break any applicable law or regulation;</li>
            <li>
              harass, threaten or deceive callers, or use the numbers for spam,
              robocalls or unsolicited marketing in breach of UK law;
            </li>
            <li>
              impersonate another person or business, or misrepresent who calls
              are being answered by when asked directly;
            </li>
            <li>
              upload documents or content you do not have the right to use, or
              attempt to obtain phone numbers through fraudulent verification.
            </li>
          </ul>
          <p>
            We may suspend numbers or accounts that breach this section, where
            required by law, or where a carrier (such as Twilio) requires it.
          </p>
        </>
      ),
    },
    {
      id: "ai-disclaimer",
      heading: "AI nature of the receptionist",
      body: (
        <>
          <p>
            Calls are answered by an automated AI system, not a human being. The
            AI aims to reflect the business details, hours, services and
            instructions you configure, but it can make mistakes. You are
            responsible for reviewing and correcting your receptionist settings,
            and for how you act on the information it captures.
          </p>
          <p>
            The AI will not invent prices, availability or promises beyond what
            you configure, but you should not treat its transcripts as a verbatim
            or legally binding record of a conversation.
          </p>
        </>
      ),
    },
    {
      id: "your-content",
      heading: "Your content and instructions",
      body: (
        <>
          <p>
            You retain ownership of the business information, instructions and
            documents you provide (&quot;Your Content&quot;). You grant us a limited
            licence to use Your Content solely to operate the service for you —
            for example, to brief the AI receptionist and to satisfy carrier
            verification requirements.
          </p>
          <p>
            Call recordings and transcripts involving your callers are processed
            as described in our Privacy Policy.
          </p>
        </>
      ),
    },
    {
      id: "liability",
      heading: "Limitation of liability",
      body: (
        <>
          <p>
            Nothing in these Terms excludes liability for death or personal
            injury caused by negligence, fraud, or anything else that cannot lawfully
            be excluded.
          </p>
          <p>
            Subject to that, the service is provided &quot;as is&quot; and we are not
            liable for indirect or consequential loss, including lost profits,
            lost business, or missed calls or messages. Our total liability
            arising out of or in connection with the service is limited to the
            greater of (a) the fees you paid us in the 12 months before the event
            giving rise to the claim, or (b) £150.
          </p>
        </>
      ),
    },
    {
      id: "term-and-cancellation",
      heading: "Term, cancellation and number porting",
      body: (
        <>
          <p>
            Subscriptions renew monthly until cancelled. You may cancel at any
            time from your dashboard or by contacting us; cancellation takes
            effect at the end of the current billing period.
          </p>
          <p>
            Your dedicated number is leased as part of the service. After
            cancellation we may release or reclaim the number. If you want to
            keep it, ask us about porting it away before you cancel — porting is
            subject to your new carrier&apos;s requirements and any regulatory
            constraints on the number.
          </p>
        </>
      ),
    },
    {
      id: "changes",
      heading: "Changes to these Terms",
      body: (
        <>
          <p>
            We may update these Terms from time to time. The current version is
            always on this page with its last-updated date. If a change is
            material we will notify account holders by email at least 14 days
            before it takes effect. Continuing to use the service after that date
            means you accept the updated Terms.
          </p>
        </>
      ),
    },
    {
      id: "law",
      heading: "Governing law and contact",
      body: (
        <>
          <p>
            These Terms are governed by the laws of England and Wales, and the
            courts of England and Wales have exclusive jurisdiction — unless you
            are in Scotland or Northern Ireland, where your local courts have
            jurisdiction.
          </p>
          <p>
            Questions? Email <a href="mailto:legal@sitering.ai">legal@sitering.ai</a>{" "}
            or write to SiteRing AI Ltd, United Kingdom.
          </p>
        </>
      ),
    },
  ],
};

export const metadata = legalMetadata(legalDoc);

export default function TermsPage() {
  return <LegalPage doc={legalDoc} />;
}
