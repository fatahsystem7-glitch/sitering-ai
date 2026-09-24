/**
 * Shared Supabase row types for SiteRing AI.
 *
 * NOTE: `type` aliases (not `interface`) are used deliberately — the
 * supabase-js `GenericTable` constraint requires `Row`/`Insert`/`Update` to
 * be assignable to `Record<string, unknown>`, and only object-literal type
 * aliases receive implicit index signatures.
 */

export type SubscriptionStatus =
  "inactive" | "trialing" | "active" | "past_due" | "canceled" | "unpaid";

export type UrgencyLevel = "Emergency" | "Standard Quote" | "General Enquiry";

export type Profile = {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone_number: string | null;
  trade_type: string | null;
  emergency_forwarding_number: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  is_admin: boolean;
  role: string;
  created_at: string;
};

export type ProfileInsert = Partial<Profile> &
  Pick<Profile, "id" | "business_name">;
export type ProfileUpdate = Partial<Omit<Profile, "id" | "created_at">>;

export type TelephonyProvisioning = {
  id: string;
  user_id: string;
  assigned_phone_number: string | null;
  twilio_sid: string | null;
  minutes_used_this_period: number;
  monthly_cap_minutes: number;
  forwarding_active: boolean;
  created_at: string;
};

export type TelephonyInsert = Partial<TelephonyProvisioning> &
  Pick<TelephonyProvisioning, "user_id">;
export type TelephonyUpdate = Partial<
  Omit<TelephonyProvisioning, "id" | "user_id" | "created_at">
>;

export type CallLog = {
  id: string;
  user_id: string;
  caller_name: string | null;
  caller_phone: string | null;
  trade_issue_summary: string | null;
  location_postcode: string | null;
  urgency_level: UrgencyLevel;
  full_transcript: string | null;
  ai_summary: string | null;
  recording_url: string | null;
  duration_seconds: number;
  created_at: string;
};

export type CallLogInsert = Partial<CallLog> & Pick<CallLog, "user_id">;
export type CallLogUpdate = Partial<Omit<CallLog, "id" | "created_at">>;

export type ServiceItem = { name: string; price: string; duration: string };

export type BusinessProfile = {
  id: string;
  user_id: string | null;
  phone_number: string | null;
  business_name: string | null;
  trade_type: string | null;
  service_areas: string | null;
  callout_fee: string | null;
  booking_url: string | null;
  website_url: string | null;
  custom_instructions: string | null;
  services: ServiceItem[];
  used_minutes: number;
  operating_hours: string | null;
  created_at: string;
  updated_at: string;
};

/** Minimal Database shape for the typed Supabase client. */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      telephony_provisioning: {
        Row: TelephonyProvisioning;
        Insert: TelephonyInsert;
        Update: TelephonyUpdate;
        Relationships: [];
      };
      call_logs: {
        Row: CallLog;
        Insert: CallLogInsert;
        Update: CallLogUpdate;
        Relationships: [];
      };
      business_profiles: {
        Row: BusinessProfile;
        Insert: { [key: string]: unknown };
        Update: { [key: string]: unknown };
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; value: string; updated_at: string };
        Insert: { [key: string]: unknown };
        Update: { [key: string]: unknown };
        Relationships: [];
      };
      callback_requests: {
        Row: {
          id: string;
          business_profile_id: string | null;
          caller_number: string | null;
          caller_name: string | null;
          message: string | null;
          urgency: string | null;
          created_at: string;
        };
        Insert: { [key: string]: unknown };
        Update: { [key: string]: unknown };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_minutes: {
        Args: { p_user_id: string; p_minutes: number };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
};
