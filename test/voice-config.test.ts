import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderAdminConfigPrompt, adminConfigOpener } from "../lib/prompts/admin-config";
import { renderReceptionistPrompt } from "../lib/prompts/receptionist";
import {
  receptionistConfigSchema,
  // The mapping under test lives inside applyReceptionistConfigUpdate's
  // module; we validate the schema and re-derive the mapping contract here.
} from "../lib/voice/receptionist-config";
import { normalizeFishModel } from "../lib/voice/options";

describe("admin voice-session prompt", () => {
  it("carries the current parameters and the save-as-you-go rule", () => {
    const prompt = renderAdminConfigPrompt({
      businessName: "Baxter Plumbing & Heating",
      tradeType: "Plumbing",
      operatingHours: "Mon–Fri 8am–6pm",
      services: ["Emergency callouts", "Repairs"],
      greetingStyle: "Friendly and casual",
      customInstructions: "Never promise same-day fitting.",
      assignedNumber: "+442045770123",
    });

    assert.match(prompt, /Baxter Plumbing & Heating/);
    assert.match(prompt, /Mon–Fri 8am–6pm/);
    assert.match(prompt, /Emergency callouts/);
    assert.match(prompt, /Friendly and casual/);
    assert.match(prompt, /Never promise same-day fitting/);
    assert.match(prompt, /\+442045770123/);
    assert.match(prompt, /update_receptionist_config/);
    assert.match(prompt, /one topic at a time/i);
    // The prompt must forbid inventing values.
    assert.match(prompt, /never invent one/i);
  });

  it("handles an account with nothing configured yet", () => {
    const prompt = renderAdminConfigPrompt({ businessName: "New Co" });
    assert.match(prompt, /Not set/);
    assert.match(prompt, /None recorded yet/);
  });

  it("opens by naming the account and offering the topics", () => {
    const opener = adminConfigOpener("Baxter Plumbing");
    assert.match(opener, /Baxter Plumbing/);
    assert.match(opener, /operating hours/);
  });
});

describe("receptionist prompt (client accounts)", () => {
  it("keeps greeting style out of the base prompt but includes facts", () => {
    const prompt = renderReceptionistPrompt({
      business_name: "AquaFix",
      trade_type: "Plumbing",
      operating_hours: "9–5",
      services: [{ name: "Callout", price: "£80" }],
    });
    assert.match(prompt, /AquaFix/);
    assert.match(prompt, /9–5/);
    assert.match(prompt, /£80/);
    // The agent appends greeting style separately — the base prompt must
    // never claim a tone that was not configured.
    assert.doesNotMatch(prompt, /Greeting style requested/);
  });
});

describe("receptionist config patch schema", () => {
  it("accepts the fields the voice agent captures", () => {
    const parsed = receptionistConfigSchema.parse({
      business_name: "Baxter Plumbing",
      operating_hours: "Mon–Fri 8am–6pm",
      services: ["Emergency callouts", "Repairs & maintenance"],
      greeting_style: "Professional and formal",
      custom_instructions: "No new-build work.",
    });
    assert.equal(parsed.business_name, "Baxter Plumbing");
    assert.deepEqual(parsed.services, ["Emergency callouts", "Repairs & maintenance"]);
  });

  it("rejects malformed fields and strips unknown ones", () => {
    assert.equal(receptionistConfigSchema.safeParse({ services: ["", "  "] }).success, false);
    assert.equal(
      receptionistConfigSchema.safeParse({ business_name: "x" }).success,
      false,
    );
    // Unknown keys must never reach the client record — zod strips them.
    const parsed = receptionistConfigSchema.parse({
      nastiness: "drop table",
      business_name: "Valid Co",
    });
    assert.equal("nastiness" in parsed, false);
    assert.equal(parsed.business_name, "Valid Co");
  });

  it("allows every field to be optional", () => {
    assert.deepEqual(receptionistConfigSchema.parse({}), {});
  });
});

describe("modular provider helpers", () => {
  it("normalises the Voice Studio model id for the Fish Audio plugin", () => {
    assert.equal(normalizeFishModel("fishaudio/s2.1-pro"), "s2.1-pro");
    assert.equal(normalizeFishModel("s2.1-pro"), "s2.1-pro");
    assert.equal(normalizeFishModel("fishaudio/s2.1-mini"), "s2.1-mini");
  });
});
