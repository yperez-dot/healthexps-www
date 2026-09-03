#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  assessSpam,
  containsPromoSpam,
  isValidUsPhone,
  parseRequestBody,
  WEBHOOKS,
  handler,
} = require("../netlify/functions/submit-lead");

const SPAM_NAME =
  "📈 +2.84567639 BTC. GET -> Graph.org/Mining-08-27-2?hs=e1649c36669076de393a81a1fa92be32& 📈";

function baseLead(overrides) {
  return Object.assign(
    {
      first_name: "Maria",
      last_name: "Garcia",
      phone: "3054646888",
      email: "maria.garcia@gmail.com",
      private_reason: "Not sure — help me compare",
      notes: "",
      _form_loaded_at: Date.now() - 8000,
      _hp_name: "",
      page: "https://www.healthexps.com/private-health-insurance-miami",
      source: "Private Health Page Form",
    },
    overrides
  );
}

assert.strictEqual(WEBHOOKS["en-private"], "9eebf549-c131-4d43-8432-0f6628211899");

assert.strictEqual(isValidUsPhone("3054646888"), true);
assert.strictEqual(isValidUsPhone("+1 305-464-6888"), true);
assert.strictEqual(isValidUsPhone("+1 938008915156"), false);
assert.strictEqual(isValidUsPhone("9380089151"), false, "exchange cannot start with 0");

assert.ok(containsPromoSpam(SPAM_NAME), "crypto mining name must match promo spam");
assert.ok(containsPromoSpam("GET -> Graph.org/Mining-08-27-2"), "graph.org path must match");
assert.ok(!containsPromoSpam("Maria Garcia"), "plain name is not promo spam");
assert.ok(!containsPromoSpam("Not sure — help me compare"), "coverage reason is not promo spam");

assert.strictEqual(assessSpam(baseLead()), null, "real private-health lead must pass");

assert.ok(
  assessSpam(
    baseLead({
      first_name: SPAM_NAME,
      last_name: SPAM_NAME,
      phone: "+1 938008915156",
      email: "b3l6n13yur1rfk@emalupe.com",
    })
  ),
  "exact bot alert payload must be filtered"
);

const nameSpamReason = assessSpam(
  baseLead({
    first_name: SPAM_NAME,
    last_name: "Mining",
    phone: "3055551234",
    email: "b3l6n13yur1rfk@emalupe.com",
  })
);
assert.ok(
  nameSpamReason === "promo_spam" || nameSpamReason === "bot_name",
  "URL/crypto in name must be filtered even with a plausible phone, got " + nameSpamReason
);

assert.strictEqual(
  assessSpam(
    baseLead({
      notes: "GET -> Graph.org/Mining-08-27-2?hs=abc",
    })
  ),
  "promo_spam",
  "graph.org promo in notes must be filtered"
);

assert.strictEqual(
  assessSpam(baseLead({ phone: "+1 938008915156" })),
  "bad_phone"
);

const urlencoded = parseRequestBody({
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "source_key=en-private&first_name=Maria&last_name=Garcia&phone=3054646888",
});
assert.strictEqual(urlencoded.source_key, "en-private");
assert.strictEqual(urlencoded.first_name, "Maria");

(async function () {
  const res = await handler({
    httpMethod: "POST",
    headers: { origin: "https://www.healthexps.com" },
    body: JSON.stringify(
      baseLead({
        source_key: "en-private",
        first_name: SPAM_NAME,
        last_name: "Bot",
        phone: "3055551234",
        email: "b3l6n13yur1rfk@emalupe.com",
      })
    ),
  });
  const body = JSON.parse(res.body);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.filtered, true);

  const html = fs.readFileSync(
    path.join(__dirname, "..", "private-health-insurance-miami.html"),
    "utf8"
  );
  assert.ok(
    !html.includes("leadconnectorhq.com/hooks"),
    "private health form must not expose the GHL webhook URL"
  );
  assert.ok(html.includes('data-spam-guard="proxy"'));
  assert.ok(html.includes('name="source_key"'));
  assert.ok(html.includes("en-private"));

  console.log("test-submit-lead-spam: ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
