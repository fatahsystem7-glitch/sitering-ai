import { LegalPage, legalMetadata, type LegalDocument } from "@/components/legal/legal-page";

const legalDoc: LegalDocument = {
  title: "Privacy Policy",
  description:
    "How SiteRing AI collects, uses and protects personal data — under UK GDPR and the Data Protection Act 2018.",
  lastUpdated: "2026-09-30",
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      body: (
        <>
          <p>
            SiteRing AI Ltd (&quot;SiteRing&quot;, &quot;we&quot;, &quot;us&quot;) is the
            data controller for the personal data described in this policy. Our
            registered office is in the United Kingdom.
          </p>
          <p>
            We are subject to the UK General Data Protection Regulation (UK GDPR)
            and the Data Protection Act 2018. You can contact us at{" "}
            <a href="mailto:privacy@sitering.ai">privacy@sitering.ai</a> about
            anything in this policy, including to exercise your rights.
          </p>
        </>
      ),
    },
    {
      id: "what-we-collect",
      heading: "What personal data we collect",
      body: (
        <>
          <p>
            <strong>Account data</strong> — when you sign up: your name, business
            name, trade, email address, contact and emergency forwarding numbers,
            registered business address, and the receptionist details you
            configure (hours, services, instructions).
          </p>
          <p>
            <strong>Verification documents</strong> — to issue a UK phone number,
            telecoms regulation requires our carrier (Twilio) to verify who the
            number belongs to. We collect a copy of your photo ID (passport or
            driving licence) and a proof of address, stored in a private,
            access-controlled storage bucket.
          </p>
          <p>
            <strong>Call and message data</strong> — caller numbers and names,
            call recordings and transcripts, AI-generated summaries, and the
            times and durations of calls made to your dedicated number.
          </p>
          <p>
            <strong>Usage and billing data</strong> — minutes used, subscription
            status and payment references processed by our payment provider.
          </p>
          <p>
            <strong>Website data</strong> — basic technical information (such as
            IP address and browser type) where needed to deliver and secure the
            service.
          </p>
        </>
      ),
    },
    {
      id: "why",
      heading: "Why we process it (lawful bases)",
      body: (
        <>
          <p>
            We only process personal data where we have a lawful basis. Ours are:
          </p>
          <ul>
            <li>
              <strong>Contract</strong> — to set up and operate your AI
              receptionist, provision your number, bill your subscription, and
              show you your call logs. This includes passing your verification
              documents to Twilio, which is necessary to perform our contract
              with you.
            </li>
            <li>
              <strong>Legal obligation</strong> — to satisfy UK telecoms
              know-your-customer and verification requirements, and to respond to
              lawful requests.
            </li>
            <li>
              <strong>Legitimate interests</strong> — to keep the service secure
              and available, prevent fraud and abuse, and improve the service,
              provided your rights are not overridden.
            </li>
            <li>
              <strong>Consent</strong> — for optional marketing emails. Every
              marketing message includes an unsubscribe link, and you can
              withdraw consent at any time.
            </li>
          </ul>
          <p>
            Callers who ring your dedicated number are told (when they ask) that
            they are speaking to an automated assistant. Their data is processed
            to deliver the answering service you have asked us to run.
          </p>
        </>
      ),
    },
    {
      id: "sharing",
      heading: "Who we share it with",
      body: (
        <>
          <p>We share personal data only with processors who help us run the service:</p>
          <ul>
            <li>
              <strong>Twilio</strong> — our telephony carrier: number
              provisioning, SMS, and the regulatory verification of your
              documents.
            </li>
            <li>
              <strong>LiveKit</strong> — real-time voice infrastructure that
              carries calls to the AI receptionist.
            </li>
            <li>
              <strong>OpenAI</strong> — speech-to-text and conversation
              processing for calls.
            </li>
            <li>
              <strong>Fish Audio</strong> — text-to-speech synthesis of the
              receptionist&apos;s voice (when selected as the speech provider).
            </li>
            <li>
              <strong>Supabase</strong> — our database and document storage
              provider.
            </li>
            <li>
              <strong>Our payment provider</strong> — subscription and overage
              billing.
            </li>
            <li>
              <strong>Brevo</strong> — transactional email delivery (signup
              confirmations, number-live notifications).
            </li>
          </ul>
          <p>
            These processors act on our instructions under contract. We never
            sell your personal data, and we do not share it for third-party
            advertising.
          </p>
        </>
      ),
    },
    {
      id: "retention",
      heading: "How long we keep it",
      body: (
        <>
          <ul>
            <li>
              <strong>Verification documents</strong> — only as long as the
              carrier requires us to keep them for the number you hold, plus any
              statutory retention period. When you cancel and the number is
              released, we delete them.
            </li>
            <li>
              <strong>Call logs, transcripts and recordings</strong> — for the
              life of your account, so your dashboard keeps working, then deleted
              on a rolling basis after account closure unless law requires
              longer.
            </li>
            <li>
              <strong>Account and billing records</strong> — six years, to meet
              UK tax and accounting obligations.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "rights",
      heading: "Your rights",
      body: (
        <>
          <p>Under the UK GDPR you can ask us to:</p>
          <ul>
            <li>give you a copy of your personal data (access);</li>
            <li>correct anything inaccurate or incomplete;</li>
            <li>delete data we no longer need to keep (erasure);</li>
            <li>restrict or object to particular processing;</li>
            <li>
              receive your data in a portable format (for data you provided,
              processed by automated means on the basis of consent or contract);
            </li>
            <li>withdraw consent at any time where processing relies on it.</li>
          </ul>
          <p>
            Email <a href="mailto:privacy@sitering.ai">privacy@sitering.ai</a>{" "}
            and we will respond within one month. You also have the right to
            complain to the Information Commissioner&apos;s Office (ico.org.uk)
            if you believe we have mishandled your data.
          </p>
        </>
      ),
    },
    {
      id: "security",
      heading: "How we protect it",
      body: (
        <>
          <p>
            Verification documents are stored in a private storage bucket that
            is not publicly accessible and is read only by the server-side
            processes that submit verification and support your account. Access
            to production data is limited to SiteRing staff who need it, and all
            access is logged.
          </p>
          <p>
            Data in transit is encrypted with TLS. No system is perfectly secure,
            and if a breach ever affects your rights we will notify you and the
            ICO as the law requires.
          </p>
        </>
      ),
    },
    {
      id: "children",
      heading: "Children",
      body: (
        <>
          <p>
            The service is intended for UK trade businesses and is not directed
            at children. We do not knowingly collect data from anyone under 18.
            If you believe a child has given us personal data, contact us and we
            will delete it.
          </p>
        </>
      ),
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      body: (
        <>
          <p>
            We may update this policy as the service evolves. The current version
            always lives on this page with its last-updated date, and material
            changes are announced to account holders by email before they take
            effect.
          </p>
        </>
      ),
    },
    {
      id: "contact",
      heading: "Contact",
      body: (
        <>
          <p>
            Data protection questions, requests or complaints:{" "}
            <a href="mailto:privacy@sitering.ai">privacy@sitering.ai</a>, or write
            to SiteRing AI Ltd, United Kingdom.
          </p>
        </>
      ),
    },
  ],
};

export const metadata = legalMetadata(legalDoc);

export default function PrivacyPage() {
  return <LegalPage doc={legalDoc} />;
}
