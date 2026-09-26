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
  user_id: string | null;
  client_id?: string | null;
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

export type CallLogInsert = Partial<CallLog>;
export type CallLogUpdate = Partial<Omit<CallLog, "id" | "created_at">>;

export type ServiceItem = { name: string; price: string; duration: string };

export type LeadStatus = "new" | "contacted" | "converted" | "archived";

export type Lead = {
  id: string;
  business_name: string;
  trade_type: string | null;
  contact_name: string | null;
  email: string;
  phone_number: string | null;
  service_requirements: string[];
  service_area: string | null;
  message: string | null;
  source: string;
  status: LeadStatus;
  created_at: string;
};

export type LeadInsert = Partial<Lead> & Pick<Lead, "business_name" | "email">;
export type LeadUpdate = Partial<Omit<Lead, "id" | "created_at">>;

export type TelnyxVerificationStatus =
  | "pending"
  | "submitted"
  | "in_review"
  | "verified"
  | "rejected";

export type OnboardingStatus =
  | "submitted"
  | "documents_received"
  | "provisioning"
  | "live"
  | "paused";

/**
 * A trade contractor account created through the public onboarding form.
 * `id` IS the Client ID (UUID) used to log into the single /dashboard.
 */
export type Client = {
  id: string;
  business_name: string;
  trade_type: string | null;
  company_number: string | null;
  vat_number: string | null;
  owner_name: string;
  email: string;
  phone_number: string | null;
  emergency_forwarding_number: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  service_areas: string | null;
  services_offered: string[];
  operating_hours: string | null;
  callout_fee: string | null;
  greeting_style: string | null;
  custom_instructions: string | null;
  id_document_type: string | null;
  id_document_path: string | null;
  proof_of_address_path: string | null;
  telnyx_verification_status: TelnyxVerificationStatus;
  telnyx_verification_notes: string | null;
  telnyx_number_order_id: string | null;
  assigned_phone_number: string | null;
  minutes_used_this_period: number;
  monthly_cap_minutes: number;
  subscription_status: SubscriptionStatus;
  onboarding_status: OnboardingStatus;
  created_at: string;
  updated_at: string;
};

export type ClientInsert = Partial<Client> &
  Pick<Client, "business_name" | "owner_name" | "email">;
export type ClientUpdate = Partial<Omit<Client, "id" | "created_at">>;

export type ClientDocumentKind = "id_document" | "proof_of_address" | "other";

export type ClientDocument = {
  id: string;
  client_id: string;
  kind: ClientDocumentKind;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type ClientDocumentInsert = Partial<ClientDocument> &
  Pick<ClientDocument, "client_id" | "kind" | "storage_path">;

export type MessageLog = {
  id: string;
  client_id: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "whatsapp" | "voicemail" | "web";
  contact_name: string | null;
  contact_phone: string | null;
  body: string | null;
  transcript: string | null;
  summary: string | null;
  urgency_level: UrgencyLevel;
  created_at: string;
};

export type MessageLogInsert = Partial<MessageLog> & Pick<MessageLog, "client_id">;
export type MessageLogUpdate = Partial<Omit<MessageLog, "id" | "created_at">>;

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
      clients: {
        Row: Client;
        Insert: ClientInsert;
        Update: ClientUpdate;
        Relationships: [];
      };
      client_documents: {
        Row: ClientDocument;
        Insert: ClientDocumentInsert;
        Update: Partial<ClientDocument>;
        Relationships: [];
      };
      message_logs: {
        Row: MessageLog;
        Insert: MessageLogInsert;
        Update: MessageLogUpdate;
        Relationships: [];
      };
      leads: {
        Row: Lead;
        Insert: LeadInsert;
        Update: LeadUpdate;
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
      increment_client_minutes: {
        Args: { p_client_id: string; p_minutes: number };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
};
