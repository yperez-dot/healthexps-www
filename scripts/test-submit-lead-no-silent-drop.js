/**
 * submit-lead must never silently lose a real-looking lead.
 *  - nested { contactData } payloads are flattened and accepted
 *  - validation misses with a reachable phone/email are FORWARDED to GHL,
 *    tagged needs-review + review:<reason>
 *  - no phone and no email → 400 so the page shows an error (no fake 200)
 *  - bot signals (honeypot, too fast, bot name, promo text typed in the
 *    name/notes) are still dropped quietly
 *  - the function log never contains contact values
 * Offline: global.fetch is stubbed; nothing reaches GHL.
 */
"use strict";

const assert = require("assert");
for (const k of Object.keys(process.env)) if (/^(GHL_|ALERT_SMTP)/.test(k)) delete process.env[k];
const lead = require("../netlify/functions/submit-lead");

const ORIGIN = "https://www.healthexps.com";
const PRIMARY = "dc6c8b35-9480-412e-b56d-4a4c8c7bd438";
const ES_CALC = "28058d00-7965-45e2-ae3c-e37459f9464b";

async function post(payload) {
  const forwards = [];
  const logs = [];
  const realFetch = global.fetch;
  const { log, warn, error } = console;
  global.fetch = async (url, init) => {
    if (/leadconnectorhq\.com\/hooks\//.test(String(url))) forwards.push(JSON.parse(init.body));
    return { ok: true, status: 200, text: async () => "{}", json: async () => ({}) };
  };
  console.log = (...a) => logs.push(a.join(" "));
  console.warn = () => {};
  console.error = () => {};
  try {
    const res = await lead.handler({
      httpMethod: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ _form_loaded_at: Date.now() - 60000, page_path: "/test-page/", ...payload }),
    });
    return { status: res.statusCode, body: JSON.parse(res.body), forwards, logs: logs.join("\n") };
  } finally {
    global.fetch = realFetch;
    Object.assign(console, { log, warn, error });
  }
}

const PHONE = "3054646888";
const EMAIL = "maria.garcia@gmail.com";

(async () => {
  // 1) "Call me" strips used to post { contactData: { firstName, phone } }
  let r = await post({ webhook_id: PRIMARY, contactData: { firstName: "Maria", phone: PHONE }, tags: ["quick-callback"] });
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.ok && !r.body.filtered, "nested contactData is accepted");
  assert.strictEqual(r.forwards.length, 1);
  assert.strictEqual(r.forwards[0].first_name, "Maria");
  assert.ok(r.forwards[0].phone, "phone lifted to top level");
  assert.ok(!("contactData" in r.forwards[0]));
  assert.ok(!/needs-review/.test(r.forwards[0].tags || ""), "clean callback is not flagged");

  // 2) ES life calculator is exempt from looking_for, like the EN calculator
  r = await post({ webhook_id: ES_CALC, firstName: "Maria", lastName: "Garcia", phone: PHONE, email: EMAIL });
  assert.ok(r.body.ok && !r.body.filtered && r.forwards.length === 1);
  assert.ok(!/needs-review/.test(r.forwards[0].tags || ""), "ES calculator lead is a normal lead");

  // 3) Page attribution URLs (pageUrl etc.) are not promo spam
  r = await post({ webhook_id: "avmed-transition", firstName: "Maria", lastName: "Garcia", phone: PHONE, email: EMAIL,
    planInterest: "Medicare Advantage", pageUrl: ORIGIN + "/avmed-medicare-florida/", formSource: "avmed-transition" });
  assert.ok(r.body.ok && !r.body.filtered && r.forwards.length === 1, "AvMed lead with pageUrl is accepted");
  assert.ok(!/needs-review/.test(r.forwards[0].tags || ""));

  // 4) Missing looking_for with a phone → forwarded for review, never dropped
  r = await post({ webhook_id: PRIMARY, first_name: "Maria", last_name: "Garcia", phone: PHONE, source: "Some Page" });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.forwards.length, 1, "forwarded to GHL");
  assert.ok(/needs-review/.test(r.forwards[0].tags) && /review:missing_looking_for/.test(r.forwards[0].tags));

  // 5) Typo'd email but a good phone → forwarded for review
  r = await post({ webhook_id: PRIMARY, first_name: "Maria", phone: PHONE, email: "maria@gmail", looking_for: "Medicare" });
  assert.strictEqual(r.forwards.length, 1);
  assert.ok(/review:bad_email/.test(r.forwards[0].tags));

  // 6) Missing page timing (old cached page / script blocked) → review, not drop
  r = await post({ webhook_id: PRIMARY, first_name: "Maria", phone: PHONE, looking_for: "Medicare", _form_loaded_at: "" });
  assert.strictEqual(r.forwards.length, 1);
  assert.ok(/review:missing_or_future_timing/.test(r.forwards[0].tags));

  // 7) A URL in a non-person field only → review, not drop
  r = await post({ webhook_id: PRIMARY, first_name: "Maria", phone: PHONE, looking_for: "Medicare", campaign_link: "https://example.com/x" });
  assert.strictEqual(r.forwards.length, 1);
  assert.ok(/review:promo_spam/.test(r.forwards[0].tags));

  // 8) No phone, no email → 400 so the visitor sees an error (not a fake thank-you)
  r = await post({ webhook_id: PRIMARY, contactData: { firstName: "Maria" } });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.body.error, "missing_contact");
  assert.strictEqual(r.forwards.length, 0);

  // 9) Bots are still dropped quietly
  for (const bot of [
    { _hp_name: "x" },
    { _form_loaded_at: Date.now() - 500 },
    { first_name: "Get BTC https://graph.org/mining", last_name: "x" },
    { notes: "Earn crypto at https://bit.ly/abc wallet" },
  ]) {
    r = await post({ webhook_id: PRIMARY, first_name: "Maria", phone: PHONE, looking_for: "Medicare", ...bot });
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.filtered, "bot dropped: " + JSON.stringify(bot).slice(0, 40));
    assert.strictEqual(r.forwards.length, 0);
  }

  // 10) Logs say which fields were present — never the values
  r = await post({ webhook_id: PRIMARY, first_name: "Maria", last_name: "Garcia", phone: PHONE, email: "maria@gmail", source: "Some Page" });
  assert.ok(/needs-review: bad_email/.test(r.logs));
  assert.ok(/"phone":true/.test(r.logs));
  for (const secret of ["Maria", "Garcia", PHONE, "maria@gmail", "305"]) {
    assert.ok(!r.logs.includes(secret), "log must not contain contact values");
  }
  r = await post({ webhook_id: PRIMARY, _hp_name: "x", first_name: "Maria", phone: PHONE });
  assert.ok(/filtered: honeypot/.test(r.logs) && !r.logs.includes("Maria") && !r.logs.includes(PHONE));

  console.log("test-submit-lead-no-silent-drop: ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
