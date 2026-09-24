export type ServiceItem = {
  name: string;
  price: string;
  duration: string;
};

export type BusinessProfile = {
  id: string;
  user_id: string;
  phone_number: string | null;
  business_name: string | null;
  trade_type: string | null;
  service_areas: string | null;
  callout_fee: string | null;
  operating_hours: string | null;
  booking_url: string | null;
  website_url: string | null;
  custom_instructions: string | null;
  services: ServiceItem[];
  used_minutes: number;
  minutes_period: string | null;
  subscription_status: string | null;
  provisioning_status: string | null;
  provisioning_error: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CallLog = {
  id: string;
  business_profile_id: string | null;
  phone_number: string | null;
  caller_number: string | null;
  direction: string;
  status: string;
  duration_seconds: number;
  billed_minutes: number;
  twilio_call_sid: string | null;
  livekit_room: string | null;
  transcript: string | null;
  summary: string | null;
  booking_link_sent: boolean;
  minutes_applied: boolean;
  started_at: string;
  ended_at: string | null;
};

export type CallbackRequest = {
  id: string;
  business_profile_id: string | null;
  caller_number: string | null;
  caller_name: string | null;
  message: string | null;
  urgency: string | null;
  created_at: string;
};

export const EMPTY_SERVICE: ServiceItem = {
  name: "General Call-out",
  price: "£80",
  duration: "45 mins",
};

export function asServices(value: unknown): ServiceItem[] {
  if (!Array.isArray(value)) return [{ ...EMPTY_SERVICE }];
  const services = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = String(row.name ?? "").trim();
      const price = String(row.price ?? "").trim();
      const duration = String(row.duration ?? "").trim();
      if (!name && !price && !duration) return null;
      return { name, price, duration };
    })
    .filter((item): item is ServiceItem => item !== null);
  return services.length > 0 ? services : [];
}
