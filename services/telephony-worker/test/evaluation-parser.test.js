import test from 'node:test';
import assert from 'node:assert/strict';

import { parseEvaluation, summarise, failedRequirements } from '../src/evaluation-parser.js';
import {
  noncompliantBusiness,
  noncompliantSoleTrader,
  noncompliantNoFieldDetail,
  compliant,
  helperCamelCase,
  malformed,
} from './fixtures/evaluations.js';

test('compliant evaluation produces no problems and no summary', () => {
  const result = parseEvaluation(compliant);
  assert.equal(result.compliant, true);
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary, null);
});

test('extracts every field-level failure from the documented business payload', () => {
  const { compliant: ok, problems } = parseEvaluation(noncompliantBusiness);
  assert.equal(ok, false);

  // 4 invalid fields on the Business requirement + 1 on the address requirement.
  assert.equal(problems.length, 5);

  const fields = problems.map((p) => p.field);
  assert.deepEqual(fields, [
    'business_name',
    'business_registration_number',
    'first_name',
    'last_name',
    'address_sids',
  ]);

  const first = problems[0];
  assert.equal(first.requirement, 'Business');
  assert.equal(first.fieldName, 'Business Name');
  assert.equal(first.code, 22215);
  assert.match(first.message, /Business Name is missing/);
});

test('summary groups by requirement and stays under the DB cap', () => {
  const { summary } = parseEvaluation(noncompliantBusiness);
  assert.ok(summary.includes('Business:'));
  assert.ok(summary.includes('Business Address (Proof of Address):'));
  assert.ok(summary.length <= 2000);
  // Two requirements -> two lines.
  assert.equal(summary.split('\n').length, 2);
});

test('a requirement failing with no field detail still surfaces', () => {
  const { problems, summary } = parseEvaluation(noncompliantNoFieldDetail);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].field, null);
  assert.match(problems[0].message, /Government-issued ID is missing/);
  assert.match(summary, /Proof of Identity/);
});

test('handles the helper library camelCase spelling', () => {
  const { problems } = parseEvaluation(helperCamelCase);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].field, 'last_name');
  assert.equal(problems[0].requirement, 'Proof of Identity');
  assert.match(problems[0].message, /does not match/);
});

test('name-mismatch failures get a contractor-facing hint', () => {
  const { problems } = parseEvaluation(helperCamelCase);
  assert.match(problems[0].hint, /must match the name on your account/i);
});

test('address failures get the PO box hint', () => {
  const { problems } = parseEvaluation(noncompliantBusiness);
  const addressProblem = problems.find((p) => p.field === 'address_sids');
  assert.match(addressProblem.hint, /PO box/i);
});

test('failedRequirements maps sole-trader failures to upload slots', () => {
  const { problems } = parseEvaluation(noncompliantSoleTrader);
  const reqs = failedRequirements(problems);
  assert.deepEqual(reqs.sort(), ['proof_of_address', 'proof_of_identity']);
});

test('failedRequirements returns nothing for a business-only failure set', () => {
  const problems = [
    { requirement: 'Business', objectType: 'business', field: 'business_name', message: 'x' },
  ];
  assert.deepEqual(failedRequirements(problems), []);
});

test('never throws on malformed or beta-changed payloads', () => {
  for (const [i, payload] of malformed.entries()) {
    assert.doesNotThrow(() => {
      const result = parseEvaluation(payload);
      assert.equal(typeof result.compliant, 'boolean');
      assert.ok(Array.isArray(result.problems));
    }, `malformed fixture #${i} threw`);
  }
});

test('noncompliant with zero parseable detail still yields actionable copy', () => {
  const { summary } = parseEvaluation({ status: 'noncompliant', results: [] });
  assert.match(summary, /no field-level detail/i);
});

test('summarise is safe on an empty problem list', () => {
  assert.equal(typeof summarise([]), 'string');
});

test('undefined / null input does not crash', () => {
  assert.doesNotThrow(() => parseEvaluation(undefined));
  assert.doesNotThrow(() => parseEvaluation(null));
});
