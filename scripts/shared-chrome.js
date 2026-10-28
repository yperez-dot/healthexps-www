const { insertBeforeBodyEnd } = require("./insert-before-body-end");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const chrome = {
  en: { header: fs.readFileSync(path.join(root, "_includes/medicare-articles-en-header.njk"), "utf8"), footer: fs.readFileSync(path.join(root, "_includes/medicare-articles-en-footer.njk"), "utf8") },
  es: { header: fs.readFileSync(path.join(root, "_includes/medicare-articles-es-header.njk"), "utf8"), footer: fs.readFileSync(path.join(root, "_includes/medicare-articles-es-footer.njk"), "utf8") },
};

function findBalancedEnd(html, start, tagName) {
  const tag = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  tag.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tag.exec(html))) {
    depth += match[0][1] === "/" ? -1 : 1;
    if (depth === 0) return tag.lastIndex;
  }
  return -1;
}

function findTagStart(html, pattern) {
  const match = String(html || "").match(pattern);
  return match ? match.index : -1;
}

function sliceBalancedElement(html, start) {
  if (start < 0) return { start, end: -1, html: "" };
  const tag = String(html).slice(start).match(/^<(\w+)\b/);
  if (!tag) return { start, end: -1, html: "" };
  const end = findBalancedEnd(html, start, tag[1]);
  return { start, end, html: end > start ? html.slice(start, end) : "" };
}

function findNavOuter(html) {
  return findTagStart(html, /<(?:div|header)\b[^>]*class=["'][^"']*\bv4-nav-outer\b[^"']*["'][^>]*>/i);
}

function findMobileMenu(html) {
  return findTagStart(html, /<div\b[^>]*id=["']v4-mobile-menu["'][^>]*>/i);
}

function replaceElementAt(html, start, replacement) {
  const sliced = sliceBalancedElement(html, start);
  if (sliced.end < 0) return html;
  return html.slice(0, start) + replacement + html.slice(sliced.end);
}

function sharedNavPieces(headerHtml) {
  const nav = sliceBalancedElement(headerHtml, findNavOuter(headerHtml));
  const mobile = sliceBalancedElement(headerHtml, findMobileMenu(headerHtml));
  return { nav: nav.html, mobile: mobile.html };
}

function replaceSharedNav(html, headerHtml) {
  const pieces = sharedNavPieces(headerHtml);
  const navStart = findNavOuter(html);
  if (navStart >= 0 && pieces.nav) html = replaceElementAt(html, navStart, pieces.nav);
  const mobileStart = findMobileMenu(html);
  if (mobileStart >= 0 && pieces.mobile) html = replaceElementAt(html, mobileStart, pieces.mobile);
  return html;
}

function replaceSharedHeader(html, replacement) {
  const mobile = html.search(/<div\b[^>]*id=["']v4-mobile-menu["'][^>]*>/i);
  if (mobile >= 0) {
    const end = findBalancedEnd(html, mobile, "div");
    if (end > mobile) {
      const candidates = [html.lastIndexOf('<div class="top-bar-inner', mobile), html.lastIndexOf('<div class="v4-nav-outer', mobile), html.lastIndexOf('<header class="v4-nav-outer', mobile)].filter((n) => n >= 0);
      if (candidates.length) return html.slice(0, Math.min(...candidates)) + replacement + html.slice(end);
    }
  }
  const legacy = html.search(/<header\b/i);
  if (legacy >= 0) {
    const end = findBalancedEnd(html, legacy, "header");
    if (end > legacy) return html.slice(0, legacy) + replacement + html.slice(end);
  }
  const body = html.search(/<body\b[^>]*>/i);
  if (body >= 0) {
    const end = html.indexOf(">", body) + 1;
    return html.slice(0, end) + "\n" + replacement + html.slice(end);
  }
  return html;
}

function replaceSharedFooter(html, replacement) {
  const marker = html.search(/<(?:div|footer)\b[^>]*id=["']site-footer["'][^>]*>/i);
  if (marker >= 0) {
    const tagName = html.slice(marker + 1).match(/^(div|footer)\b/i)[1];
    const end = findBalancedEnd(html, marker, tagName);
    if (end > marker) return html.slice(0, marker) + replacement + html.slice(end);
  }
  const footers = [...html.matchAll(/<footer\b/gi)];
  if (footers.length) {
    const start = footers[footers.length - 1].index;
    const end = findBalancedEnd(html, start, "footer");
    if (end > start) return html.slice(0, start) + replacement + html.slice(end);
  }
  return insertBeforeBodyEnd(html, `${replacement}\n`);
}

function publishedRelPath(outputPath) {
  const norm = String(outputPath || "").replace(/\\/g, "/");
  if (norm.includes("/_site/")) return norm.slice(norm.lastIndexOf("/_site/") + "/_site/".length);
  return norm.replace(/^(?:\.\/)?_site\//, "").replace(/^\.\//, "");
}

function isHomepageOutput(outputPath) {
  if (!outputPath) return false;
  return /^(es\/)?index\.html$/i.test(publishedRelPath(outputPath));
}

function hasHomepageAepBanner(html) {
  return /id=["']aep-message["']/.test(String(html || ""));
}

function hreflangAlternates(html) {
  const out = {};
  const head = String(html || "").split(/<\/head>/i)[0];
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel=["']alternate["']/i.test(tag)) continue;
    const lang = (tag.match(/\bhreflang=["']([^"']+)["']/i) || [])[1];
    const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1];
    if (!lang || !href) continue;
    const key = lang.toLowerCase();
    if (key === "en" || key === "es") {
      if (!out[key]) out[key] = href.replace(/^https?:\/\/(?:www\.)?healthexps\.com(?=\/|$)/i, "") || "/";
    }
  }
  return out;
}

// Point the shared top-bar language toggle at this page's own hreflang alternate
// (EN button on an ES page -> hreflang="en" URL; ES button on an EN page -> hreflang="es").
// Falls back to the homepage (/ or /es/) only when the page has no alternate.
function localizeLangToggle(html) {
  const alt = hreflangAlternates(html);
  const attr = (url) => String(url).replace(/&(?!amp;|#\d+;|[a-z]+;)/gi, "&amp;").replace(/"/g, "&quot;");
  return html
    .replace('<div class="shared-topbar__actions"><a href="/">EN</a><span>ES</span>', `<div class="shared-topbar__actions"><a href="${attr(alt.en || "/")}">EN</a><span>ES</span>`)
    .replace('<div class="shared-topbar__actions"><span>EN</span><a href="/es/">ES</a>', `<div class="shared-topbar__actions"><span>EN</span><a href="${attr(alt.es || "/es/")}">ES</a>`);
}

const LOCAL_FONT_TAGS =
  '  <link rel="preload" href="/fonts/inter-latin-400.woff2" as="font" type="font/woff2" crossorigin>\n' +
  '  <link rel="preload" href="/fonts/poppins-latin-700.woff2" as="font" type="font/woff2" crossorigin>\n' +
  '  <link rel="stylesheet" href="/css/fonts.css">\n';

const INTER_POPPINS_GOOGLE = /family=Poppins(?=[^"']*family=Inter)|family=Inter(?=[^"']*family=Poppins)/i;

function stripRenderBlockingGoogleFonts(html) {
  html = html.replace(/<link\b[^>]*href=["']https:\/\/fonts\.googleapis\.com["'][^>]*>\s*/gi, "");
  html = html.replace(/<link\b[^>]*href=["']https:\/\/fonts\.gstatic\.com["'][^>]*>\s*/gi, "");
  html = html.replace(/<link\b[^>]*href=["']https:\/\/fonts\.googleapis\.com\/css2\?[^"']+["'][^>]*>\s*/gi, (tag) => {
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1] || "";
    if (INTER_POPPINS_GOOGLE.test(href) && !/Playfair|DM\+Sans|family=Playfair|family=DM/i.test(href)) {
      return "";
    }
    if (/media=/i.test(tag)) return tag;
    const noscript = tag.replace(/\s*\/?>$/, ">");
    return tag.replace(/<link\b/i, '<link media="print" onload="this.media=\'all\'"') + `<noscript>${noscript}</noscript>`;
  });
  return html;
}

function injectLocalFonts(html) {
  if (/\/css\/fonts\.css/.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + "\n" + LOCAL_FONT_TAGS);
  return html;
}

function injectChromeCss(html) {
  if (html.includes("/css/shared-chrome.css")) return html;
  return html.replace(
    /<\/head>/i,
    '  <link rel="stylesheet" href="/css/shared-chrome.css">\n' +
      '  <link rel="stylesheet" href="/css/shared-footer.css" media="print" onload="this.media=\'all\'">\n' +
      '  <noscript><link rel="stylesheet" href="/css/shared-footer.css"></noscript>\n</head>'
  );
}

function injectSharedChrome(content, outputPath) {
  if (!outputPath || !outputPath.endsWith(".html")) return content;
  const locale = /(?:^|[\\/])(?:_site[\\/])?es[\\/]/i.test(outputPath) ? "es" : "en";
  let html = content;
  // Homepages keep the AEP sticky purple bar (`#aep-message`). Full header rewrite
  // starts at `.top-bar-inner` and would wipe it. Still replace nav + mobile menu
  // so Resources ▾ / Events stay in sync with the rest of the site.
  const preserveAepBar = isHomepageOutput(outputPath) || hasHomepageAepBanner(html);
  if (preserveAepBar) html = replaceSharedNav(html, chrome[locale].header);
  else html = replaceSharedHeader(html, chrome[locale].header);
  html = replaceSharedFooter(html, chrome[locale].footer.replace(/id=["']site-footer["']/, 'id="site-footer" class="shared-chrome-footer"'));
  html = localizeLangToggle(html);
  html = stripRenderBlockingGoogleFonts(html);
  html = injectLocalFonts(html);
  html = injectChromeCss(html);
  return html;
}

module.exports = { injectSharedChrome, findBalancedEnd, isHomepageOutput, replaceSharedNav, hreflangAlternates, stripRenderBlockingGoogleFonts, injectLocalFonts };
