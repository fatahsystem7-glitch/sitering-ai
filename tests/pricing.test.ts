import assert from "node:assert/strict";
import test from "node:test";
import {
  assertEconomics,
  formatGbpFromPence,
  INFRA_COST_PENCE,
  netMargin,
  netProfitPence,
  STACK_ALLOCATION_PENCE,
  stripeFeePence,
} from "../lib/pricing";

test("plan economics match the published margin model", () => {
  assertEconomics();
  assert.equal(stripeFeePence(), 245);
  assert.equal(netProfitPence(), 13815);
  assert.equal(formatGbpFromPence(netProfitPence()), "£138.15");
  assert.equal(formatGbpFromPence(INFRA_COST_PENCE), "£9.40");
  assert.equal(formatGbpFromPence(stripeFeePence()), "£2.45");
  assert.ok(netMargin() > 0.92 && netMargin() < 0.922);
  const allocation = Object.values(STACK_ALLOCATION_PENCE).reduce((sum, value) => sum + value, 0);
  assert.equal(allocation, 940);
});
