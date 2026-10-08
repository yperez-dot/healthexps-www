#!/usr/bin/env node
"use strict";
const assert = require("assert");
const { sendLeadAlert, buildAlert, ALERT_CONTACT_ID } = require("../netlify/lib/lead-alert");
const data = { first_name: "Mary", last_name: "Tester", phone: "2395550100", email: "lead@example.com", health_system: "Lee Health", current_carrier: "Wellcare", zip_code: "33901" };
const payload = { page_path: "/blog/x/", page: "https://www.healthexps.com/blog/x/", submitted_at: "2026-10-08T01:00:00Z" };
const a = buildAlert(data, payload, { contactId: "LEAD1", pageLabel: "Blog X" });
assert.strictEqual(a.subject, "NEW WEBSITE LEAD: Mary Tester (Blog X)");
assert(/Health system: Lee Health/.test(a.text) && /ZIP: 33901/.test(a.text) && /contacts\/detail\/LEAD1/.test(a.text) && /ET/.test(a.text));
(async () => {
  delete process.env.GHL_API_TOKEN; delete process.env.TELEGRAM_BOT_TOKEN;
  assert.deepStrictEqual(await sendLeadAlert(data, payload, {}), { email_ghl: "skip:no_token", telegram: "skip:no_telegram" });
  process.env.GHL_API_TOKEN = "t"; process.env.TELEGRAM_BOT_TOKEN = "b"; process.env.TELEGRAM_YAHOSKA_CHAT_ID = "999";
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, status: 200, text: async () => "{}" }; };
  const r = await sendLeadAlert(data, payload, { contactId: "LEAD1", pageLabel: "Blog X" });
  assert.deepStrictEqual(r, { email_ghl: "ok", telegram: "ok" });
  const g = calls.find((c) => c.url.includes("/conversations/messages"));
  assert.strictEqual(g.body.contactId, ALERT_CONTACT_ID, "email must go to Yahoska's contact");
  assert.notStrictEqual(g.body.contactId, "LEAD1");
  assert(!("emailTo" in g.body));
  const t = calls.find((c) => c.url.includes("api.telegram.org"));
  assert.strictEqual(t.body.chat_id, "999");
  // Lead that IS the alert contact → no email
  calls.length = 0;
  const r2 = await sendLeadAlert(data, payload, { contactId: ALERT_CONTACT_ID });
  assert.strictEqual(r2.email_ghl, "skip:lead_is_alert_contact");
  console.log("test-lead-alert: ok");
})().catch((e) => { console.error(e); process.exit(1); });
