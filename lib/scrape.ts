import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 800_000;
const MAX_REDIRECTS = 3;

function ipv4Private(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function ipIsPrivate(ip: string): boolean {
  const normalised = ip.toLowerCase();
  if (normalised === "::1" || normalised === "0:0:0:0:0:0:0:1") return true;
  if (normalised.startsWith("fe80:") || normalised.startsWith("fc") || normalised.startsWith("fd")) return true;
  if (normalised.startsWith("::ffff:")) return ipv4Private(normalised.slice(7));
  if (isIP(normalised) === 4) return ipv4Private(normalised);
  return false;
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That does not look like a website address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https addresses can be imported.");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("That address cannot be imported.");
  }
  if (isIP(host)) {
    if (ipIsPrivate(host)) throw new Error("That address cannot be imported.");
    return url;
  }
  const records = await lookup(host, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => ipIsPrivate(record.address))) {
    throw new Error("That address cannot be imported.");
  }
  return url;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
}

export async function fetchPublicPage(rawUrl: string): Promise<{ url: string; text: string }> {
  let current = await assertPublicHttpUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "user-agent": "SiteRingAI/1.0 (business profile import)",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The site redirected without a destination.");
      current = await assertPublicHttpUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) {
      throw new Error(`The site returned ${response.status}.`);
    }
    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      throw new Error("That page is not HTML, so it cannot be imported.");
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      throw new Error("That page is too large to import.");
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const text = htmlToText(html);
    if (text.length < 40) throw new Error("The page did not contain enough text to import.");
    return { url: current.toString(), text };
  }
  throw new Error("The site redirected too many times.");
}
