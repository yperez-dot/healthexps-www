#!/usr/bin/env node
"use strict";
const assert = require("assert");
const Module = require("module");
const sent = [];
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "nodemailer") return { createTransport: () => ({ sendMail: async (m) => { sent.push(m); } }) };
  return origLoad.call(this, req, ...rest);
};
const { handler, INTERNAL_RECIPIENTS } = require("../netlify/functions/send-email");
(async () => {
  const ev = (body, origin = "https://www.healthexps.com") => ({ httpMethod: "POST", headers: { origin }, body: JSON.stringify(body) });
  delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
  assert.strictEqual((await handler(ev({ to: "x@evil.com", html: "<b>hi</b>" }))).statusCode, 503);
  process.env.SMTP_USER = "u"; process.env.SMTP_PASS = "p";
  assert.strictEqual((await handler(ev({ to: "x@evil.com", html: "hi" }, "https://evil.com"))).statusCode, 403);
  const r = await handler(ev({ to: "victim@example.com", subject: "Hi\nBcc: a@b.c", html: "<script>x</script><a href='http://spam'>click</a>" }));
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, INTERNAL_RECIPIENTS.join(","));
  assert(!/victim@example.com/.test(sent[0].to));
  assert(!/<a href/.test(sent[0].html) && !/\n/.test(sent[0].subject));
  console.log("test-send-email-lockdown: ok");
})().catch((e) => { console.error(e); process.exit(1); });
