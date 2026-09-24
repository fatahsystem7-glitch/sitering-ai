/**
 * Public site constants.
 *
 * DEMO_CALL_NUMBER is the live UK test line visitors can ring to speak
 * with the AI receptionist. Set NEXT_PUBLIC_DEMO_CALL_NUMBER once your
 * LiveKit/Twilio demo agent is provisioned.
 */
export const DEMO_CALL_NUMBER =
  process.env.NEXT_PUBLIC_DEMO_PHONE_NUMBER ??
  process.env.NEXT_PUBLIC_DEMO_CALL_NUMBER ??
  "+44 20 3966 1248";

export const DEMO_CALL_TEL_LINK = `tel:${DEMO_CALL_NUMBER.replace(/[^+\d]/g, "")}`;
