#!/usr/bin/env node
"use strict";
const assert = require("assert");
const { enrichLead, answerLines, pageTag, pageLabel, extractZip } = require("../netlify/lib/ghl-enrich");

const blog = {
  first_name: "Mary", last_name: "Tester", phone: "2395550100", email: "mary@example.com",
  health_system: "Lee Health", current_carrier: "UnitedHealthcare / AARP", zip_code: "33901",
  consent: "on", _hp_name: "", source_key: "aep-2027", tags: "aep-2027,network-alert",
  source: "2027 Southwest Florida Network Alert Blog", lang: "english",
  page: "https://www.healthexps.com/blog/lee-health-nch-medicare-network-changes-2027/",
};
const lines = answerLines(blog);
assert(lines.includes("Health system: Lee Health"));
assert(lines.includes("Current carrier / plan: UnitedHealthcare / AARP"));
assert(lines.includes("ZIP: 33901"));
assert(!lines.some((l) => /consent|source key|hp/i.test(l)));
assert.strictEqual(extractZip(blog), "33901");
assert.strictEqual(pageTag("/"), "web:homepage");
assert.strictEqual(pageTag("/es/"), "web:es-homepage");
assert.strictEqual(pageTag("/blog/lee-health-nch-medicare-network-changes-2027/"), "web:blog-lee-health-nch-medicare-network-changes-2027");
assert.strictEqual(pageLabel({ source: "Homepage Form" }, "/"), "Homepage Form");
assert.strictEqual(pageLabel({ source: "Homepage Form" }, "/es/"), "Spanish Homepage Form");

(async () => {
  // No token → skipped, no network
  delete process.env.GHL_API_TOKEN;
  assert.deepStrictEqual(await enrichLead(blog, {}), { skipped: "no_token" });

  // Mocked GHL: contact exists (workflow created it) with "homepage" tag + "— Homepage" opp
  process.env.GHL_API_TOKEN = "test";
  const calls = [];
  global.fetch = async (url, init) => {
    const u = String(url); const m = init.method; const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ m, u, body });
    const r = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
    if (u.includes("/contacts/search/duplicate")) return r({ contact: { id: "C1", dateAdded: "2020-01-01T00:00:00Z", assignedTo: null } });
    if (u.includes("/opportunities/search")) return r({ opportunities: [{ id: "O1", name: "Mary Tester — Homepage", pipelineId: "iziaGFnVZle64waSZJff", status: "open", assignedTo: null }] });
    if (m === "GET" && u.endsWith("/contacts/C1")) return r({ contact: { id: "C1", tags: ["homepage", "website-lead"] } });
    return r({});
  };
  const payload = { phone: "2395550100", page: blog.page, page_path: "/blog/lee-health-nch-medicare-network-changes-2027/", submitted_at: new Date().toISOString(), additional_notes: "Form page: /blog/x/" };
  const res = await enrichLead(blog, payload, { pollMs: [0] });
  assert.strictEqual(res.contactId, "C1");
  for (const s of ["update", "tags", "note", "task", "opp-update", "untag-homepage"]) assert(res.steps.includes(s), "missing step " + s + " " + res.steps);
  const put = calls.find((c) => c.m === "PUT" && c.u.endsWith("/contacts/C1"));
  assert.strictEqual(put.body.postalCode, "33901");
  assert.strictEqual(put.body.assignedTo, "UlTM7S5uLDmQhXQ5zzfN");
  assert(!("tags" in put.body), "PUT must not replace tags");
  const note = calls.find((c) => c.m === "POST" && c.u.endsWith("/contacts/C1/notes"));
  assert(/Health system: Lee Health/.test(note.body.body) && /ZIP: 33901/.test(note.body.body));
  const opp = calls.find((c) => c.m === "PUT" && c.u.includes("/opportunities/O1"));
  assert.strictEqual(opp.body.name, "Mary Tester — 2027 Southwest Florida Network Alert Blog");
  const tags = calls.find((c) => c.u.endsWith("/contacts/C1/tags") && c.m === "POST");
  assert(tags.body.tags.includes("website-lead") && tags.body.tags.includes("web:blog-lee-health-nch-medicare-network-changes-2027"));
  // Homepage lead must keep "homepage" tag
  calls.length = 0;
  const r2 = await enrichLead({ ...blog, source: "Homepage Form" }, { ...payload, page_path: "/" }, { pollMs: [0] });
  assert(!r2.steps.includes("untag-homepage"));
  console.log("test-ghl-enrich: ok");
})().catch((e) => { console.error(e); process.exit(1); });

// Nested calculator answers are flattened into the note
{
  const lines2 = answerLines({ firstName: "A", customFields: { lifeincome: "50000", coverage_estimate: 250000 }, tags: ["life", "calc"] });
  if (!lines2.includes("Lifeincome: 50000") || !lines2.some((l) => /Coverage estimate: 250000/.test(l))) {
    console.error("flatten failed", lines2); process.exit(1);
  }
}
