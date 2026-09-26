import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadInsert } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const leadSchema = z.object({
  business_name: z.string().trim().min(1, "Business name is required").max(200),
  trade_type: z.string().trim().max(100).optional().or(z.literal("")),
  contact_name: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().email("A valid email is required").max(200),
  phone_number: z.string().trim().max(50).optional().or(z.literal("")),
  service_requirements: z.array(z.string().max(100)).max(20).optional(),
  service_area: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = leadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation_error",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const lead: LeadInsert = {
    business_name: data.business_name,
    trade_type: data.trade_type || null,
    contact_name: data.contact_name || null,
    email: data.email,
    phone_number: data.phone_number || null,
    service_requirements: data.service_requirements ?? [],
    service_area: data.service_area || null,
    message: data.message || null,
    source: "landing_funnel",
    status: "new",
  };

  // Graceful in local/dev without Supabase configured: accept the lead so the
  // funnel UX still works, but signal it wasn't persisted.
  if (!supabaseConfigured()) {
    console.warn(
      "[leads] Supabase not configured — lead accepted but NOT stored.",
      { business_name: lead.business_name, email: lead.email },
    );
    return NextResponse.json({ ok: true, stored: false });
  }

  try {
    const supabase = createAdminClient();
    const { data: inserted, error } = await supabase
      .from("leads")
      .insert(lead)
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, stored: true, id: inserted?.id });
  } catch (err) {
    console.error("[leads] Failed to store lead:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to save your details. Please try again." },
      { status: 500 },
    );
  }
}
