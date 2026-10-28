#!/usr/bin/env node
"use strict";
/**
 * Blog post leads must reach GHL labeled "Blog: <post title>" with blog +
 * topic tags (blog-medicare / blog-aca / blog-private), never as "Homepage".
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { blogInfo, pageLabel, normalizeBlogCategory } = require("../netlify/lib/ghl-enrich");
const { buildForwardPayload } = require("../netlify/functions/submit-lead");

const ROOT = path.join(__dirname, "..");

// ── category + label ──
assert.strictEqual(normalizeBlogCategory("Medicare"), "medicare");
assert.strictEqual(normalizeBlogCategory("ACA & Marketplace"), "aca");
assert.strictEqual(normalizeBlogCategory("ACA y Mercado"), "aca");
assert.strictEqual(normalizeBlogCategory("Private Insurance"), "private");
assert.strictEqual(normalizeBlogCategory("Seguro Privado"), "private");
assert.strictEqual(normalizeBlogCategory("COBRA"), "private");
assert.strictEqual(blogInfo({}, "/"), null);
assert.strictEqual(blogInfo({}, "/blog/"), null);
assert.strictEqual(blogInfo({}, "/es/blog/"), null);
assert.strictEqual(blogInfo({}, "/medicare-plans-miami"), null);
const es = blogInfo({ blog_title: "Cómo leer su ANOC 2027", blog_category: "Medicare" }, "/es/blog/como-leer-su-anoc-2027/");
assert.deepStrictEqual(es, { lang: "es", slug: "como-leer-su-anoc-2027", title: "Cómo leer su ANOC 2027", category: "medicare" });
// Fallbacks when the page did not send blog fields: slug title + category from the form key
const fb = blogInfo({ source_key: "en-private" }, "/blog/self-employed-health-insurance-miami/");
assert.strictEqual(fb.category, "private");
assert.strictEqual(fb.title, "Self employed health insurance miami");
assert.strictEqual(pageLabel({ source: "Homepage Form", blog_title: "Why Is Medicare Free?" }, "/blog/why-is-medicare-free-for-some-but-not-others/"), "Blog: Why Is Medicare Free?");
assert.strictEqual(pageLabel({ source: "Homepage Form" }, "/"), "Homepage Form");

// ── forwarded webhook payload ──
const now = Date.now();
const fwd = buildForwardPayload({
  first_name: "Test", last_name: "Lead", phone: "3055550100", email: "t@example.com",
  source_key: "aep-2027", source: "Blog lista AEP 2027", tags: "aep-2027,aep-checklist,organic,spanish",
  blog_title: "Su lista para el AEP de Medicare 2027", blog_category: "Medicare",
  page: "https://www.healthexps.com/es/blog/lista-aep-medicare-2027/", _form_loaded_at: now - 10000,
});
assert.strictEqual(fwd.source, "Blog: Su lista para el AEP de Medicare 2027");
assert.strictEqual(fwd.form_name, "Blog lista AEP 2027");
assert.strictEqual(fwd.page_path, "/es/blog/lista-aep-medicare-2027/");
assert.deepStrictEqual(fwd.tags.split(","), ["aep-2027", "aep-checklist", "organic", "spanish", "blog", "blog-medicare"]);
const home = buildForwardPayload({ first_name: "A", phone: "3055550100", source: "Homepage Form", page: "https://www.healthexps.com/" });
assert.strictEqual(home.source, "Homepage Form");
assert(!/blog/.test(String(home.tags || "")));

// ── layout fetch wrapper adds blog fields to submit-lead posts ──
for (const layout of ["blog-post.njk", "blog-post-es.njk"]) {
  const src = fs.readFileSync(path.join(ROOT, "_includes/layouts", layout), "utf8");
  const m = src.match(/<script>\n\/\* Blog lead label[^\n]*\n([^\n]+)\n<\/script>/);
  assert(m, layout + " has the blog lead label script");
  const js = m[1].replace("{{ title | dump | safe }}", JSON.stringify("Post T")).replace('{{ (category or "") | dump | safe }}', JSON.stringify("ACA & Marketplace"));
  let seen = null;
  const win = { fetch: (u, init) => { seen = { u, init }; return Promise.resolve({}); } };
  vm.runInNewContext(js, { window: win, location: { pathname: "/blog/x/", href: "https://www.healthexps.com/blog/x/" }, JSON, Object });
  win.fetch("/.netlify/functions/submit-lead", { method: "POST", body: JSON.stringify({ first_name: "A" }) });
  const body = JSON.parse(seen.init.body);
  assert.strictEqual(body.blog_title, "Post T");
  assert.strictEqual(body.blog_category, "ACA & Marketplace");
  assert.strictEqual(body.page_path, "/blog/x/");
  win.fetch("/other", { body: "x" });
  assert.strictEqual(seen.init.body, "x", "other fetches untouched");
}

// ── no blog page source still posts straight to the Homepage Lead webhook as "Homepage Form" ──
const HOMEPAGE_HOOK = "dc6c8b35";
for (const dir of ["blog", "es/blog"]) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (!/\.(html|md|njk)$/.test(f)) continue;
    const s = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
    assert(!(s.includes(HOMEPAGE_HOOK) && /Homepage Form/.test(s)), `${dir}/${f} still posts to the Homepage webhook as "Homepage Form"`);
  }
}

// ── scheduled cleanup renames only blog leads' "— Homepage" opps ──
(async () => {
  const { sweep } = require("../netlify/functions/blog-lead-cleanup");
  delete process.env.GHL_API_TOKEN;
  assert.deepStrictEqual(await sweep(), { skipped: "no_token" });
  process.env.GHL_API_TOKEN = "test";
  const recent = new Date(Date.now() - 60 * 1000).toISOString();
  const calls = [];
  global.fetch = async (url, init) => {
    const u = String(url); const m = init.method; const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ m, u, body });
    const r = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
    if (u.includes("/opportunities/search")) return r({ opportunities: [
      { id: "O1", name: "Blog Person — Homepage", contactId: "C1", createdAt: recent },
      { id: "O2", name: "Home Person — Homepage", contactId: "C2", createdAt: recent },
      { id: "O3", name: "Old Person — Homepage", contactId: "C3", createdAt: "2020-01-01T00:00:00Z" },
      { id: "O4", name: "Done Person — Blog: X", contactId: "C4", createdAt: recent },
    ] });
    if (m === "GET" && u.endsWith("/contacts/C1")) return r({ contact: { id: "C1", source: "Blog: How to Read Your 2027 ANOC", tags: ["website-lead", "blog", "homepage"] } });
    if (m === "GET" && u.endsWith("/contacts/C2")) return r({ contact: { id: "C2", source: "Homepage Form", tags: ["website-lead", "homepage"] } });
    return r({});
  };
  const res = await sweep();
  assert.deepStrictEqual(res, { checked: 2, renamed: 1, untagged: 1 });
  const put = calls.find((c) => c.m === "PUT");
  assert(put.u.endsWith("/opportunities/O1"));
  assert.strictEqual(put.body.name, "Blog Person — Blog: How to Read Your 2027 ANOC");
  const del = calls.find((c) => c.m === "DELETE");
  assert(del.u.endsWith("/contacts/C1/tags") && del.body.tags[0] === "homepage");
  assert(!calls.some((c) => c.u.includes("/opportunities/O2") || c.u.includes("/contacts/C2/tags")), "homepage lead untouched");
  console.log("test-blog-lead-label: ok");
})().catch((e) => { console.error(e); process.exit(1); });
