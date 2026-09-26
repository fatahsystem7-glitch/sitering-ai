import {
  Globe,
  Magnet,
  CalendarCheck,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";

type Service = {
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
};

const SERVICES: Service[] = [
  {
    icon: Globe,
    title: "Custom website",
    description:
      "A fast, mobile-first site branded to your trade — services, reviews, coverage area and click-to-call, built and hosted for you.",
    points: ["Live in days", "SEO-ready", "Your logo & colours"],
  },
  {
    icon: Magnet,
    title: "Automated lead capture",
    description:
      "Every call and enquiry is logged, qualified and pushed straight to your phone and dashboard — no lead slips through.",
    points: ["Instant alerts", "Job details captured", "One inbox"],
  },
  {
    icon: CalendarCheck,
    title: "Online booking forms",
    description:
      "Let customers request quotes and book slots 24/7 from any device, so you stop playing phone-tag and fill your diary.",
    points: ["24/7 quote requests", "Calendar-ready", "Zero admin"],
  },
  {
    icon: MessageSquareText,
    title: "Missed-call text-back",
    description:
      "Can't pick up on the tools? We instantly text the caller so you never lose the job to the next contractor on the list.",
    points: ["< 30s response", "Auto follow-up", "Keeps the lead warm"],
  },
];

export function Services() {
  return (
    <section id="services" className="container py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
          Everything you get
        </span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Win more work — <span className="text-gradient">done for you</span>
        </h2>
        <p className="mt-4 text-muted-foreground">
          One setup gets your online presence and lead handling sorted, so
          enquiries turn into booked jobs automatically.
        </p>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          return (
            <div
              key={service.title}
              className="group relative rounded-2xl border border-border bg-card/60 p-6 transition-all hover:-translate-y-1 hover:border-emerald-500/40 hover:card-glow"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                <Icon size={22} />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{service.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {service.description}
              </p>
              <ul className="mt-4 space-y-1.5">
                {service.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
