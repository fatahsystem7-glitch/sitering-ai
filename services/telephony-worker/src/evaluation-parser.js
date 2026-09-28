/**
 * sitering-ai :: Twilio Evaluation result parser.
 *
 * `POST /Bundles/{sid}/Evaluations` returns granular failure reasons. Turning
 * them into something a plumber can act on is the difference between "your
 * bundle was rejected" and "the name on your passport doesn't match your account".
 *
 * Authoritative payload shape (twilio.com/docs/phone-numbers/regulatory/api/evaluations):
 *
 *   {
 *     sid, bundle_sid, regulation_sid,
 *     status: 'compliant' | 'noncompliant',
 *     results: [
 *       {
 *         friendly_name:             'Government-issued ID',
 *         object_type:               'government_issued_document',
 *         passed:                    false,
 *         failure_reason:            'A Government-issued ID is missing…',
 *         error_code:                22216,
 *         valid:                     [],
 *         invalid: [
 *           {
 *             friendly_name:  'First Name',
 *             object_field:   'first_name',
 *             failure_reason: 'The First Name is missing…',
 *             error_code:     22215
 *           }
 *         ],
 *         requirement_friendly_name: 'Proof of Identity',
 *         requirement_name:          'proof_of_identity_info'
 *       }
 *     ]
 *   }
 *
 * Note the Node helper camelCases top-level properties (`evaluation.results`) but
 * leaves the nested objects in snake_case, because they arrive as plain JSON.
 * We tolerate both spellings defensively.
 */

/** Pick whichever casing the payload happens to use. */
const pick = (obj, ...keys) => {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
  }
  return undefined;
};

/**
 * Plain-English rewrites for the failure modes UK trade contractors actually hit.
 * Twilio's own copy is accurate but written for developers.
 */
const FRIENDLY_HINTS = [
  {
    match: (p) => /does not match/i.test(p.message) && /name/i.test(p.field ?? ''),
    hint: 'The name on your document must match the name on your account exactly — including middle names and any "Ltd".',
  },
  {
    match: (p) => p.field === 'address_sids' || /address/i.test(p.requirement ?? ''),
    hint: 'Check the address is a real UK premises. PO boxes, mailbox services and virtual offices are rejected.',
  },
  {
    match: (p) => /business_registration_number|document_number/.test(p.field ?? ''),
    hint: 'Check your Companies House number (CRN) is correct — 8 characters, no spaces.',
  },
  {
    match: (p) => /is missing/i.test(p.message) && /document|passport|id/i.test(p.objectType ?? ''),
    hint: 'This document is missing or unreadable. Re-upload a clear photo with all four corners visible.',
  },
];

function hintFor(problem) {
  return FRIENDLY_HINTS.find((h) => h.match(problem))?.hint;
}

/**
 * Parse an Evaluation into structured problems plus a human summary.
 *
 * @param {object} evaluation  the Evaluation resource (helper object or raw JSON)
 * @returns {{compliant: boolean, problems: Array, summary: string|null, raw: string}}
 */
export function parseEvaluation(evaluation) {
  const status = pick(evaluation ?? {}, 'status') ?? 'noncompliant';
  const results = pick(evaluation ?? {}, 'results') ?? [];
  const compliant = status === 'compliant';

  const problems = [];

  for (const result of Array.isArray(results) ? results : []) {
    const requirement =
      pick(result, 'requirement_friendly_name', 'requirementFriendlyName') ??
      pick(result, 'friendly_name', 'friendlyName') ??
      'Requirement';
    const objectType = pick(result, 'object_type', 'objectType');
    const passed = pick(result, 'passed');
    const invalid = pick(result, 'invalid') ?? [];

    // Field-level failures are the useful ones — they name the exact input.
    for (const field of Array.isArray(invalid) ? invalid : []) {
      problems.push({
        requirement,
        objectType,
        field: pick(field, 'object_field', 'objectField'),
        fieldName: pick(field, 'friendly_name', 'friendlyName'),
        message: pick(field, 'failure_reason', 'failureReason') ?? 'Invalid.',
        code: pick(field, 'error_code', 'errorCode'),
      });
    }

    // A requirement can fail wholesale with no field detail (e.g. document absent).
    if (passed === false && (!Array.isArray(invalid) || invalid.length === 0)) {
      problems.push({
        requirement,
        objectType,
        field: null,
        fieldName: pick(result, 'friendly_name', 'friendlyName'),
        message: pick(result, 'failure_reason', 'failureReason') ?? 'This requirement was not met.',
        code: pick(result, 'error_code', 'errorCode'),
      });
    }
  }

  // Attach contractor-facing hints.
  for (const p of problems) {
    const hint = hintFor(p);
    if (hint) p.hint = hint;
  }

  return {
    compliant,
    problems,
    summary: compliant ? null : summarise(problems),
    raw: safeJson(results),
  };
}

/** One readable paragraph, grouped by requirement, capped for DB storage. */
export function summarise(problems) {
  if (!problems.length) {
    return 'Twilio reported the submission as non-compliant but gave no field-level detail.';
  }

  const byRequirement = new Map();
  for (const p of problems) {
    if (!byRequirement.has(p.requirement)) byRequirement.set(p.requirement, []);
    byRequirement.get(p.requirement).push(p);
  }

  const lines = [];
  for (const [requirement, items] of byRequirement) {
    const detail = items
      .map((i) => (i.fieldName ? `${i.fieldName} — ${i.message}` : i.message))
      .join(' ');
    const hint = items.find((i) => i.hint)?.hint;
    lines.push(`${requirement}: ${detail}${hint ? ` (${hint})` : ''}`);
  }

  return lines.join('\n').slice(0, 2000);
}

/** Which requirements failed — drives which upload slots we reopen for the tenant. */
export function failedRequirements(problems) {
  const out = new Set();
  for (const p of problems) {
    const haystack = `${p.requirement ?? ''} ${p.objectType ?? ''}`.toLowerCase();
    if (/identity|passport|government_issued|government-issued/.test(haystack)) {
      out.add('proof_of_identity');
    }
    if (/address|utility|tax|rent|title|deed/.test(haystack)) {
      out.add('proof_of_address');
    }
  }
  return [...out];
}

function safeJson(value) {
  try {
    return JSON.stringify(value).slice(0, 4000);
  } catch {
    return '[unserialisable]';
  }
}
