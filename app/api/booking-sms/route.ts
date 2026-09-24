import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { toE164 } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingSms } from "@/lib/telephony/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.AGENT_INTERNAL_SECRET?.trim();
  const header = request.headers.get("x-sitering-agent-secret");
  const agentAuthorised = Boolean(secret && header && header === secret);
  const { supabase, user } = await getSessionUser();

  let to = "";
  let bookingUrl = "";
  let businessName = "Your contractor";
  let fromNumber: string | null = null;

  try {
    const body = (await request.json()) as {
      to?: string;
      bookingUrl?: string;
      businessName?: string;
      fromNumber?: string;
    };
    to = body.to ?? "";
    bookingUrl = body.bookingUrl ?? "";
    businessName = body.businessName ?? businessName;
    fromNumber = body.fromNumber ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!agentAuthorised) {
    if (!supabase || !user) return NextResponse.json({ error: "Sign in to send a test text." }, { status: 401 });
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("business_name, booking_url, phone_number")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.booking_url) {
      return NextResponse.json({ error: "Save a booking link first." }, { status: 422 });
    }
    bookingUrl = profile.booking_url;
    businessName = profile.business_name ?? businessName;
    fromNumber = profile.phone_number;
    if (!to) return NextResponse.json({ error: "Add the mobile number to text." }, { status: 400 });
  }

  if (!toE164(to)) return NextResponse.json({ error: "That mobile number is not valid." }, { status: 400 });

  try {
    const sent = await sendBookingSms({ to, bookingUrl, businessName, fromNumber });
    if (agentAuthorised) {
      const admin = createAdminClient();
      if (admin) {
        await admin.from("call_logs").insert({
          phone_number: fromNumber,
          caller_number: toE164(to),
          status: "sms",
          booking_link_sent: true,
          summary: "Booking link sent via API",
        });
      }
    }
    return NextResponse.json({ ok: true, sid: sent.sid });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Text failed." },
      { status: 502 },
    );
  }
}
