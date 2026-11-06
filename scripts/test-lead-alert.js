#!/usr/bin/env node
"use strict";
const assert = require("assert");
const { sendLeadAlert, buildAlert, SMS_RECIPIENTS } = require("../netlify/lib/lead-alert");
const data = { first_name: "Mary", last_name: "Tester", phone: "2395550100", email: "lead@example.com", health_system: "Lee Health", current_carrier: "Wellcare", zip_code: "33901" };
const payload = { page_path: "/blog/x/", page: "https://www.healthexps.com/blog/x/", submitted_at: "2026-10-08T01:00:00Z" };
const a = buildAlert(data, payload, { contactId: "LEAD1", pageLabel: "Blog X" });
assert.strictEqual(a.subject, "NEW WEBSITE LEAD: Mary Tester (Blog X)");
assert(/Health system: Lee Health/.test(a.text) && /ZIP: 33901/.test(a.text) && /contacts\/detail\/LEAD1/.test(a.text) && /ET/.test(a.text));
(async () => {
  assert.strictEqual(
    a.sms,
    "New website lead: Mary Tester | 2395550100 | lead@example.com | Lee Health, Wellcare, 33901"
  );
  const contactSms = buildAlert(
    {
      first_name: "Stacy",
      last_name: "Nicole",
      phone: "3055550199",
      email: "stacy@example.com",
      coverage_type: "Medicare — Advantage, Supplement or Part D",
      looking_for: "Medicare — Advantage, Supplement or Part D",
      additional_notes: "Please call about my plan change.\n\nForm page: /contact/",
      notes: "Please call about my plan change.\n\nForm page: /contact/",
    },
    { page_path: "/contact/", page: "https://www.healthexps.com/contact/", submitted_at: "2026-11-06T08:35:00Z" },
    { contactId: "LEAD9", pageLabel: "Contact Page Form" }
  );
  assert(/Please call about my plan change/.test(contactSms.sms), contactSms.sms);
  assert(/Medicare — Advantage/.test(contactSms.sms), contactSms.sms);
  assert(/stacy@example.com/.test(contactSms.sms), contactSms.sms);
  assert(!/Form page:/.test(contactSms.sms), "SMS must not include the Form page stamp");
  assert(/Notes: Please call about my plan change/.test(contactSms.text));
  assert(!/Form page:/.test(contactSms.text.split("Answers:")[0]));
  delete process.env.GHL_API_TOKEN;
  assert.deepStrictEqual(await sendLeadAlert(data, payload, {}), { email: "disabled", sms: { all: "skip:no_token" } });
  process.env.GHL_API_TOKEN = "t";
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, status: 200, text: async () => "{}" }; };
  const r = await sendLeadAlert(data, payload, { contactId: "LEAD1", pageLabel: "Blog X" });
  assert.strictEqual(r.email, "disabled");
  assert(!("email_ghl" in r) && !("email_smtp" in r), "no email path runs");
  assert.deepStrictEqual(r.sms, { "Yahoska Perez": "ok", "Katy Robles": "ok" });
  assert(!calls.some((c) => c.body.type === "Email"), "email alert is disabled");
  const smsCalls = calls.filter((c) => c.body.type === "SMS");
  assert.deepStrictEqual(smsCalls.map((c) => c.body.contactId).sort(), SMS_RECIPIENTS.map((x) => x.contactId).sort(), "SMS only to staff contacts");
  assert(!smsCalls.some((c) => c.body.contactId === "LEAD1" || "toNumber" in c.body));
  assert(!calls.some((c) => c.url.includes("telegram")));
  // Lead using Katy's phone → Katy not texted
  const r3 = await sendLeadAlert({ ...data, phone: "(786) 971-7125" }, payload, { contactId: "LEAD2" });
  assert.strictEqual(r3.sms["Katy Robles"], "skip:lead_is_staff");
  global.fetch = async () => ({ ok: false, status: 401, text: async () => '{"message":"Unauthorized"}' });
  const r401 = await sendLeadAlert(data, payload, { contactId: "LEAD1" });
  assert(/401 conversations_scope_or_token/.test(r401.sms["Yahoska Perez"]), r401.sms["Yahoska Perez"]);
  console.log("test-lead-alert: ok");
})().catch((e) => { console.error(e); process.exit(1); });
