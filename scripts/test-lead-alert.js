#!/usr/bin/env node
"use strict";
const assert = require("assert");
const { sendLeadAlert, buildAlert, ALERT_CONTACT_ID, SMS_RECIPIENTS } = require("../netlify/lib/lead-alert");
const data = { first_name: "Mary", last_name: "Tester", phone: "2395550100", email: "lead@example.com", health_system: "Lee Health", current_carrier: "Wellcare", zip_code: "33901" };
const payload = { page_path: "/blog/x/", page: "https://www.healthexps.com/blog/x/", submitted_at: "2026-10-08T01:00:00Z" };
const a = buildAlert(data, payload, { contactId: "LEAD1", pageLabel: "Blog X" });
assert.strictEqual(a.subject, "NEW WEBSITE LEAD: Mary Tester (Blog X)");
assert(/Health system: Lee Health/.test(a.text) && /ZIP: 33901/.test(a.text) && /contacts\/detail\/LEAD1/.test(a.text) && /ET/.test(a.text));
(async () => {
  assert(/^New website lead: Mary Tester 2395550100 - x - Lee Health, Wellcare, 33901$/.test(a.sms), a.sms);
  delete process.env.GHL_API_TOKEN;
  assert.deepStrictEqual(await sendLeadAlert(data, payload, {}), { email_ghl: "skip:no_token", sms: { all: "skip:no_token" } });
  process.env.GHL_API_TOKEN = "t";
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, status: 200, text: async () => "{}" }; };
  const r = await sendLeadAlert(data, payload, { contactId: "LEAD1", pageLabel: "Blog X" });
  assert.strictEqual(r.email_ghl, "ok");
  assert.deepStrictEqual(r.sms, { "Yahoska Perez": "ok", "Katy Robles": "ok" });
  const g = calls.find((c) => c.url.includes("/conversations/messages"));
  assert.strictEqual(g.body.contactId, ALERT_CONTACT_ID, "email must go to Yahoska's contact");
  assert.notStrictEqual(g.body.contactId, "LEAD1");
  assert(!("emailTo" in g.body));
  const smsCalls = calls.filter((c) => c.body.type === "SMS");
  assert.deepStrictEqual(smsCalls.map((c) => c.body.contactId).sort(), SMS_RECIPIENTS.map((x) => x.contactId).sort(), "SMS only to staff contacts");
  assert(!smsCalls.some((c) => c.body.contactId === "LEAD1" || "toNumber" in c.body));
  assert(!calls.some((c) => c.url.includes("telegram")));
  // Lead that IS the alert contact → no email
  calls.length = 0;
  const r2 = await sendLeadAlert(data, payload, { contactId: ALERT_CONTACT_ID });
  assert.strictEqual(r2.email_ghl, "skip:lead_is_alert_contact");
  // Lead using Katy's phone → Katy not texted
  const r3 = await sendLeadAlert({ ...data, phone: "(786) 971-7125" }, payload, { contactId: "LEAD2" });
  assert.strictEqual(r3.sms["Katy Robles"], "skip:lead_is_staff");
  console.log("test-lead-alert: ok");
})().catch((e) => { console.error(e); process.exit(1); });
