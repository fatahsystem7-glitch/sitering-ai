import OpenAI from "openai";
import { z } from "zod";
import { fetchPublicPage } from "@/lib/scrape";
import { TRADE_OPTIONS, normaliseTrade } from "@/lib/trades";
import type { ServiceItem } from "@/lib/types";

const importedService = z.object({
  name: z.string().catch(""),
  price: z.string().catch(""),
  duration: z.string().catch(""),
});

const importedProfile = z.object({
  business_name: z.string().catch(""),
  trade_type: z.string().catch(""),
  service_areas: z.string().catch(""),
  callout_fee: z.string().catch(""),
  operating_hours: z.string().catch(""),
  booking_url: z.string().catch(""),
  services: z.array(importedService).catch([]),
  custom_instructions: z.string().catch(""),
});

export type ImportedProfile = {
  business_name: string;
  trade_type: string;
  service_areas: string;
  callout_fee: string;
  operating_hours: string;
  booking_url: string;
  website_url: string;
  services: ServiceItem[];
  custom_instructions: string;
};

export async function importBusinessFromUrl(url: string): Promise<ImportedProfile> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  const page = await fetchPublicPage(url);
  const client = new OpenAI({ apiKey: key });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You extract a UK trade contractor profile from website text. Return JSON only with keys: business_name, trade_type, service_areas, callout_fee, operating_hours, booking_url, services, custom_instructions.
trade_type must be one of: ${TRADE_OPTIONS.join(", ")}.
services is an array of {name, price, duration}. Use the site's own wording for prices. If a price or duration is not on the page, use an empty string. Never invent fees.
booking_url must be an absolute http(s) URL found on the page, or empty.
custom_instructions should be short FAQ notes a receptionist would need, drawn only from the page, or empty.
service_areas should list towns or postcodes mentioned, or empty.`,
      },
      { role: "user", content: page.text },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = importedProfile.parse(JSON.parse(raw));
  const services = parsed.services
    .map((service) => ({
      name: service.name.trim(),
      price: service.price.trim(),
      duration: service.duration.trim(),
    }))
    .filter((service) => service.name || service.price)
    .slice(0, 30);

  return {
    business_name: parsed.business_name.trim(),
    trade_type: normaliseTrade(parsed.trade_type),
    service_areas: parsed.service_areas.trim(),
    callout_fee: parsed.callout_fee.trim(),
    operating_hours: parsed.operating_hours.trim(),
    booking_url: safeHttp(parsed.booking_url),
    website_url: page.url,
    services,
    custom_instructions: parsed.custom_instructions.trim().slice(0, 4_000),
  };
}

function safeHttp(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}
