#!/usr/bin/env node
/**
 * Apply a bilingual Eleventy blog post to this repo (files + listing cards + sitemap).
 * Used by the Telegram publish workflow. Does not git commit.
 *
 * Usage:
 *   node scripts/apply-blog-post.js payload.json
 *   echo '{...}' | node scripts/apply-blog-post.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PLACEHOLDER_RE = /content unavailable|lorem ipsum|TODO:\s*write|placeholder copy/i;
const PLAN_STEER_RE =
  /\b(you should (enroll in|pick|choose|get|switch to)|i recommend|best (medicare )?(advantage )?plan|switch to (cigna|wellcare|uhc|united|humana|aetna))\b/i;

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function noonUtcIso(ymd) {
  const match = String(ymd ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  return `${match[1]}T12:00:00.000Z`;
}

function todayYmdET(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function validatePostCopy(markdown) {
  const text = String(markdown ?? "");
  if (!text.trim()) return "Post body is empty.";
  if (PLACEHOLDER_RE.test(text)) return "Refusing placeholder copy (Content unavailable / lorem).";
  if (PLAN_STEER_RE.test(text)) {
    return "Refusing plan-recommendation copy. Licensed agent walks it — we do not pick the plan.";
  }
  return null;
}

function ensureFrontMatter(markdown, fields) {
  const text = String(markdown ?? "").trim();
  if (text.startsWith("---")) return text.endsWith("\n") ? text : `${text}\n`;
  const lines = [
    "---",
    `layout: ${fields.layout}`,
    `category: ${JSON.stringify(fields.category)}`,
    `title: ${JSON.stringify(fields.title)}`,
    `description: ${JSON.stringify(fields.description)}`,
    `date: ${fields.dateIso}`,
    `lang: ${fields.lang}`
  ];
  if (fields.hreflangEs) lines.push(`hreflang_es: ${fields.hreflangEs}`);
  if (fields.hreflangEn) lines.push(`hreflang_en: ${fields.hreflangEn}`);
  lines.push(`permalink: ${fields.permalink}`, "---", "", text, "");
  return lines.join("\n");
}

function englishCardHtml({ category, slug, title, excerpt, date }) {
  return [
    `<a class="blog-card" data-category="${escapeHtml(category)}" href="/blog/${escapeHtml(slug)}/">`,
    `<div class="card-category">${escapeHtml(category)}</div>`,
    `<h2 class="card-title">${escapeHtml(title)}</h2>`,
    `<p class="card-excerpt">${escapeHtml(excerpt)}</p>`,
    `<div class="card-footer"><span class="card-date">${escapeHtml(date)}</span><span class="card-read">Read →</span></div>`,
    "</a>"
  ].join("");
}

function spanishCardHtml({ category, slug, title, excerpt, date }) {
  return [
    `    <a href="/es/blog/${escapeHtml(slug)}/" class="blog-card" data-category="${escapeHtml(category)}">`,
    `      <div class="card-category">${escapeHtml(category)}</div>`,
    `      <h2 class="card-title">${escapeHtml(title)}</h2>`,
    `      <p class="card-excerpt">${escapeHtml(excerpt)}</p>`,
    `      <div class="card-footer"><span class="card-date">${escapeHtml(date)}</span><span class="card-read">Leer →</span></div>`,
    "    </a>"
  ].join("\n");
}

function insertCardByDate(listingHtml, cardHtml, dateYmd, { position = "date" } = {}) {
  const html = String(listingHtml ?? "");
  const grid = html.search(/<div class="card-grid" id="blogGrid">/);
  if (grid < 0) throw new Error("blog listing is missing #blogGrid");

  const cardRe = /<a\b(?=[^>]*\bclass="[^"]*\bblog-card\b)[^>]*>[\s\S]*?<\/a>/gi;
  const cards = [...html.matchAll(cardRe)];
  if (!cards.length) {
    const openEnd = html.indexOf(">", grid) + 1;
    return html.slice(0, openEnd) + "\n" + cardHtml + html.slice(openEnd);
  }

  if (position === "first") {
    return html.slice(0, cards[0].index) + cardHtml + "\n" + html.slice(cards[0].index);
  }

  for (const card of cards) {
    const dateMatch = card[0].match(/class="card-date"[^>]*>\s*(\d{4}-\d{2}-\d{2})/);
    const cardDate = dateMatch?.[1];
    if (cardDate && cardDate < dateYmd) {
      return html.slice(0, card.index) + cardHtml + html.slice(card.index);
    }
  }
  const last = cards[cards.length - 1];
  const end = last.index + last[0].length;
  return html.slice(0, end) + cardHtml + html.slice(end);
}

function insertSitemapUrls({ sitemap, enUrl, esUrl, lastmod }) {
  const xml = String(sitemap ?? "");
  if (xml.includes(enUrl)) return xml;
  const block = [
    "",
    `<!-- blog ${lastmod} -->`,
    `<url><loc>${enUrl}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority>`,
    `  <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>`,
    esUrl ? `  <xhtml:link rel="alternate" hreflang="es" href="${esUrl}"/>` : null,
    "</url>",
    esUrl
      ? `<url><loc>${esUrl}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority>
  <xhtml:link rel="alternate" hreflang="es" href="${esUrl}"/>
  <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>
</url>`
      : null,
    ""
  ]
    .filter((line) => line !== null)
    .join("\n");

  if (xml.includes("</urlset>")) {
    return xml.replace("</urlset>", `${block}</urlset>`);
  }
  return xml + block;
}

function normalizePayload(raw, now = new Date()) {
  const date = String(raw.date ?? todayYmdET(now)).slice(0, 10);
  const dateIso = noonUtcIso(date);
  if (!dateIso) throw new Error("date must be YYYY-MM-DD.");

  const enSlug = slugify(raw.enSlug || raw.slug);
  if (!enSlug) throw new Error("enSlug is required.");
  const esSlug = raw.esMarkdown || raw.esSlug ? slugify(raw.esSlug) : "";
  if ((raw.esMarkdown || raw.esTitle) && !esSlug) {
    throw new Error("esSlug is required when posting Spanish.");
  }

  const category = String(raw.category || "Medicare").trim() || "Medicare";
  const enTitle = String(raw.enTitle || raw.title || "").trim();
  const enDescription = String(raw.enDescription || raw.description || "").trim();
  const enBody = String(raw.enMarkdown || raw.markdown || "").trim();
  if (!enTitle || !enDescription || !enBody) {
    throw new Error("enTitle, enDescription, and enMarkdown are required.");
  }
  const enError = validatePostCopy(enBody);
  if (enError) throw new Error(enError);
  if (raw.esMarkdown) {
    const esError = validatePostCopy(raw.esMarkdown);
    if (esError) throw new Error(esError);
  }

  const enMarkdown = ensureFrontMatter(enBody, {
    layout: "layouts/blog-post.njk",
    category,
    title: enTitle,
    description: enDescription,
    dateIso,
    lang: "en",
    hreflangEs: esSlug ? `/es/blog/${esSlug}/` : undefined,
    permalink: `/blog/${enSlug}/`
  });

  let esMarkdown = null;
  if (esSlug) {
    const esTitle = String(raw.esTitle || "").trim();
    const esDescription = String(raw.esDescription || "").trim();
    const esBody = String(raw.esMarkdown || "").trim();
    if (!esTitle || !esDescription || !esBody) {
      throw new Error("esTitle, esDescription, and esMarkdown are required for the Spanish twin.");
    }
    esMarkdown = ensureFrontMatter(esBody, {
      layout: "layouts/blog-post-es.njk",
      category,
      title: esTitle,
      description: esDescription,
      dateIso,
      lang: "es",
      hreflangEn: enSlug,
      permalink: `/es/blog/${esSlug}/`
    });
  }

  return {
    date,
    category,
    enSlug,
    esSlug: esSlug || null,
    enMarkdown,
    esMarkdown,
    enCardTitle: String(raw.enCardTitle || enTitle).trim(),
    enCardExcerpt: String(raw.enCardExcerpt || enDescription).trim(),
    esCardTitle: esSlug ? String(raw.esCardTitle || raw.esTitle).trim() : null,
    esCardExcerpt: esSlug ? String(raw.esCardExcerpt || raw.esDescription).trim() : null,
    enUrl: `https://www.healthexps.com/blog/${enSlug}/`,
    esUrl: esSlug ? `https://www.healthexps.com/es/blog/${esSlug}/` : null,
    merge: raw.merge === true || raw.mode === "live"
  };
}

function applyBlogPost(payload, { root = ROOT } = {}) {
  const post = typeof payload === "string" ? normalizePayload(JSON.parse(payload)) : normalizePayload(payload);
  const enPath = path.join(root, "blog", `${post.enSlug}.md`);
  fs.writeFileSync(enPath, post.enMarkdown);
  if (post.esMarkdown) {
    fs.writeFileSync(path.join(root, "es", "blog", `${post.esSlug}.md`), post.esMarkdown);
  }

  const enListingPath = path.join(root, "blog", "index.html");
  const enListing = insertCardByDate(
    fs.readFileSync(enListingPath, "utf8"),
    englishCardHtml({
      category: post.category,
      slug: post.enSlug,
      title: post.enCardTitle,
      excerpt: post.enCardExcerpt,
      date: post.date
    }),
    post.date
  );
  fs.writeFileSync(enListingPath, enListing);

  if (post.esSlug) {
    const esListingPath = path.join(root, "es", "blog", "index.html");
    const esListing = insertCardByDate(
      fs.readFileSync(esListingPath, "utf8"),
      spanishCardHtml({
        category: post.category,
        slug: post.esSlug,
        title: post.esCardTitle,
        excerpt: post.esCardExcerpt,
        date: post.date
      }),
      post.date,
      { position: "first" }
    );
    fs.writeFileSync(esListingPath, esListing);
  }

  const sitemapPath = path.join(root, "sitemap.xml");
  fs.writeFileSync(
    sitemapPath,
    insertSitemapUrls({
      sitemap: fs.readFileSync(sitemapPath, "utf8"),
      enUrl: post.enUrl,
      esUrl: post.esUrl,
      lastmod: post.date
    })
  );

  return post;
}

module.exports = {
  applyBlogPost,
  normalizePayload,
  insertCardByDate,
  insertSitemapUrls,
  validatePostCopy,
  slugify,
  englishCardHtml
};

if (require.main === module) {
  const input = process.argv[2] && process.argv[2] !== "-"
    ? fs.readFileSync(process.argv[2], "utf8")
    : fs.readFileSync(0, "utf8");
  const result = applyBlogPost(JSON.parse(input));
  process.stdout.write(JSON.stringify({
    ok: true,
    enSlug: result.enSlug,
    esSlug: result.esSlug,
    urls: [result.enUrl, result.esUrl].filter(Boolean),
    merge: result.merge
  }, null, 2) + "\n");
}
