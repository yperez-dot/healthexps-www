#!/usr/bin/env node
"use strict";
const assert = require("assert");
const { enrichLead, answerLines, pageTag, pageLabel, extractZip, visitorNotes, resetCustomFieldCache, isSpanishLead, languageTag, contactTags, isTestLead, LOCATION_ID, WEBSITE_PIPELINE_ID } = require("../netlify/lib/ghl-enrich");

assert.strictEqual(visitorNotes({ additional_notes: "Need a callback.\n\nForm page: /contact/" }), "Need a callback.");
assert.strictEqual(visitorNotes({ notes: "Form page: /contact/" }), "");
assert.strictEqual(visitorNotes({ message: "Keep my cardiologist" }), "Keep my cardiologist");

const blog = {
  first_name: "Mary", last_name: "Rivera", phone: "2395550100", email: "mary@example.com",
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
assert.strictEqual(isSpanishLead({ lang: "spanish" }, {}, "/contact/"), true);
assert.strictEqual(isSpanishLead({}, { language: "es" }, "/contact/"), true);
assert.strictEqual(isSpanishLead({}, {}, "/es/contacto/"), true);
assert.strictEqual(isSpanishLead({ lang: "english" }, { language: "en" }, "/contact/"), false);
assert.strictEqual(languageTag({}, { language: "es" }, "/"), "spanish");
assert.strictEqual(languageTag({}, { language: "en" }, "/es/contacto/"), "english");
assert.strictEqual(isTestLead({ first_name: "TEST", last_name: "Samantha" }), true);

const crowded = contactTags(
  { first_name: "TEST", last_name: "Samantha", tags: Array.from({ length: 20 }, (_, i) => "tag-" + i).join(",") },
  { language: "es" },
  "/es/contacto/",
  null
);
assert(crowded.includes("test-lead") && crowded.includes("website-lead") && crowded.includes("spanish"), "reserved tags survive the 15-tag cap: " + crowded);
assert.strictEqual(crowded.length, 15);
assert(!isSpanishLead ? false : crowded.indexOf("test-lead") < crowded.indexOf("tag-0") || !crowded.includes("tag-0"), "test-lead is reserved ahead of form tags");

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
    if (u.includes("/opportunities/search")) return r({ opportunities: [{ id: "O1", name: "Mary Rivera — Homepage", pipelineId: "iziaGFnVZle64waSZJff", status: "open", assignedTo: null }] });
    if (m === "GET" && u.endsWith("/contacts/C1")) return r({ contact: { id: "C1", tags: ["homepage", "website-lead"] } });
    return r({});
  };
  const payload = { phone: "2395550100", page: blog.page, page_path: "/blog/lee-health-nch-medicare-network-changes-2027/", submitted_at: new Date().toISOString(), additional_notes: "Form page: /blog/x/" };
  const res = await enrichLead(blog, payload, { pollMs: [0] });
  assert.strictEqual(res.contactId, "C1");
  for (const s of ["update", "tags", "note", "opp-update", "untag-homepage"]) assert(res.steps.includes(s), "missing step " + s + " " + res.steps);
  assert(!res.steps.includes("task"), "must not create a call-this-lead task: " + res.steps);
  assert(!calls.some((c) => /\/tasks/.test(c.u)), "no GHL task API calls");
  const put = calls.find((c) => c.m === "PUT" && c.u.endsWith("/contacts/C1"));
  assert.strictEqual(put.body.postalCode, "33901");
  assert.strictEqual(put.body.assignedTo, "UlTM7S5uLDmQhXQ5zzfN");
  assert(!("tags" in put.body), "PUT must not replace tags");
  const note = calls.find((c) => c.m === "POST" && c.u.endsWith("/contacts/C1/notes"));
  assert(/Health system: Lee Health/.test(note.body.body) && /ZIP: 33901/.test(note.body.body));
  const opp = calls.find((c) => c.m === "PUT" && c.u.includes("/opportunities/O1"));
  assert.strictEqual(opp.body.name, "Mary Rivera — Blog: Will Lee Health or NCH Accept Your Medicare Plan in 2027?");
  assert(/Form: 2027 Southwest Florida Network Alert Blog/.test(note.body.body), "note keeps the original form name");
  const tags = calls.find((c) => c.u.endsWith("/contacts/C1/tags") && c.m === "POST");
  assert(tags.body.tags.includes("website-lead") && tags.body.tags.includes("web:blog-lee-health-nch-medicare-network-changes-2027"));
  assert(tags.body.tags.includes("blog") && tags.body.tags.includes("blog-medicare"), "blog topic tags");
  assert(tags.body.tags.includes("english"), "EN leads get the english tag");
  assert(!tags.body.tags.includes("test-lead"), "ordinary names are not test-lead");
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
  assert(r3.steps.includes("opp-create"), "other leads still get a THEI Website opportunity");
  assert(!r3.steps.includes("task") && !calls.some((c) => /\/tasks/.test(c.u)), "no call-this-lead task on upsert path");

  // Landing Page custom field: resolve ID by key once, cache it, overwrite on every submit
  resetCustomFieldCache();
  const lpCalls = [];
  global.fetch = async (url, init) => {
    const u = String(url); const m = init.method; const body = init.body ? JSON.parse(init.body) : null;
    lpCalls.push({ m, u, body });
    const ok = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
    if (u.includes("/locations/") && u.includes("/customFields")) {
      return ok({ customFields: [{ id: "LPID1", name: "Landing Page", fieldKey: "contact.landing_page" }] });
    }
    if (u.includes("/contacts/search/duplicate")) return ok({ contact: { id: "C9", dateAdded: "2020-01-01T00:00:00Z", assignedTo: "x" } });
    if (u.includes("/opportunities/search")) return ok({ opportunities: [] });
    if (m === "GET" && u.endsWith("/contacts/C9")) return ok({ contact: { id: "C9", tags: ["website-lead"] } });
    return ok({});
  };
  const lpPayload = { phone: "2395550100", page: blog.page, page_path: "/blog/lee-health-nch-medicare-network-changes-2027/", landing_page: "/blog/lee-health-nch-medicare-network-changes-2027/", submitted_at: new Date().toISOString() };
  const lp1 = await enrichLead(blog, lpPayload, { pollMs: [0] });
  assert.strictEqual(lp1.contactId, "C9");
  const cfGets = lpCalls.filter((c) => c.u.includes("/customFields"));
  assert.strictEqual(cfGets.length, 1, "custom field ID is looked up once");
  assert(cfGets[0].u.endsWith("/locations/" + LOCATION_ID + "/customFields"), cfGets[0].u);
  const put1 = lpCalls.find((c) => c.m === "PUT" && c.u.endsWith("/contacts/C9"));
  const lpField1 = (put1.body.customFields || []).find((f) => f.id === "LPID1" || f.key === "landing_page");
  assert(lpField1, "PUT includes landing_page custom field " + JSON.stringify(put1.body.customFields));
  assert.strictEqual(lpField1.id, "LPID1");
  assert.strictEqual(lpField1.field_value, "/blog/lee-health-nch-medicare-network-changes-2027/");
  assert(!("key" in lpField1), "uses id after a successful key lookup");

  const afterFirst = lpCalls.length;
  const lp2 = await enrichLead(blog, { ...lpPayload, landing_page: "/contact/", page_path: "/contact/" }, { pollMs: [0] });
  assert.strictEqual(lp2.contactId, "C9");
  assert.strictEqual(lpCalls.filter((c) => c.u.includes("/customFields")).length, 1, "cached: no second customFields GET");
  const put2 = lpCalls.slice(afterFirst).find((c) => c.m === "PUT" && c.u.endsWith("/contacts/C9"));
  const lpField2 = (put2.body.customFields || []).find((f) => f.id === "LPID1");
  assert.strictEqual(lpField2.field_value, "/contact/", "overwrites with the most recent form page");

  // Lookup failure must not drop the lead — fall back to { key: 'landing_page' }
  resetCustomFieldCache();
  const fbCalls = [];
  global.fetch = async (url, init) => {
    const u = String(url); const m = init.method; const body = init.body ? JSON.parse(init.body) : null;
    fbCalls.push({ m, u, body });
    const ok = (o, status) => ({ ok: status ? status < 400 : true, status: status || 200, text: async () => JSON.stringify(o) });
    if (u.includes("/customFields")) return ok({ message: "Unauthorized" }, 401);
    if (u.includes("/contacts/search/duplicate")) return ok({});
    if (/\/contacts\/\?/.test(u)) return ok({ contacts: [] });
    if (u.includes("/contacts/upsert")) return ok({ contact: { id: "C10", dateAdded: new Date().toISOString() } });
    if (u.includes("/opportunities/search")) return ok({ opportunities: [] });
    return ok({});
  };
  const lp3 = await enrichLead(blog, lpPayload, { pollMs: [0], budgetMs: 2000 });
  assert.strictEqual(lp3.contactId, "C10", "lead still upserts when customFields lookup fails");
  const upsert = fbCalls.find((c) => c.u.includes("/contacts/upsert"));
  const lpField3 = (upsert.body.customFields || []).find((f) => f.key === "landing_page" || f.id === "LPID1");
  assert(lpField3 && lpField3.key === "landing_page", "fallback uses key landing_page: " + JSON.stringify(upsert.body.customFields));
  assert.strictEqual(lpField3.field_value, "/blog/lee-health-nch-medicare-network-changes-2027/");

  // blog-lee-nch / blog-baptist: GHL workflows only Update Opportunity, so enrich
  // still creates a THEI Website / New Lead opp named after the page. No call task.
  const STAGE_NEW_LEAD = "4ae9b05c-c74d-41ed-827b-db4f4b3be8b0";
  const mockContact = (contactId, calls) => async (url, init) => {
    const u = String(url); const m = init.method; const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ m, u, body });
    const ok = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
    if (u.includes("/contacts/search/duplicate")) return ok({ contact: { id: contactId, dateAdded: "2020-01-01T00:00:00Z", assignedTo: "x" } });
    if (u.includes("/opportunities/search")) return ok({ opportunities: [] });
    if (u.includes("/opportunities/") && m === "POST") return ok({ opportunity: { id: "O" + contactId } });
    if (u.includes("/tasks")) throw new Error("call-this-lead task must not be created");
    if (m === "GET" && u.endsWith("/contacts/" + contactId)) return ok({ contact: { id: contactId, tags: ["homepage", "website-lead"] } });
    return ok({});
  };
  const assertWebsiteOpp = (res, calls, contactId, nameRe, why) => {
    assert.strictEqual(res.contactId, contactId, why);
    assert(res.steps.includes("opp-create"), why + " steps " + res.steps);
    assert(!res.steps.includes("opp-skip") && !res.steps.includes("task"), why + " " + res.steps);
    assert.strictEqual(res.opportunityId, "O" + contactId, why);
    const post = calls.find((c) => c.m === "POST" && c.u.includes("/opportunities"));
    assert(post, why + ": missing opportunity POST");
    assert.strictEqual(post.body.pipelineId, WEBSITE_PIPELINE_ID, why);
    assert.strictEqual(post.body.pipelineStageId, STAGE_NEW_LEAD, why);
    assert.strictEqual(post.body.status, "open", why);
    assert(nameRe.test(post.body.name), why + " name " + post.body.name);
    assert(!calls.some((c) => /\/tasks/.test(c.u)), why + ": no call-this-lead task");
  };

  const leeCalls = [];
  global.fetch = mockContact("C11", leeCalls);
  const leePayload = { phone: "2395550100", page: blog.page, page_path: "/blog/lee-health-nch-medicare-network-changes-2027/", submitted_at: new Date().toISOString() };
  const lee = await enrichLead({ ...blog, source_key: "blog-lee-nch" }, leePayload, { pollMs: [0], budgetMs: 1000 });
  assertWebsiteOpp(lee, leeCalls, "C11", /Mary Rivera — Blog: Will Lee Health or NCH Accept Your Medicare Plan in 2027\?/, "blog-lee-nch source_key");
  assert(lee.steps.includes("untag-homepage"), lee.steps);

  leeCalls.length = 0;
  global.fetch = mockContact("C11", leeCalls);
  const leeHook = await enrichLead({ ...blog, source_key: "", webhook_id: "07bc8094-2c26-4c03-81bb-ea25841b00c6" }, leePayload, { pollMs: [0], budgetMs: 1000 });
  assertWebsiteOpp(leeHook, leeCalls, "C11", /Mary Rivera — Blog: Will Lee Health/, "blog-lee-nch webhook_id");

  const bapCalls = [];
  global.fetch = mockContact("C12", bapCalls);
  const bapPayload = { phone: "2395550100", page: "https://www.healthexps.com/blog/baptist-health-primary-care-leaving-pcn-2027/", page_path: "/blog/baptist-health-primary-care-leaving-pcn-2027/", language: "en", submitted_at: new Date().toISOString() };
  const bap = await enrichLead({ first_name: "Maria", last_name: "Garcia", phone: "2395550100", email: "maria@example.com", source_key: "blog-baptist", tags: "aep-2027,network-alert,baptist-health,organic,english", lang: "english" }, bapPayload, { pollMs: [0], budgetMs: 1000 });
  assertWebsiteOpp(bap, bapCalls, "C12", /Maria Garcia — Blog:/, "blog-baptist source_key");
  const bapTags = bapCalls.find((c) => c.m === "POST" && c.u.endsWith("/contacts/C12/tags"));
  assert(bapTags.body.tags.includes("english") && bapTags.body.tags.includes("website-lead"), bapTags.body.tags);

  bapCalls.length = 0;
  global.fetch = mockContact("C12", bapCalls);
  const bapHook = await enrichLead({ first_name: "Maria", last_name: "Garcia", phone: "2395550100", source_key: "", webhook_id: "vcqtoCvS1wbwb1eeYIsK" }, { ...bapPayload, page_path: "/es/blog/cambio-red-baptist-health-pcn-medicare-2027/", language: "es" }, { pollMs: [0], budgetMs: 1000 });
  assertWebsiteOpp(bapHook, bapCalls, "C12", /Maria Garcia — Blog:/, "blog-baptist webhook_id");
  const esTags = bapCalls.find((c) => c.m === "POST" && /\/tags$/.test(c.u));
  assert(esTags.body.tags.includes("spanish") && !esTags.body.tags.includes("english"), "ES path gets spanish: " + esTags.body.tags);

  // test-lead must be posted via the API (not only on the webhook payload),
  // even when data.tags is empty (contact forms) and when form tags exceed the cap.
  const tlCalls = [];
  global.fetch = async (url, init) => {
    const u = String(url); const m = init.method; const body = init.body ? JSON.parse(init.body) : null;
    tlCalls.push({ m, u, body });
    const ok = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
    if (u.includes("/contacts/search/duplicate")) return ok({ contact: { id: "C13", dateAdded: "2020-01-01T00:00:00Z", assignedTo: "x" } });
    if (u.includes("/opportunities/search")) return ok({ opportunities: [] });
    if (m === "GET" && u.endsWith("/contacts/C13")) return ok({ contact: { id: "C13", tags: ["website-lead"] } });
    return ok({});
  };
  const tl = await enrichLead({ first_name: "TEST", last_name: "Samantha", phone: "3054646888", email: "test@healthexps.com", source_key: "en-contact" }, { phone: "3054646888", page_path: "/contact/", language: "en", submitted_at: new Date().toISOString() }, { pollMs: [0] });
  const tlTags = tlCalls.find((c) => c.m === "POST" && c.u.endsWith("/contacts/C13/tags"));
  assert(tlTags.body.tags.includes("test-lead"), "enrich must add test-lead from the name even if data.tags is empty: " + JSON.stringify(tlTags.body.tags));
  assert(tlTags.body.tags.includes("english") && tlTags.body.tags.includes("website-lead"));

  tlCalls.length = 0;
  const many = Array.from({ length: 20 }, (_, i) => "extra-" + i).join(",");
  const tl2 = await enrichLead({ first_name: "TEST", last_name: "Samantha", phone: "3054646888", tags: many, lang: "spanish" }, { phone: "3054646888", page_path: "/es/contacto/", language: "es", submitted_at: new Date().toISOString() }, { pollMs: [0] });
  const tl2Tags = tlCalls.find((c) => c.m === "POST" && /\/tags$/.test(c.u)).body.tags;
  assert(tl2Tags.includes("test-lead") && tl2Tags.includes("spanish") && tl2Tags.includes("website-lead"), "reserved tags are not sliced off: " + tl2Tags);
  assert.ok(tl2Tags.length <= 15);

  console.log("test-ghl-enrich: ok");
})().catch((e) => { console.error(e); process.exit(1); });

// Nested calculator answers are flattened into the note
{
  const lines2 = answerLines({ firstName: "A", customFields: { lifeincome: "50000", coverage_estimate: 250000 }, tags: ["life", "calc"] });
  if (!lines2.includes("Lifeincome: 50000") || !lines2.some((l) => /Coverage estimate: 250000/.test(l))) {
    console.error("flatten failed", lines2); process.exit(1);
  }
}
