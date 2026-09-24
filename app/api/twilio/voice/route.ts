import { NextResponse } from "next/server";
import twilio from "twilio";
import { sayTwiml, voiceTwiml } from "@/lib/telephony/twiml";
import { twilioRequestUrl } from "@/lib/telephony/request-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xml(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(
    [...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const url = twilioRequestUrl(request, "/api/twilio/voice");
  if (token && process.env.NODE_ENV === "production") {
    const valid = twilio.validateRequest(token, signature, url, params);
    if (!valid) return xml(sayTwiml("This call could not be verified."), 403);
  }

  const dialed = params.To || params.Called || "";
  return xml(voiceTwiml(dialed));
}
