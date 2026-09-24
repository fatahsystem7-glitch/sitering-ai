/**
 * Default system prompt for the SiteRing AI voice receptionist
 * (LiveKit / Twilio voice agent).
 *
 * `{{business_name}}` and `{{trade_type}}` are interpolated per-customer
 * before the prompt is sent to the agent at call time.
 */

export const DEFAULT_RECEPTIONIST_PROMPT = `You are a friendly, professional 24/7 AI receptionist for SiteRing AI, answering calls on behalf of {{business_name}}.
Your primary goal is to quickly and politely collect job details so {{business_name}} can get back to the caller. Keep all spoken responses brief (1 to 2 concise sentences max).

Always ask for:
1. Caller's Name
2. Job Location or Postcode
3. The specific issue (e.g., burst pipe, electrical trip, lock replacement)
4. Confirm if it is an emergency or standard quote request.

Assure the caller that {{business_name}} has received their message and will contact them shortly.`;

export interface ReceptionistPromptVars {
  business_name: string;
  trade_type?: string | null;
  service_areas?: string | null;
  callout_fee?: string | null;
  operating_hours?: string | null;
  booking_url?: string | null;
  custom_instructions?: string | null;
  services?: Array<{ name?: string; price?: string; duration?: string }> | null;
}

/**
 * Render the receptionist prompt for a specific customer.
 *
 * @example
 * renderReceptionistPrompt({ business_name: "AquaFix Plumbing", trade_type: "Plumbing" })
 */
export function renderReceptionistPrompt(vars: ReceptionistPromptVars): string {
  let prompt = DEFAULT_RECEPTIONIST_PROMPT.replaceAll(
    "{{business_name}}",
    vars.business_name,
  );

  // Optional trade-type specialisation appended when known.
  if (vars.trade_type) {
    prompt += `\n\nThe business is a ${vars.trade_type} contractor. Prioritise safety-critical issues (gas smells, live electrics, major leaks, break-ins) as emergencies and offer to escalate immediately.`;
  }

  const services =
    vars.services
      ?.filter((service) => service.name)
      .map(
        (service) =>
          `- ${service.name}: ${service.price || "price on request"} (${service.duration || "duration confirmed on booking"})`,
      )
      .join("\n") || "- No priced services are listed. Do not quote a price.";

  prompt += `

Facts you may use. Do not invent a price, fee, area, arrival time, or booking link.
Service areas: ${vars.service_areas || "Not provided. Offer a callback instead of guessing coverage."}
Operating hours: ${vars.operating_hours || "Not provided."}
Emergency call-out fee: ${vars.callout_fee || "Not provided. Do not quote a fee."}
Booking link: ${vars.booking_url || "Not provided. Do not claim a text was sent."}
Services:
${services}
Owner notes: ${vars.custom_instructions || "None."}

If the caller wants to book and a booking link is listed, call send_booking_link. If the text cannot be sent, call take_message.`;

  return prompt.replaceAll("{{trade_type}}", vars.trade_type ?? "trade");
}
