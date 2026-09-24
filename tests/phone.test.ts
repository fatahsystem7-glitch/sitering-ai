import assert from "node:assert/strict";
import test from "node:test";
import { phoneLookupVariants, telHref, toE164 } from "../lib/phone";
import { buildSystemPrompt } from "../lib/prompt";

test("UK numbers normalise to E.164", () => {
  assert.equal(toE164("020 7946 0958"), "+442079460958");
  assert.equal(toE164("+44 7700 900123"), "+447700900123");
  assert.equal(telHref("020 7946 0958"), "tel:+442079460958");
  assert.ok(phoneLookupVariants("020 7946 0958").includes("+442079460958"));
});

test("system prompt injects business facts and the booking tool", () => {
  const prompt = buildSystemPrompt({
    business_name: "Harrow Plumbing",
    trade_type: "Plumbing",
    service_areas: "HA1",
    callout_fee: "£95",
    booking_url: "https://example.com/book",
    services: [{ name: "Leak", price: "£80", duration: "45 mins" }],
    used_minutes: 12,
  });
  assert.match(prompt, /Harrow Plumbing/);
  assert.match(prompt, /send_booking_link/);
  assert.match(prompt, /£95/);
  assert.match(prompt, /https:\/\/example.com\/book/);
});
