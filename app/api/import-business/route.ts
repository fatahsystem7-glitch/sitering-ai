import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TRADES = [
  "Plumbing",
  "Electrical",
  "Roofing",
  "General Building",
  "HVAC",
  "Heating & Gas",
  "Drainage",
  "Locksmith",
  "Painting & Decorating",
  "Other Trade",
];

function privateIp(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) {
    return true;
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https addresses can be imported.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That address cannot be imported.");
  }
  if (isIP(host)) {
    if (privateIp(host)) throw new Error("That address cannot be imported.");
    return url;
  }
  const records = await lookup(host, { all: true, verbatim: true });
  if (records.some((record) => privateIp(record.address))) {
    throw new Error("That address cannot be imported.");
  }
  return url;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to import a website." }, { status: 401 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
  }

  let url = "";
  try {
    url = ((await request.json()) as { url?: string }).url?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a url." }, { status: 400 });
  }

  try {
    const pageUrl = await assertPublicUrl(url);
    const response = await fetch(pageUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "SiteRingAI/1.0" },
    });
    if (!response.ok) throw new Error(`The site returned ${response.status}.`);
    const text = htmlToText(await response.text());
    if (text.length < 40) throw new Error("The page did not contain enough text to import.");

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Extract a UK trade contractor profile. JSON keys: business_name, trade_type, service_areas, callout_fee, operating_hours, booking_url, services, custom_instructions. trade_type must be one of: ${TRADES.join(", ")}. services is [{name, price, duration}]. Never invent prices. booking_url must be an absolute http(s) URL from the page, or empty.`,
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!completion.ok) throw new Error("The import model could not read that page.");
    const payload = (await completion.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const profile = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}") as Record<
      string,
      unknown
    >;
    return NextResponse.json({
      profile: {
        ...profile,
        website_url: pageUrl.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 422 },
    );
  }
}
