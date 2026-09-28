/**
 * Turns a Twilio Regulatory Compliance *Evaluation* into something a UK
 * contractor can act on.
 *
 * The shape is easy to get wrong. An evaluation looks like:
 *
 *   { status: "noncompliant", results: [ {
 *       friendly_name, requirement_friendly_name, requirement_name,
 *       passed, failure_reason, error_code,
 *       valid: [],
 *       invalid: [ { friendly_name, object_field, failure_reason, error_code } ]
 *   } ] }
 *
 * Two traps:
 *   1. A requirement can fail with an EMPTY `invalid` array — the reason then
 *      only exists at the requirement level. Reading `invalid` alone loses it.
 *   2. The Node helper camelCases top-level keys only, so nested objects stay
 *      snake_case. Both spellings are read below.
 */

export type EvaluationFailure = {
  /** What Twilio calls the failing requirement, e.g. "Proof of Address". */
  requirement: string;
  /** The specific field, when Twilio narrows it down. */
  field?: string;
  /** Twilio's own wording. */
  reason: string;
  code?: number;
};

export type ParsedEvaluation = {
  compliant: boolean;
  status: string;
  failures: EvaluationFailure[];
  /** One plain-English paragraph safe to show a contractor or email them. */
  summary: string;
};

type Loose = Record<string, unknown>;

function pick(obj: Loose | undefined, ...keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickNumber(obj: Loose | undefined, ...keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number") return value;
  }
  return undefined;
}

/** Twilio error codes seen on GB bundles, mapped to something actionable. */
const CODE_ADVICE: Record<number, string> = {
  22214: "The document is unreadable or the wrong type.",
  22215: "A required field is missing.",
  22216: "The document has expired.",
  22217: "The details do not match the address on file.",
  22219: "The document could not be verified.",
};

export function parseEvaluation(evaluation: unknown): ParsedEvaluation {
  const root = (evaluation ?? {}) as Loose;
  const status = pick(root, "status") ?? "unknown";
  const compliant = status === "compliant";

  const rawResults = (root.results ?? []) as Loose[];
  const failures: EvaluationFailure[] = [];

  for (const result of Array.isArray(rawResults) ? rawResults : []) {
    if (result?.passed === true) continue;

    const requirement =
      pick(result, "requirement_friendly_name", "requirementFriendlyName") ??
      pick(result, "friendly_name", "friendlyName") ??
      pick(result, "requirement_name", "requirementName") ??
      "Unnamed requirement";

    const invalid = (result?.invalid ?? []) as Loose[];

    if (Array.isArray(invalid) && invalid.length > 0) {
      for (const item of invalid) {
        const code = pickNumber(item, "error_code", "errorCode");
        failures.push({
          requirement,
          field: pick(item, "friendly_name", "friendlyName", "object_field", "objectField"),
          reason:
            pick(item, "failure_reason", "failureReason") ??
            (code !== undefined ? CODE_ADVICE[code] : undefined) ??
            "No reason given.",
          code,
        });
      }
      continue;
    }

    // Requirement failed with no per-field detail — keep the top-level reason.
    const code = pickNumber(result, "error_code", "errorCode");
    failures.push({
      requirement,
      reason:
        pick(result, "failure_reason", "failureReason") ??
        (code !== undefined ? CODE_ADVICE[code] : undefined) ??
        "No reason given.",
      code,
    });
  }

  return { compliant, status, failures, summary: summarise(compliant, failures) };
}

function summarise(compliant: boolean, failures: EvaluationFailure[]): string {
  if (compliant) return "All regulatory requirements are met.";
  if (failures.length === 0) {
    return "Twilio marked the bundle as non-compliant but did not say which requirement failed. Contact support so we can re-submit.";
  }

  const lines = failures.map((f) => {
    const where = f.field ? `${f.requirement} (${f.field})` : f.requirement;
    return `${where}: ${f.reason}`;
  });

  const unique = Array.from(new Set(lines));
  return unique.length === 1
    ? unique[0]
    : `${unique.length} requirements need attention. ${unique.join(" ")}`;
}
