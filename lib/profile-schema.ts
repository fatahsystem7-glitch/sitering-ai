import { z } from "zod";
import { TRADE_OPTIONS } from "@/lib/trades";
import { asServices, type ServiceItem } from "@/lib/types";

const serviceSchema = z.object({
  name: z.string().trim().max(80),
  price: z.string().trim().max(40),
  duration: z.string().trim().max(40),
});

export const profileInputSchema = z.object({
  business_name: z.string().trim().min(2, "Add the trading name.").max(120),
  trade_type: z.enum(TRADE_OPTIONS, { message: "Choose a trade." }),
  service_areas: z.string().trim().min(2, "Add the postcodes or areas you cover.").max(500),
  callout_fee: z.string().trim().max(300).optional().default(""),
  operating_hours: z.string().trim().max(300).optional().default(""),
  website_url: z.string().trim().max(300).optional().default(""),
  booking_url: z.string().trim().max(300).optional().default(""),
  custom_instructions: z.string().trim().max(4000).optional().default(""),
  services: z.array(serviceSchema).max(30).default([]),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

function optionalUrl(value: string, label: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`${label} must start with https://`);
    }
    return url.toString();
  } catch (error) {
    if (error instanceof Error && error.message.includes("https://")) throw error;
    throw new Error(`${label} needs a full web address, including https://`);
  }
}

export function normaliseProfileInput(input: ProfileInput): ProfileInput & { services: ServiceItem[] } {
  const website = optionalUrl(input.website_url, "Website");
  const booking = optionalUrl(input.booking_url, "Booking link");
  const services = asServices(input.services).filter((service) => service.name.trim());
  return {
    ...input,
    website_url: website ?? "",
    booking_url: booking ?? "",
    services,
  };
}
