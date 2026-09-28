/**
 * Twilio UK regulatory compliance — the piece that was missing.
 *
 * Until now onboarding stored the contractor's ID and proof of address in
 * Supabase and set the status to "submitted". Nothing was ever sent anywhere.
 * This actually builds and submits the bundle.
 *
 * Two regulations, two different shapes:
 *
 *   GB local/national — LIMITED COMPANY
 *     end user  : business_info (name, CRN, authorised representative)
 *     documents : business_address — attributes only, NO file upload
 *
 *   GB local/national — SOLE TRADER (individual)
 *     end user  : individual_info (name, email, mobile)
 *     documents : individual_address (attributes)
 *                 proof_of_identity  — passport or driving licence  [FILE]
 *                 proof_of_address   — utility bill, council tax…   [FILE]
 *
 * Twilio reviews asynchronously, so this submits and persists the SIDs. A
 * status webhook finishes the job by buying the number.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { rc, twilio } from "./client";
import type { TwilioBundleStatus } from "@/lib/supabase/types";
import { parseEvaluation, type ParsedEvaluation } from "./evaluation";

const UPLOAD_URL = "https://numbers-upload.twilio.com/v2/RegulatoryCompliance/SupportingDocuments";
const DOCUMENTS_BUCKET = "client-documents";

export type ClientRow = {
  id: string;
  business_name: string;
  business_type: "sole_trader" | "limited_company";
  company_number: string | null;
  owner_name: string;
  email: string;
  phone_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  id_document_type: string | null;
  id_document_path: string | null;
  proof_of_address_path: string | null;
};

export type SubmitResult = {
  bundleSid: string;
  status: string;
  evaluation: ParsedEvaluation;
  submitted: boolean;
};

/** "Dave Wilkins" → { first: "Dave", last: "Wilkins" }. Twilio wants them apart. */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Unknown", last: "Unknown" };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Twilio rejects UK numbers whose address is a PO Box, and the address must
 * match the proof of address exactly — the single most common rejection.
 */
function assertUsableAddress(client: ClientRow) {
  const line1 = client.address_line1?.trim() ?? "";
  if (!line1) throw new Error("A street address is required before submitting to Twilio.");
  if (/\bp\.?o\.?\s*box\b/i.test(line1)) {
    throw new Error("Twilio does not accept a PO Box for a UK number. A physical address is required.");
  }
  if (!client.postcode?.trim()) throw new Error("A UK postcode is required.");
  if (!client.city?.trim()) throw new Error("A town or city is required.");
}

async function createAddress(client: ClientRow) {
  // The customer name on the Address must match the proof of address: the
  // individual for a sole trader, the registered company for a limited company.
  const customerName =
    client.business_type === "sole_trader" ? client.owner_name : client.business_name;

  return twilio().addresses.create({
    customerName,
    street: [client.address_line1, client.address_line2].filter(Boolean).join(", "),
    city: client.city!,
    region: client.city!, // Twilio requires a region; UK addresses rarely carry one.
    postalCode: client.postcode!,
    isoCountry: "GB",
    friendlyName: `sitering-${client.id}`,
    emergencyEnabled: true, // required for UK local numbers
  });
}

/**
 * Upload one stored file to Twilio as a supporting document.
 * This cannot go through the SDK — file uploads use a separate host.
 */
async function uploadDocument(opts: {
  storagePath: string;
  friendlyName: string;
  type: string;
  attributes: Record<string, unknown>;
}): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(opts.storagePath);
  if (error || !data) {
    throw new Error(`Could not read ${opts.storagePath} from storage: ${error?.message ?? "not found"}`);
  }

  const filename = opts.storagePath.split("/").pop() || "document";
  const form = new FormData();
  form.set("FriendlyName", opts.friendlyName);
  form.set("Type", opts.type);
  form.set("Attributes", JSON.stringify(opts.attributes));
  form.set("File", data, filename);

  const auth = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
  ).toString("base64");

  const response = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  });

  const body = (await response.json()) as { sid?: string; message?: string };
  if (!response.ok || !body.sid) {
    throw new Error(`Twilio rejected the ${opts.type} upload: ${body.message ?? response.status}`);
  }
  return body.sid;
}

// ───────────────────────────────────────────────────── limited company
async function buildCompanyItems(client: ClientRow, addressSid: string) {
  const { first, last } = splitName(client.owner_name);

  if (!client.company_number?.trim()) {
    throw new Error("A Companies House number is required for a limited company bundle.");
  }

  const endUser = await rc().endUsers.create({
    friendlyName: client.business_name,
    type: "business",
    attributes: {
      business_name: client.business_name,
      business_registration_number: client.company_number.trim(),
      business_registration_identifier: "UK:CRN",
      first_name: first,
      last_name: last,
      email: client.email,
      phone_number: client.phone_number ?? "",
      business_contact_first_name: first,
      business_contact_last_name: last,
      business_contact_email: client.email,
      business_contact_phone: client.phone_number ?? "",
      // We resell numbers to end customers, so this is true for SiteRing.
      isv_reseller_or_partner: "true",
    },
  });

  // GB business needs no uploaded proof — the address document is attributes only.
  const addressDoc = await rc().supportingDocuments.create({
    friendlyName: `${client.business_name} address`,
    type: "business_address",
    attributes: { address_sids: [addressSid], business_name: client.business_name },
  });

  return { endUserSid: endUser.sid, documentSids: [addressDoc.sid] };
}

// ────────────────────────────────────────────────────────── sole trader
async function buildSoleTraderItems(client: ClientRow, addressSid: string) {
  const { first, last } = splitName(client.owner_name);

  if (!client.id_document_path || !client.proof_of_address_path) {
    throw new Error(
      "A sole trader bundle needs both a photo ID and a proof of address. One or both are missing.",
    );
  }

  const endUser = await rc().endUsers.create({
    friendlyName: client.owner_name,
    type: "individual",
    attributes: {
      first_name: first,
      last_name: last,
      email: client.email,
      phone_number: client.phone_number ?? "",
      comments: `Sole trader trading as ${client.business_name}. AI receptionist for inbound customer calls.`,
    },
  });

  const addressDoc = await rc().supportingDocuments.create({
    friendlyName: `${client.owner_name} address`,
    type: "individual_address",
    attributes: { address_sids: [addressSid] },
  });

  // A driving licence is a government_issued_document, not a passport —
  // sending the wrong type is an instant 22214 rejection.
  const idType =
    client.id_document_type?.toLowerCase().includes("passport")
      ? "passport"
      : "government_issued_document";

  const idSid = await uploadDocument({
    storagePath: client.id_document_path,
    friendlyName: `${client.owner_name} photo ID`,
    type: idType,
    attributes: { first_name: first, last_name: last },
  });

  const addressProofSid = await uploadDocument({
    storagePath: client.proof_of_address_path,
    friendlyName: `${client.owner_name} proof of address`,
    type: "utility_bill",
    attributes: { address_sids: [addressSid] },
  });

  return { endUserSid: endUser.sid, documentSids: [addressDoc.sid, idSid, addressProofSid] };
}

/**
 * Build, evaluate and submit the bundle for one contractor.
 * Safe to call once per client; call again only after fixing a rejection.
 */
export async function submitUkBundle(client: ClientRow): Promise<SubmitResult> {
  assertUsableAddress(client);

  const supabase = createAdminClient();
  const isSoleTrader = client.business_type === "sole_trader";

  const address = await createAddress(client);

  const { endUserSid, documentSids } = isSoleTrader
    ? await buildSoleTraderItems(client, address.sid)
    : await buildCompanyItems(client, address.sid);

  const bundle = await rc().bundles.create({
    friendlyName: `${client.business_name} (${isSoleTrader ? "sole trader" : "limited company"})`,
    email: client.email,
    isoCountry: "GB",
    numberType: "local",
    endUserType: isSoleTrader ? "individual" : "business",
  });

  for (const objectSid of [endUserSid, ...documentSids]) {
    await rc().bundles(bundle.sid).itemAssignments.create({ objectSid });
  }

  // Evaluate before submitting. Submitting a bundle that cannot pass just
  // burns a review cycle and days of the contractor's time.
  const rawEvaluation = await rc().bundles(bundle.sid).evaluations.create();
  const evaluation = parseEvaluation(rawEvaluation);

  let status = bundle.status as string;
  let submitted = false;

  if (evaluation.compliant) {
    const updated = await rc().bundles(bundle.sid).update({ status: "pending-review" });
    status = updated.status as string;
    submitted = true;
  }

  await supabase
    .from("clients")
    .update({
      twilio_bundle_sid: bundle.sid,
      twilio_end_user_sid: endUserSid,
      twilio_address_sid: address.sid,
      twilio_document_sids: documentSids,
      twilio_bundle_status: (submitted ? status : "draft") as TwilioBundleStatus,
      twilio_rejection_reason: evaluation.compliant ? null : evaluation.summary,
      twilio_submitted_at: submitted ? new Date().toISOString() : null,
      onboarding_status: submitted ? "provisioning" : "documents_received",
    })
    .eq("id", client.id);

  return { bundleSid: bundle.sid, status, evaluation, submitted };
}
