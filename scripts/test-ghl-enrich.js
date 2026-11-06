#!/usr/bin/env node
"use strict";
const assert = require("assert");
const { enrichLead, answerLines, pageTag, pageLabel, extractZip, visitorNotes } = require("../netlify/lib/ghl-enrich");

assert.strictEqual(visitorNotes({ additional_notes: "Need a callback.\n\nForm page: /contact/" }), "Need a callback.");
assert.strictEqual(visitorNotes({ notes: "Form page: /contact/" }), "");
assert.strictEqual(visitorNotes({ message: "Keep my cardiologist" }), "Keep my cardiologist");

const blog = {
  first_name: "Mary", last_name: "Tester", phone: "2395550100", email: "mary@example.com",
  health_system: "Lee Health", current_carrier: "UnitedHealthcare / AARP", zip_code: "33901",
  consent: "on", _hp_name: "", source_key: "aep-2027", tags: "aep-2027,network-alert",
  source: "2027 Southwest Florida Network Alert Blog", lang: "english",
  blog_title: "Will Lee Health or NCH Accept Your Medicare Plan in 2027?", blog_category: "Medicare",
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
  assert.strictEqual(opp.body.name, "Mary Tester — Blog: Will Lee Health or NCH Accept Your Medicare Plan in 2027?");
  assert(/Form: 2027 Southwest Florida Network Alert Blog/.test(note.body.body), "note keeps the original form name");
  const tags = calls.find((c) => c.u.endsWith("/contacts/C1/tags") && c.m === "POST");
  assert(tags.body.tags.includes("website-lead") && tags.body.tags.includes("web:blog-lee-health-nch-medicare-network-changes-2027"));
  assert(tags.body.tags.includes("blog") && tags.body.tags.includes("blog-medicare"), "blog topic tags");
  // Homepage lead must keep "homepage" tag
  calls.length = 0;
  const r2 = await enrichLead({ ...blog, source: "Homepage Form" }, { ...payload, page_path: "/" }, { pollMs: [0] });
  assert(!r2.steps.includes("untag-homepage"));

  // Missed duplicate search → upsert, tags, THEN onContact (webhook fires after)
  const order = [];
  calls.length = 0;
  global.fetch = async (url, init) => {
    const u = String(url); const m = init.method; const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ m, u, body });
    const ok = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
    if (u.includes("/contacts/search/duplicate")) { order.push("search"); return ok({}); }
    if (/\/contacts\/\?/.test(u)) { order.push("query"); return ok({ contacts: [] }); }
    if (u.includes("/contacts/upsert")) {
      order.push("upsert");
      assert.strictEqual(body.createNewIfDuplicateAllowed, false);
      assert.strictEqual(body.phone, "+12395550100");
      return ok({ contact: { id: "C2", dateAdded: new Date().toISOString() } });
    }
    if (u.includes("/tags") && m === "POST") { order.push("tags"); return ok({}); }
    if (u.includes("/opportunities/search")) return ok({ opportunities: [] });
    if (u.includes("/opportunities/") && m === "POST") { order.push("opp-create"); return ok({ opportunity: { id: "O2" } }); }
    return ok({});
  };
  const r3 = await enrichLead(blog, payload, {
    pollMs: [0],
    budgetMs: 2000,
    onContact: (info) => { order.push("onContact:" + info.contactId); },
  });
  assert.strictEqual(r3.contactId, "C2");
  assert(r3.steps.includes("upsert") && r3.steps.includes("tags"));
  const tagsAt = order.indexOf("tags");
  const upsertAt = order.indexOf("upsert");
  const readyAt = order.indexOf("onContact:C2");
  assert(upsertAt >= 0 && tagsAt > upsertAt && readyAt > tagsAt, "onContact after tags after upsert: " + order.join(">"));

  console.log("test-ghl-enrich: ok");
})().catch((e) => { console.error(e); process.exit(1); });

// Nested calculator answers are flattened into the note
{
  const lines2 = answerLines({ firstName: "A", customFields: { lifeincome: "50000", coverage_estimate: 250000 }, tags: ["life", "calc"] });
  if (!lines2.includes("Lifeincome: 50000") || !lines2.some((l) => /Coverage estimate: 250000/.test(l))) {
    console.error("flatten failed", lines2); process.exit(1);
  }
}
