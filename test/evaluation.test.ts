import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseEvaluation } from "../lib/twilio/evaluation";

describe("parseEvaluation", () => {
  it("treats a compliant evaluation as passing", () => {
    const result = parseEvaluation({ status: "compliant", results: [] });
    assert.equal(result.compliant, true);
    assert.deepEqual(result.failures, []);
    assert.match(result.summary, /All regulatory requirements are met/);
  });

  it("reads per-field failures out of invalid[]", () => {
    const result = parseEvaluation({
      status: "noncompliant",
      results: [
        {
          requirement_friendly_name: "Proof of Address",
          passed: false,
          valid: [],
          invalid: [
            {
              friendly_name: "Utility Bill",
              object_field: "address_sids",
              failure_reason: "The address does not match the document.",
              error_code: 22217,
            },
          ],
        },
      ],
    });

    assert.equal(result.compliant, false);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].requirement, "Proof of Address");
    assert.equal(result.failures[0].field, "Utility Bill");
    assert.equal(result.failures[0].code, 22217);
    assert.match(result.summary, /does not match/);
  });

  // The trap that broke an earlier version: Twilio can fail a requirement
  // with an EMPTY invalid[], where the only reason lives one level up.
  it("keeps the reason when invalid[] is empty", () => {
    const result = parseEvaluation({
      status: "noncompliant",
      results: [
        {
          requirement_friendly_name: "Proof of Identity",
          passed: false,
          failure_reason: "No document was supplied.",
          error_code: 22215,
          valid: [],
          invalid: [],
        },
      ],
    });

    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].requirement, "Proof of Identity");
    assert.equal(result.failures[0].reason, "No document was supplied.");
  });

  it("never loses a failure just because it has no reason text", () => {
    const result = parseEvaluation({
      status: "noncompliant",
      results: [{ requirement_friendly_name: "Business Address", passed: false, invalid: [] }],
    });

    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].reason, "No reason given.");
  });

  it("falls back to advice text when only an error code is present", () => {
    const result = parseEvaluation({
      status: "noncompliant",
      results: [
        { requirement_friendly_name: "Photo ID", passed: false, error_code: 22216, invalid: [] },
      ],
    });

    assert.match(result.failures[0].reason, /expired/i);
  });

  it("reads camelCase keys, which the Node helper produces", () => {
    const result = parseEvaluation({
      status: "noncompliant",
      results: [
        {
          requirementFriendlyName: "Proof of Address",
          passed: false,
          invalid: [{ friendlyName: "Council Tax", failureReason: "Too old.", errorCode: 22216 }],
        },
      ],
    });

    assert.equal(result.failures[0].requirement, "Proof of Address");
    assert.equal(result.failures[0].field, "Council Tax");
    assert.equal(result.failures[0].reason, "Too old.");
  });

  it("ignores requirements that passed", () => {
    const result = parseEvaluation({
      status: "noncompliant",
      results: [
        { requirement_friendly_name: "Business Address", passed: true, invalid: [] },
        { requirement_friendly_name: "Photo ID", passed: false, failure_reason: "Blurry." },
      ],
    });

    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].requirement, "Photo ID");
  });

  it("does not claim compliance when Twilio gives no detail", () => {
    const result = parseEvaluation({ status: "noncompliant", results: [] });
    assert.equal(result.compliant, false);
    assert.match(result.summary, /did not say which requirement/);
  });

  it("de-duplicates identical failures and counts the rest", () => {
    const same = {
      requirement_friendly_name: "Proof of Address",
      passed: false,
      failure_reason: "Unreadable.",
    };
    const result = parseEvaluation({
      status: "noncompliant",
      results: [
        same,
        same,
        { requirement_friendly_name: "Photo ID", passed: false, failure_reason: "Expired." },
      ],
    });

    assert.match(result.summary, /^2 requirements need attention/);
  });

  it("survives junk input rather than throwing mid-call", () => {
    for (const junk of [null, undefined, {}, { results: null }, "nonsense", 42]) {
      const result = parseEvaluation(junk);
      assert.equal(result.compliant, false);
      assert.ok(result.summary.length > 0);
    }
  });
});
