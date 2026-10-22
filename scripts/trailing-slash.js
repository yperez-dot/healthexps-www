// Trailing-slash consistency for internal links (EN + ES).
// Netlify serves every page at /path/ and 301s /path -> /path/, so any internal
// link, canonical, hreflang, og:url, JSON-LD url or sitemap <loc> without the
// slash points Google at a redirect and splits signals between two URLs.
// This runs after each Eleventy build and rewrites the built files in _site:
//   - /path -> /path/ when _site/path/index.html exists
//   - links to a known 301 source -> its final target (no redirect hops)
//   - https://healthexps.com/... -> https://www.healthexps.com/...
//   - sitemap.xml: drops <url> entries whose <loc> is a redirect source and duplicate <loc>s
// Assets (anything with a file extension), external hosts, wildcards and
// /.netlify/ endpoints are never touched.
const fs = require("fs");
const path = require("path");

const SITE = "https://www.healthexps.com";
const HOST_RE = /^https?:\/\/(?:www\.)?healthexps\.com(?=\/|$)/i;

function stripSlash(p) {
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

// Read 301 rules from _redirects (first match wins) then netlify.toml.
function loadRedirects(repoDir) {
  const map = new Map();
  const add = (from, to) => {
    if (!from || !to || from.includes("*") || to.includes(":splat")) return;
    if (!from.startsWith("/") || !to.startsWith("/")) return;
    const key = stripSlash(from);
    if (key === "/" || map.has(key)) return;
    map.set(key, to);
  };
  const red = path.join(repoDir, "_redirects");
  if (fs.existsSync(red)) {
    for (const line of fs.readFileSync(red, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const [from, to, status] = t.split(/\s+/);
      if (status && /^30[18]!?$/.test(status)) add(from, to);
    }
  }
  const toml = path.join(repoDir, "netlify.toml");
  if (fs.existsSync(toml)) {
    const blocks = fs.readFileSync(toml, "utf8").split(/\[\[redirects\]\]/).slice(1);
    for (const b of blocks) {
      const from = (b.match(/^\s*from\s*=\s*"([^"]+)"/m) || [])[1];
      const to = (b.match(/^\s*to\s*=\s*"([^"]+)"/m) || [])[1];
      const status = (b.match(/^\s*status\s*=\s*(\d+)/m) || [])[1];
      if (status === "301" || status === "308") add(from, to);
    }
  }
  return map;
}

function makeResolver(pageExists, redirects) {
  // Returns the canonical form of a site path (no query/hash), or null to leave it alone.
  function resolve(p, depth = 0) {
    if (!p.startsWith("/") || p.startsWith("//") || p.startsWith("/.netlify")) return null;
    const last = p.replace(/\/+$/, "").split("/").pop();
    if (/\.[a-z0-9]{1,5}$/i.test(last)) return null; // asset or .html file
    const key = stripSlash(p);
    if (depth < 5 && redirects.has(key)) {
      const to = redirects.get(key);
      if (stripSlash(to) !== key) return resolve(to, depth + 1) || to;
    }
    if (key === "/") return "/";
    if (pageExists(key)) return key + "/";
    return null;
  }
  return resolve;
}

function fixUrl(url, resolve) {
  const abs = HOST_RE.test(url);
  let rest = abs ? url.replace(HOST_RE, "") || "/" : url;
  if (!rest.startsWith("/")) return url;
  const m = rest.match(/^([^?#]*)(.*)$/);
  const fixed = resolve(m[1]);
  const p = fixed || m[1];
  if (!abs && p === m[1]) return url;
  return (abs ? SITE : "") + p + m[2];
}

const URL_CHARS = "[^\"'\\s<>]*";
const ATTR_RE = new RegExp(`(\\s(?:href|content)=)(["'])((?:https?://(?:www\\.)?healthexps\\.com)?/${URL_CHARS})\\2`, "gi");
const JSONLD_RE = new RegExp(`("(?:url|@id|item)"\\s*:\\s*")(https?://(?:www\\.)?healthexps\\.com${URL_CHARS})"`, "gi");
const LOC_RE = /(<loc>\s*)(https?:\/\/(?:www\.)?healthexps\.com[^<\s]*)(\s*<\/loc>)/gi;

function normalizeHtml(html, resolve) {
  let changed = 0;
  const swap = (orig, next) => { if (next !== orig) changed++; return next; };
  html = html.replace(ATTR_RE, (all, pre, q, url) => pre + q + swap(url, fixUrl(url, resolve)) + q);
  html = html.replace(JSONLD_RE, (all, pre, url) => pre + swap(url, fixUrl(url, resolve)) + '"');
  return { html, changed };
}

function normalizeSitemap(xml, resolve) {
  let changed = 0;
  let dropped = [];
  const seen = new Set();
  xml = xml.replace(/<url>[\s\S]*?<\/url>/g, (block) => {
    const loc = (block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/) || [])[1];
    if (!loc) return block;
    const fixedLoc = fixUrl(loc, resolve);
    const locPath = loc.replace(HOST_RE, "") || "/";
    const fixedPath = fixedLoc.replace(HOST_RE, "") || "/";
    // A redirect source resolves to a different page: don't list it.
    if (stripSlash(locPath) !== stripSlash(fixedPath.replace(/[?#].*$/, ""))) { dropped.push(loc); return ""; }
    if (seen.has(fixedLoc)) { dropped.push(loc); return ""; }
    seen.add(fixedLoc);
    const out = normalizeHtml(block.replace(LOC_RE, (a, pre, url, post) => pre + fixUrl(url, resolve) + post), resolve);
    if (out.html !== block) changed++;
    return out.html;
  });
  xml = xml.replace(/\n\s*\n(\s*\n)+/g, "\n\n");
  return { xml, changed, dropped };
}

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (f.name.endsWith(".html")) out.push(p);
  }
  return out;
}

function normalizeSite(siteDir, repoDir) {
  const redirects = loadRedirects(repoDir);
  const pageExists = (p) => fs.existsSync(path.join(siteDir, p, "index.html"));
  const resolve = makeResolver(pageExists, redirects);
  let files = 0, links = 0;
  for (const f of walk(siteDir)) {
    const src = fs.readFileSync(f, "utf8");
    const { html, changed } = normalizeHtml(src, resolve);
    if (changed) { fs.writeFileSync(f, html); files++; links += changed; }
  }
  const sm = path.join(siteDir, "sitemap.xml");
  let sitemap = { changed: 0, dropped: [] };
  if (fs.existsSync(sm)) {
    const out = normalizeSitemap(fs.readFileSync(sm, "utf8"), resolve);
    fs.writeFileSync(sm, out.xml);
    sitemap = out;
  }
  return { files, links, sitemapChanged: sitemap.changed, sitemapDropped: sitemap.dropped };
}

module.exports = { loadRedirects, makeResolver, fixUrl, normalizeHtml, normalizeSitemap, normalizeSite };
