import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClientInsert } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DOCUMENTS_BUCKET = "client-documents";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

const onboardingSchema = z.object({
  // Business
  business_name: z.string().trim().min(2, "Business name is required").max(200),
  trade_type: z.string().trim().max(100).optional().or(z.literal("")),
  company_number: z.string().trim().max(50).optional().or(z.literal("")),
  vat_number: z.string().trim().max(50).optional().or(z.literal("")),

  // Contact
  owner_name: z.string().trim().min(2, "Your name is required").max(200),
  email: z.string().trim().email("A valid email is required").max(200),
  phone_number: z.string().trim().min(6, "A contact number is required").max(50),
  emergency_forwarding_number: z.string().trim().max(50).optional().or(z.literal("")),

  // Address (Telnyx requires an address matching the proof of address)
  address_line1: z.string().trim().min(2, "Address is required").max(200),
  address_line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Town/city is required").max(120),
  postcode: z.string().trim().min(3, "Postcode is required").max(20),
  country: z.string().trim().max(2).optional().or(z.literal("")),

  // Receptionist profile
  service_areas: z.string().trim().max(500).optional().or(z.literal("")),
  services_offered: z.array(z.string().max(100)).max(30).optional(),
  operating_hours: z.string().trim().max(200).optional().or(z.literal("")),
  callout_fee: z.string().trim().max(100).optional().or(z.literal("")),
  greeting_style: z.string().trim().max(100).optional().or(z.literal("")),
  custom_instructions: z.string().trim().max(2000).optional().or(z.literal("")),

  // Verification
  id_document_type: z.string().trim().max(50).optional().or(z.literal("")),
  consent: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .refine((v) => v === true, "You must confirm the declaration to continue"),
});

function validateFile(file: unknown, label: string): File | string {
  if (!(file instanceof File) || file.size === 0) {
    return `${label} is required.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${label} must be 10 MB or smaller.`;
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return `${label} must be a JPG, PNG, WEBP, HEIC or PDF file.`;
  }
  return file;
}

function extensionFor(file: File): string {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  if (fromName) return fromName;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic") return "heic";
  return "jpg";
}

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected a multipart/form-data submission." },
      { status: 400 },
    );
  }

  const rawServices = form.getAll("services_offered").map(String).filter(Boolean);
  const payload = {
    business_name: String(form.get("business_name") ?? ""),
    trade_type: String(form.get("trade_type") ?? ""),
    company_number: String(form.get("company_number") ?? ""),
    vat_number: String(form.get("vat_number") ?? ""),
    owner_name: String(form.get("owner_name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone_number: String(form.get("phone_number") ?? ""),
    emergency_forwarding_number: String(form.get("emergency_forwarding_number") ?? ""),
    address_line1: String(form.get("address_line1") ?? ""),
    address_line2: String(form.get("address_line2") ?? ""),
    city: String(form.get("city") ?? ""),
    postcode: String(form.get("postcode") ?? ""),
    country: String(form.get("country") ?? "GB"),
    service_areas: String(form.get("service_areas") ?? ""),
    services_offered: rawServices,
    operating_hours: String(form.get("operating_hours") ?? ""),
    callout_fee: String(form.get("callout_fee") ?? ""),
    greeting_style: String(form.get("greeting_style") ?? ""),
    custom_instructions: String(form.get("custom_instructions") ?? ""),
    id_document_type: String(form.get("id_document_type") ?? ""),
    consent: form.get("consent") ?? false,
  };

  const parsed = onboardingSchema.safeParse(payload);
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

  // ── Mandatory Telnyx verification uploads ───────────────────────
  const idDoc = validateFile(form.get("id_document"), "Photo ID (passport or driving licence)");
  const poaDoc = validateFile(form.get("proof_of_address"), "Proof of address");

  const fileErrors: Record<string, string[]> = {};
  if (typeof idDoc === "string") fileErrors.id_document = [idDoc];
  if (typeof poaDoc === "string") fileErrors.proof_of_address = [poaDoc];
  if (Object.keys(fileErrors).length > 0) {
    return NextResponse.json(
      { ok: false, error: "validation_error", details: fileErrors },
      { status: 400 },
    );
  }

  if (!supabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The database isn't connected yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the environment, then try again.",
      },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();

  // ── Duplicate email guard ───────────────────────────────────────
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .ilike("email", data.email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "An account already exists for that email. Use your Client ID to log in, or contact support if you've lost it.",
      },
      { status: 409 },
    );
  }

  // ── 1. Create the account row → this generates the Client ID ────
  const insert: ClientInsert = {
    business_name: data.business_name,
    trade_type: data.trade_type || null,
    company_number: data.company_number || null,
    vat_number: data.vat_number || null,
    owner_name: data.owner_name,
    email: data.email.toLowerCase(),
    phone_number: data.phone_number,
    emergency_forwarding_number: data.emergency_forwarding_number || data.phone_number,
    address_line1: data.address_line1,
    address_line2: data.address_line2 || null,
    city: data.city,
    postcode: data.postcode.toUpperCase(),
    country: (data.country || "GB").toUpperCase(),
    service_areas: data.service_areas || null,
    services_offered: data.services_offered ?? [],
    operating_hours: data.operating_hours || null,
    callout_fee: data.callout_fee || null,
    greeting_style: data.greeting_style || null,
    custom_instructions: data.custom_instructions || null,
    id_document_type: data.id_document_type || null,
    telnyx_verification_status: "pending",
    onboarding_status: "submitted",
  };

  const { data: client, error: insertError } = await supabase
    .from("clients")
    .insert(insert)
    .select("id")
    .single();

  if (insertError || !client) {
    console.error("[onboarding] Failed to create client:", insertError);
    return NextResponse.json(
      { ok: false, error: "We couldn't create your account. Please try again." },
      { status: 500 },
    );
  }

  const clientId = client.id as string;

  // ── 2. Upload the KYC documents to the private bucket ───────────
  async function upload(file: File, kind: "id_document" | "proof_of_address") {
    const path = `${clientId}/${kind}-${Date.now()}.${extensionFor(file)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) throw new Error(`${kind}: ${error.message}`);

    await supabase.from("client_documents").insert({
      client_id: clientId,
      kind,
      storage_path: path,
      original_filename: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    });

    return path;
  }

  try {
    const [idPath, poaPath] = await Promise.all([
      upload(idDoc as File, "id_document"),
      upload(poaDoc as File, "proof_of_address"),
    ]);

    await supabase
      .from("clients")
      .update({
        id_document_path: idPath,
        proof_of_address_path: poaPath,
        telnyx_verification_status: "submitted",
        onboarding_status: "documents_received",
      })
      .eq("id", clientId);
  } catch (err) {
    console.error("[onboarding] Document upload failed:", err);
    // The account exists — let them in, but flag the missing documents.
    await supabase
      .from("clients")
      .update({
        telnyx_verification_status: "pending",
        telnyx_verification_notes:
          "Document upload failed during onboarding — re-upload required before number provisioning.",
      })
      .eq("id", clientId);

    return NextResponse.json(
      {
        ok: true,
        client_id: clientId,
        documents_uploaded: false,
        warning:
          "Your account was created, but we couldn't store your documents. Please email them to support so we can verify your number.",
      },
      { status: 201 },
    );
  }

  return NextResponse.json(
    { ok: true, client_id: clientId, documents_uploaded: true },
    { status: 201 },
  );
}
