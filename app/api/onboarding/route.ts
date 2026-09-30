import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendClientIdEmail, sendNewClientNotification, sendNumberLiveEmail } from "@/lib/email";
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
  // The dashboard login they choose on the form. Supabase Auth caps passwords
  // at 72 bytes (bcrypt), so the same limit is enforced here rather than
  // failing later inside the auth admin API.
  password: z
    .string()
    .min(8, "Choose a password of at least 8 characters.")
    .max(72, "Passwords must be 72 characters or fewer."),
  phone_number: z.string().trim().min(6, "A contact number is required").max(50),
  emergency_forwarding_number: z.string().trim().max(50).optional().or(z.literal("")),

  // Address (Twilio requires an address matching the proof of address)
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

  // GDPR — the privacy consent box is separate from the Twilio declaration
  // and timestamped so we can prove when it was given (UK GDPR Art. 7).
  gdpr_consent: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .refine(
      (v) => v === true,
      "Please accept the Terms and Privacy Policy so we can process your data.",
    ),
  marketing_consent: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on")
    .optional(),
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
    password: String(form.get("password") ?? ""),
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
    gdpr_consent: form.get("gdpr_consent") ?? false,
    marketing_consent: form.get("marketing_consent") ?? false,
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

  // ── Mandatory Twilio compliance uploads ───────────────────────
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
  // This is load-bearing, not just tidiness: /api/onboarding is public and
  // unauthenticated, so "the email is already taken" is exactly what stops
  // someone submitting a contractor's address to seize their account.
  // The unique index on lower(email) backs it up at the database level.
  const { data: existing, error: existingError } = await supabase
    .from("clients")
    .select("id")
    .ilike("email", data.email)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    console.error("[onboarding] Duplicate check failed:", existingError);
    return NextResponse.json(
      { ok: false, error: "We couldn't check that email. Please try again." },
      { status: 500 },
    );
  }

  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "An account already exists for that email. Log in with your email and password — or, if your account predates email login, with your Client ID.",
      },
      { status: 409 },
    );
  }

  // ── 1. Create the Supabase Auth user (email + password) ─────────
  // These are the credentials the contractor chose moments ago on a form they
  // control, so they are confirmed on the spot rather than bounced through an
  // email round-trip they would have to complete before reaching a dashboard
  // they have already paid to set up.
  let authUserId: string;
  try {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        business_name: data.business_name,
        owner_name: data.owner_name,
        account_type: "client",
      },
    });

    if (authError || !authUser?.user) {
      const message = authError?.message ?? "Could not create the login.";
      console.error("[onboarding] Auth user creation failed:", message);
      if (/already registered|already exists/i.test(message)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "That email already has a login. Log in with it, or reset your password if you've forgotten it.",
          },
          { status: 409 },
        );
      }
      if (/password/i.test(message)) {
        return NextResponse.json({ ok: false, error: message }, { status: 400 });
      }
      return NextResponse.json(
        { ok: false, error: "We couldn't create your login. Please try again." },
        { status: 502 },
      );
    }
    authUserId = authUser.user.id;
  } catch (cause) {
    console.error("[onboarding] Auth admin API unavailable:", cause);
    return NextResponse.json(
      { ok: false, error: "The login service is unavailable. Please try again shortly." },
      { status: 502 },
    );
  }

  // ── 2. Create the account row → this generates the Client ID ────
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
    // Sole traders and limited companies take different Twilio bundles, so the
    // branch is decided once here rather than re-guessed at submission time.
    business_type: data.company_number?.trim() ? "limited_company" : "sole_trader",
    twilio_bundle_status: "pending",
    onboarding_status: "submitted",
    // GDPR consent trail — what was agreed, and exactly when.
    gdpr_consent: data.gdpr_consent,
    gdpr_consented_at: data.gdpr_consent ? new Date().toISOString() : null,
    marketing_consent: data.marketing_consent ?? false,
    // The email + password login this account signs in with.
    owner_auth_user_id: authUserId,
  };

  const { data: client, error: insertError } = await supabase
    .from("clients")
    .insert(insert)
    .select("id")
    .single();

  if (insertError || !client) {
    console.error("[onboarding] Failed to create client:", insertError);
    // Roll the fresh Auth user back, so retrying the form isn't stuck on
    // "already registered" for an account that was never created.
    try {
      await supabase.auth.admin.deleteUser(authUserId);
    } catch (rollbackError) {
      console.warn("[onboarding] Could not roll back the Auth user:", rollbackError);
    }
    return NextResponse.json(
      { ok: false, error: "We couldn't create your account. Please try again." },
      { status: 500 },
    );
  }

  const clientId = client.id as string;

  /**
   * Signs the new contractor in on this device (writes the Supabase session
   * cookies). Best-effort — if it fails they simply log in on the login page
   * with the email and password they just chose.
   */
  async function signThemIn(): Promise<boolean> {
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) {
        console.warn("[onboarding] Auto sign-in failed:", error.message);
        return false;
      }
      return true;
    } catch (cause) {
      console.warn("[onboarding] Auto sign-in failed:", cause);
      return false;
    }
  }

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

    const { error: docError } = await supabase.from("client_documents").insert({
      client_id: clientId,
      kind,
      storage_path: path,
      original_filename: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    });

    if (docError) {
      // The file is stored but the audit row is missing — loud, not silent.
      console.error("[onboarding] client_documents insert failed:", docError);
      throw new Error(`${kind}: audit record could not be created (${docError.message})`);
    }

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
        twilio_bundle_status: "pending",
        onboarding_status: "documents_received",
      })
      .eq("id", clientId);
  } catch (err) {
    console.error("[onboarding] Document upload failed:", err);
    // The account exists — let them in, but flag the missing documents.
    await supabase
      .from("clients")
      .update({
        twilio_bundle_status: "pending",
        twilio_rejection_reason:
          "Document upload failed during onboarding — re-upload required before number provisioning.",
      })
      .eq("id", clientId);

    const emailSentOnFailure = await sendClientIdEmail({
      to: data.email,
      ownerName: data.owner_name,
      businessName: data.business_name,
      clientId,
    });
    await sendNewClientNotification({
      businessName: data.business_name,
      ownerName: data.owner_name,
      email: data.email,
      phone: data.phone_number,
      clientId,
      documentsUploaded: false,
    });

    const signedInAfterFailure = await signThemIn();

    return NextResponse.json(
      {
        ok: true,
        client_id: clientId,
        signed_in: signedInAfterFailure,
        email_sent: emailSentOnFailure,
        documents_uploaded: false,
        warning:
          "Your account was created, but we couldn't store your documents. Please email them to support so we can verify your number.",
      },
      { status: 201 },
    );
  }

  // Email the Client ID (best-effort — never blocks account creation).
  const emailSent = await sendClientIdEmail({
    to: data.email,
    ownerName: data.owner_name,
    businessName: data.business_name,
    clientId,
  });
  await sendNewClientNotification({
    businessName: data.business_name,
    ownerName: data.owner_name,
    email: data.email,
    phone: data.phone_number,
    clientId,
    documentsUploaded: true,
  });

  // Submit the UK regulatory bundle to Twilio. Deliberately best-effort: if
  // Twilio is down or a document is unreadable the account still exists and
  // the daily poll retries, rather than the contractor seeing a failed signup.
  let complianceSubmitted = false;
  let bundleApproved = false;
  let bundleAddressSid: string | null = null;
  if (process.env.TWILIO_AUTO_SUBMIT !== "false") {
    try {
      const { data: fresh } = await supabase
        .from("clients")
        .select(
          "id,business_name,business_type,company_number,owner_name,email,phone_number," +
            "address_line1,address_line2,city,postcode,id_document_type,id_document_path," +
            "proof_of_address_path,twilio_bundle_sid,twilio_address_sid",
        )
        .eq("id", clientId)
        .maybeSingle();

      if (fresh) {
        const { submitUkBundle } = await import("@/lib/twilio/compliance");
        const result = await submitUkBundle(fresh as never);
        complianceSubmitted = result.submitted;
        bundleApproved = result.evaluation.compliant;

        // submitUkBundle persists the address/bundle SIDs on the row.
        const { data: sids } = await supabase
          .from("clients")
          .select("twilio_bundle_sid,twilio_address_sid")
          .eq("id", clientId)
          .maybeSingle();
        bundleAddressSid = sids?.twilio_address_sid ?? null;
      }
    } catch (err) {
      console.error("[onboarding] Twilio bundle submission failed:", err);
      await supabase
        .from("clients")
        .update({
          twilio_rejection_reason:
            err instanceof Error ? err.message : "Bundle submission failed.",
        })
        .eq("id", clientId);
    }
  }

  // ── Buy the number now, as part of account setup ────────────────
  // Twilio reviews most UK bundles asynchronously, so this usually lands in
  // the daily poll instead — but when the bundle is compliant on the spot
  // (or provisioning without a bundle is allowed for this deployment) the
  // contractor finishes signup with a live number in hand.
  let assignedNumber: string | null = null;
  if (bundleApproved || process.env.TWILIO_PROVISION_WITHOUT_BUNDLE === "true") {
    try {
      const { provisionNumber } = await import("@/lib/twilio/provisioning");
      const { data: forProvision } = await supabase
        .from("clients")
        .select("id,business_name,twilio_bundle_sid,twilio_address_sid")
        .eq("id", clientId)
        .maybeSingle();

      if (forProvision) {
        const result = await provisionNumber({
          id: forProvision.id,
          business_name: forProvision.business_name,
          twilio_bundle_sid: forProvision.twilio_bundle_sid ?? bundleAddressSid ?? null,
          twilio_address_sid: forProvision.twilio_address_sid ?? bundleAddressSid ?? null,
        });
        assignedNumber = result.phoneNumber;

        // The number is live — say so in the welcome email too.
        await sendNumberLiveEmail({
          to: data.email,
          ownerName: data.owner_name,
          businessName: data.business_name,
          phoneNumber: result.phoneNumber,
          clientId,
        });
      }
    } catch (cause) {
      // Expected for pending-review bundles: the daily poll finishes the job.
      console.warn(
        "[onboarding] Immediate provisioning did not complete (the daily poll will retry):",
        cause instanceof Error ? cause.message : cause,
      );
      await supabase
        .from("clients")
        .update({ onboarding_status: "provisioning" })
        .eq("id", clientId)
        .eq("onboarding_status", "documents_received");
    }
  }

  // ── Sign them straight in (sets the Supabase session cookies) ───
  const signedIn = await signThemIn();

  return NextResponse.json(
    {
      ok: true,
      client_id: clientId,
      signed_in: signedIn,
      email_sent: emailSent,
      documents_uploaded: true,
      compliance_submitted: complianceSubmitted,
      phone_number: assignedNumber,
      provisioning_status: assignedNumber ? "live" : "pending_verification",
    },
    { status: 201 },
  );
}
