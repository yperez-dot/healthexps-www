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
  return html.replace(/<\/body>/i, `${replacement}\n</body>`);
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

function injectSharedChrome(content, outputPath) {
  if (!outputPath || !outputPath.endsWith(".html")) return content;
  const locale = /(?:^|[\\/])(?:_site[\\/])?es[\\/]/i.test(outputPath) ? "es" : "en";
  let html = content;
  // Homepages keep their own AEP top bar + nav. Shared chrome would wipe the banner.
  // Match Eleventy paths (`_site/index.html`, `./_site/index.html`, absolute) and
  // also skip if the page already has the banner (path formats we have not seen).
  if (!isHomepageOutput(outputPath) && !hasHomepageAepBanner(html)) {
    html = replaceSharedHeader(html, chrome[locale].header);
  }
  html = replaceSharedFooter(html, chrome[locale].footer.replace(/id=["']site-footer["']/, 'id="site-footer" class="shared-chrome-footer"'));
  if (!html.includes("/css/shared-chrome.css")) html = html.replace(/<\/head>/i, '  <link rel="stylesheet" href="/css/shared-chrome.css">\n  <link rel="stylesheet" href="/css/shared-footer.css">\n</head>');
  return html;
}

module.exports = { injectSharedChrome, findBalancedEnd, isHomepageOutput };
