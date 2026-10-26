#!/usr/bin/env node
"use strict";
// SEO integrity guard: builds the site (_site) and checks it (or checks a prebuilt --site <dir>)
// and fails when:
//  - an indexable page (self-canonical, not noindex, not an allowlisted alias) is missing from sitemap.xml
//  - a sitemap URL is not a built page
//  - an hreflang alternate points to a page that isn't built, or the EN/ES pair isn't reciprocal
//  - anything under /docs/ is built, or a *preview* / *snippet* page is built without noindex
//  - a page under /es/ has <html lang> other than "es"
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ORIGIN = /^https?:\/\/(?:www\.)?healthexps\.com/i;
// Indexable-looking pages that are intentionally not in the sitemap (aliases / utility pages).
const SITEMAP_ALLOWLIST = new Set([
  "/404/",
  "/enrollment-calculator/", // alias, canonical /medicare-enrollment-calculator/
  "/find-my-plan/", // alias, canonical /health-insurance-quiz/
  "/healthcare-insurance-for-seniors/", // alias, canonical /medicare-plans-miami/
]);

function siteDir() {
  const i = process.argv.indexOf("--site");
  if (i > -1) return path.resolve(process.argv[i + 1]);
  // Build into the normal _site folder: the trailing-slash post-processor (eleventy.after)
  // always writes there, and CI runs the real build right after npm test anyway.
  const root = path.resolve(__dirname, "..");
  const bin = path.join(path.dirname(require.resolve("@11ty/eleventy/package.json")), "cmd.js");
  execFileSync(process.execPath, [bin, "--quiet"], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
  return path.join(root, "_site");
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

const toPath = (u) => {
  let p = String(u || "").replace(ORIGIN, "") || "/";
  p = p.split("#")[0].split("?")[0];
  return p;
};
const norm = (p) => (p.endsWith("/") || /\.[a-z0-9]+$/i.test(p) ? p : p + "/");

function main() {
  const S = siteDir();
  const errors = [];
  const pages = new Map();
  for (const file of walk(S)) {
    const rel = "/" + path.relative(S, file).split(path.sep).join("/");
    const url = rel.endsWith("/index.html") ? rel.slice(0, -"index.html".length) : rel;
    const html = fs.readFileSync(file, "utf8");
    const head = html.split(/<\/head>/i)[0];
    const noindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(head);
    const canTag = head.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i);
    const canonical = canTag ? norm(toPath((canTag[0].match(/href=["']([^"']+)["']/i) || [])[1])) : null;
    const alts = {};
    for (const t of head.match(/<link\b[^>]*rel=["']alternate["'][^>]*>/gi) || []) {
      const lang = (t.match(/hreflang=["']([^"']+)["']/i) || [])[1];
      const href = (t.match(/href=["']([^"']+)["']/i) || [])[1];
      if (lang && href && !(lang.toLowerCase() in alts)) alts[lang.toLowerCase()] = norm(toPath(href));
    }
    const lang = ((html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i) || [])[1] || "").toLowerCase();
    pages.set(url, { url, noindex, canonical, alts, lang });
  }
  const exists = (p) => pages.has(p) || pages.has(norm(p));

  // Unpublished internals
  for (const p of pages.values()) {
    if (p.url.startsWith("/docs/")) errors.push(`internal doc is published: ${p.url}`);
    if (/(preview|snippet)/i.test(p.url) && !p.noindex) errors.push(`preview/snippet page is published without noindex: ${p.url}`);
    if (p.url.startsWith("/es/") && p.lang && p.lang.slice(0, 2) !== "es") errors.push(`Spanish page has lang="${p.lang}": ${p.url}`);
  }

  // Sitemap
  const sm = fs.readFileSync(path.join(S, "sitemap.xml"), "utf8");
  const locs = new Set([...sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => norm(toPath(m[1]))));
  for (const loc of locs) if (!exists(loc)) errors.push(`sitemap URL is not a built page: ${loc}`);
  for (const p of pages.values()) {
    if (p.noindex || !p.url.endsWith("/")) continue;
    if (/(preview|snippet)/i.test(p.url) || p.url.startsWith("/docs/")) continue;
    if (p.canonical && p.canonical !== p.url) continue; // alias page, canonical elsewhere
    if (SITEMAP_ALLOWLIST.has(p.url)) continue;
    if (!locs.has(p.url)) errors.push(`indexable page missing from sitemap: ${p.url}`);
  }

  // hreflang
  for (const p of pages.values()) {
    if (p.noindex) continue;
    if (p.canonical && p.canonical !== p.url) continue;
    const me = p.url.startsWith("/es/") ? "es" : "en";
    const other = me === "en" ? "es" : "en";
    for (const [lang, target] of Object.entries(p.alts)) {
      if (!exists(target)) errors.push(`hreflang ${lang} on ${p.url} points to a page that isn't built: ${target}`);
    }
    const t = p.alts[other];
    if (t && exists(t)) {
      const tp = pages.get(t) || pages.get(norm(t));
      if (tp.canonical && tp.canonical !== tp.url) continue;
      if (tp.alts[me] !== p.url) errors.push(`hreflang not reciprocal: ${p.url} -> ${other} ${t}, but ${t} -> ${me} ${tp.alts[me] || "(none)"}`);
    }
  }

  if (errors.length) {
    console.error(`test-seo-integrity: ${errors.length} problem(s)\n - ` + errors.join("\n - "));
    process.exit(1);
  }
  console.log(`test-seo-integrity: ok (${pages.size} pages, ${locs.size} sitemap URLs)`);
}

main();
