/**
 * Twilio Evaluation fixtures.
 *
 * `noncompliantBusiness` is copied VERBATIM from Twilio's own API reference
 * (twilio.com/docs/phone-numbers/regulatory/api/evaluations) so our parser is
 * tested against the documented contract rather than our assumptions about it.
 *
 * The sole-trader fixtures are constructed to the same schema for the GB
 * individual regulation. Flagged below as synthetic — replace them with a real
 * captured payload the first time a live sole-trader bundle is rejected.
 */

/** VERBATIM from Twilio docs. Do not "tidy" this. */
export const noncompliantBusiness = {
  sid: 'ELaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  account_sid: 'ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  regulation_sid: 'RNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  bundle_sid: 'BUXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  status: 'noncompliant',
  date_created: '2020-04-28T18:14:01Z',
  results: [
    {
      friendly_name: 'Business',
      object_type: 'business',
      passed: false,
      failure_reason: 'A Business End-User is missing. Please add one to the regulatory bundle.',
      error_code: 22214,
      valid: [],
      invalid: [
        {
          friendly_name: 'Business Name',
          object_field: 'business_name',
          failure_reason:
            'The Business Name is missing. Please enter in a Business Name on the Business information.',
          error_code: 22215,
        },
        {
          friendly_name: 'Business Registration Number',
          object_field: 'business_registration_number',
          failure_reason:
            'The Business Registration Number is missing. Please enter in a Business Registration Number on the Business information.',
          error_code: 22215,
        },
        {
          friendly_name: 'First Name',
          object_field: 'first_name',
          failure_reason:
            'The First Name is missing. Please enter in a First Name on the Business information.',
          error_code: 22215,
        },
        {
          friendly_name: 'Last Name',
          object_field: 'last_name',
          failure_reason:
            'The Last Name is missing. Please enter in a Last Name on the Business information.',
          error_code: 22215,
        },
      ],
      requirement_friendly_name: 'Business',
      requirement_name: 'business_info',
    },
    {
      friendly_name: 'Excerpt from the commercial register showing French address',
      object_type: 'commercial_registrar_excerpt',
      passed: false,
      failure_reason:
        'An Excerpt from the commercial register showing French address is missing. Please add one to the regulatory bundle.',
      error_code: 22216,
      valid: [],
      invalid: [
        {
          friendly_name: 'Address sid(s)',
          object_field: 'address_sids',
          failure_reason:
            'The Address is missing. Please enter in the address shown on the Excerpt from the commercial register showing French address.',
          error_code: 22219,
        },
      ],
      requirement_friendly_name: 'Business Address (Proof of Address)',
      requirement_name: 'business_address_proof_info',
    },
  ],
};

/** SYNTHETIC — same schema, GB individual regulation. Replace with a real capture. */
export const noncompliantSoleTrader = {
  sid: 'ELbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  bundle_sid: 'BUbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  status: 'noncompliant',
  results: [
    {
      friendly_name: 'Passport',
      object_type: 'passport',
      passed: false,
      failure_reason: 'A Passport is missing. Please add one to the regulatory bundle.',
      error_code: 22216,
      valid: [],
      invalid: [
        {
          friendly_name: 'First Name',
          object_field: 'first_name',
          failure_reason:
            'The First Name is missing. Or, it does not match the First Name you entered within Individual information.',
          error_code: 22217,
        },
      ],
      requirement_friendly_name: 'Proof of Identity',
      requirement_name: 'proof_of_identity',
    },
    {
      friendly_name: 'Utility bill',
      object_type: 'utility_bill',
      passed: false,
      failure_reason: 'A Utility bill is missing. Please add one to the regulatory bundle.',
      error_code: 22216,
      valid: [],
      invalid: [],
      requirement_friendly_name: 'Proof of Address',
      requirement_name: 'individual_address_info',
    },
  ],
};

/** A requirement that fails wholesale with no field-level detail. */
export const noncompliantNoFieldDetail = {
  status: 'noncompliant',
  results: [
    {
      friendly_name: 'Government-issued ID',
      object_type: 'government_issued_document',
      passed: false,
      failure_reason: 'A Government-issued ID is missing. Please add one to the regulatory bundle.',
      error_code: 22216,
      valid: [],
      invalid: [],
      requirement_friendly_name: 'Proof of Identity',
      requirement_name: 'proof_of_identity',
    },
  ],
};

export const compliant = {
  sid: 'ELcccccccccccccccccccccccccccccccc',
  bundle_sid: 'BUcccccccccccccccccccccccccccccccc',
  status: 'compliant',
  results: [
    {
      friendly_name: 'Individual',
      object_type: 'individual',
      passed: true,
      valid: [{ friendly_name: 'First Name', object_field: 'first_name' }],
      invalid: [],
      requirement_friendly_name: 'Individual',
      requirement_name: 'individual_info',
    },
  ],
};

/** The Node helper camelCases top-level props; nested JSON stays snake_case. */
export const helperCamelCase = {
  status: 'noncompliant',
  results: [
    {
      friendlyName: 'Passport',
      objectType: 'passport',
      passed: false,
      failureReason: 'A Passport is missing.',
      errorCode: 22216,
      invalid: [
        {
          friendlyName: 'Last Name',
          objectField: 'last_name',
          failureReason: 'The Last Name does not match.',
          errorCode: 22217,
        },
      ],
      requirementFriendlyName: 'Proof of Identity',
    },
  ],
};

/** Defensive cases — Twilio is in public beta and has changed shapes before. */
export const malformed = [
  {},
  { status: 'noncompliant' },
  { status: 'noncompliant', results: null },
  { status: 'noncompliant', results: 'unexpected string' },
  { status: 'noncompliant', results: [{ passed: false }] },
  { status: 'noncompliant', results: [{ passed: false, invalid: 'nope' }] },
];
