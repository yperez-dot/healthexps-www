#!/usr/bin/env node
"use strict";
// Minimal DOM stubs to verify the guard merges every form field into GHL-bound posts.
const assert = require("assert");
const listeners = {};
global.window = global;
global.location = { href: "https://www.healthexps.com/medicare-plans-miami/", pathname: "/medicare-plans-miami/" };
global.document = {
  readyState: "complete",
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  querySelector: () => null,
  getElementById: () => null,
};
class FD { constructor(form) { this.e = form._entries; } forEach(cb) { this.e.forEach(([k, v]) => cb(v, k)); } }
global.FormData = FD;
const posted = [];
global.fetch = async (url, init) => { posted.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ ok: true }) }; };
require("../js/form-spam-guard.js");
const form = { tagName: "FORM", _entries: [["first_name", "Ana"], ["last_name", "Diaz"], ["phone", "3055550100"], ["coverage_type", "Medicare Advantage"], ["notes", "Takes Eliquis"], ["zip", "33155"]], getAttribute: () => "" };
listeners.submit.forEach((fn) => fn({ target: form }));
(async () => {
  // Page handler only sends 3 fields straight to the GHL webhook
  await fetch("https://services.leadconnectorhq.com/hooks/RINM4TCnM4hN06UA1aK0/webhook-trigger/dc6c8b35-9480-412e-b56d-4a4c8c7bd438", {
    method: "POST", body: JSON.stringify({ first_name: "Ana", phone: "3055550100", source: "Homepage Form" }),
  });
  const p = posted[0];
  assert.strictEqual(p.url, "/.netlify/functions/submit-lead");
  assert.strictEqual(p.body.notes, "Takes Eliquis");
  assert.strictEqual(p.body.zip, "33155");
  assert.strictEqual(p.body.coverage_type, "Medicare Advantage");
  assert.strictEqual(p.body.webhook_id, "dc6c8b35-9480-412e-b56d-4a4c8c7bd438");
  assert.strictEqual(p.body.source, "Form: /medicare-plans-miami/");
  console.log("test-form-guard-merge: ok");
})().catch((e) => { console.error(e); process.exit(1); });
