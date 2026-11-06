#!/usr/bin/env node
"use strict";
/**
 * /contact/ leads must:
 *  - forward GHL-compatible aliases (firstName, E.164 phone, message, reason)
 *    so the Contact Page workflow maps Name/Phone/Email/Reason/Notes;
 *  - upsert + tag the contact BEFORE posting the inbound webhook, so the
 *    workflow enrolls the same record enrich uses;
 *  - include the visitor's notes in the staff SMS recap.
 * Offline: global.fetch is stubbed; nothing reaches GHL.
 */
const assert = require("assert");
for (const k of Object.keys(process.env)) if (/^(GHL_|ALERT_SMTP)/.test(k)) delete process.env[k];

const { buildForwardPayload, handler, WEBHOOKS } = require("../netlify/functions/submit-lead");

const CONTACT_HOOK = WEBHOOKS["en-contact"];
assert.strictEqual(CONTACT_HOOK, "1238c14d-f70a-49d5-a409-32d8e055d735");

const fwd = buildForwardPayload({
  first_name: "Stacy",
  last_name: "Nicole",
  phone: "(305) 555-0199",
  email: "stacy@example.com",
  coverage_type: "Medicare — Advantage, Supplement or Part D",
  looking_for: "Medicare — Advantage, Supplement or Part D",
  notes: "Please call about my plan change.",
  additional_notes: "Please call about my plan change.",
  source_key: "en-contact",
  source: "Contact Page Form",
  page: "https://www.healthexps.com/contact/",
  page_path: "/contact/",
  _form_loaded_at: Date.now() - 8000,
});
assert.strictEqual(fwd.first_name, "Stacy");
assert.strictEqual(fwd.firstName, "Stacy");
assert.strictEqual(fwd.lastName, "Nicole");
assert.strictEqual(fwd.name, "Stacy Nicole");
assert.strictEqual(fwd.phone, "+13055550199");
assert.strictEqual(fwd.phone_number, "3055550199");
assert.strictEqual(fwd.message, "Please call about my plan change.");
assert.strictEqual(fwd.reason, "Medicare — Advantage, Supplement or Part D");
assert.strictEqual(fwd.looking_for, "Medicare — Advantage, Supplement or Part D");
assert(/website-lead/.test(fwd.tags));
assert(/Please call about my plan change/.test(fwd.additional_notes));
assert(/Form page: \/contact\//.test(fwd.additional_notes));

const ORIGIN = "https://www.healthexps.com";
const r = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o), json: async () => o });

(async () => {
  process.env.GHL_API_TOKEN = "test-token";
  const calls = [];
  global.fetch = async (url, init) => {
    const u = String(url);
    const m = (init && init.method) || "GET";
    const body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ m, u, body });
    if (u.includes("/contacts/search/duplicate")) return r({});
    if (/\/contacts\/\?/.test(u)) return r({ contacts: [] });
    if (u.includes("/contacts/upsert")) return r({ contact: { id: "UUeKn3UNw3FySomzRJGo" } });
    if (u.includes("/opportunities/search")) {
      return r({
        opportunities: [{ id: "O1", name: "Stacy Nicole — Contact Page Form", pipelineId: "iziaGFnVZle64waSZJff", status: "open", assignedTo: "x" }],
      });
    }
    if (u.includes("/conversations/messages")) return r({ messageId: "m1" });
    if (/hooks\/.*\/webhook-trigger\//.test(u)) return r({});
    return r({});
  };

  const res = await handler({
    httpMethod: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({
      source_key: "en-contact",
      source: "Contact Page Form",
      first_name: "Stacy",
      last_name: "Nicole",
      phone: "3055550199",
      email: "stacy@example.com",
      coverage_type: "Medicare — Advantage, Supplement or Part D",
      looking_for: "Medicare — Advantage, Supplement or Part D",
      notes: "Please call about my plan change.",
      additional_notes: "Please call about my plan change.",
      page: "https://www.healthexps.com/contact/",
      page_path: "/contact/",
      _form_loaded_at: Date.now() - 8000,
    }),
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).ok, true);

  const upsertAt = calls.findIndex((c) => c.u.includes("/contacts/upsert"));
  const tagsAt = calls.findIndex((c) => /\/contacts\/[^/?]+\/tags$/.test(c.u) && c.m === "POST");
  const hookAt = calls.findIndex((c) => /webhook-trigger\/1238c14d-f70a-49d5-a409-32d8e055d735/.test(c.u));
  const smsAt = calls.findIndex((c) => c.u.includes("/conversations/messages") && c.body && c.body.type === "SMS");
  assert(upsertAt >= 0, "upserts the contact");
  assert(tagsAt >= 0, "tags the contact");
  assert(hookAt >= 0, "posts the Contact Page webhook");
  assert(smsAt >= 0, "sends staff SMS");
  assert(upsertAt < hookAt, "upsert before webhook so workflow enrolls the same contact");
  assert(tagsAt < hookAt, "website-lead tag before webhook Tag condition");

  const hookBody = calls[hookAt].body;
  assert.strictEqual(hookBody.firstName, "Stacy");
  assert.strictEqual(hookBody.phone, "+13055550199");
  assert.strictEqual(hookBody.message, "Please call about my plan change.");
  assert.strictEqual(hookBody.reason, "Medicare — Advantage, Supplement or Part D");
  assert.strictEqual(hookBody.email, "stacy@example.com");

  const smsBodies = calls.filter((c) => c.body && c.body.type === "SMS").map((c) => c.body.message);
  assert(smsBodies.length >= 2, "SMS to both staff contacts");
  for (const msg of smsBodies) {
    assert(/Stacy Nicole/.test(msg), msg);
    assert(/Please call about my plan change/.test(msg), msg);
    assert(/Medicare — Advantage/.test(msg), msg);
    assert(/stacy@example.com/.test(msg), msg);
    assert(!/Form page:/.test(msg), msg);
  }
  assert(!smsBodies.some((m) => /UUeKn3UNw3FySomzRJGo/.test(m)));

  console.log("test-contact-lead-sms: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
