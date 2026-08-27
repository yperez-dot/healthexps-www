const markdownIt = require("markdown-it");

module.exports = function (eleventyConfig) {
  // Internal docs — never publish these as public pages
  const internalDocs = [
    'HOMEPAGE-RULES.md', 'IGOR_README.md', 'NEW-PAGE-CHECKLIST.md',
    'PENDING_DEPLOY.md', 'README.md', 'competitor-gap-analysis-2026-07-05.md',
    'seo-audit-2026-07-05.md', 'seo-health-2026-08-26.md'
  ];
  internalDocs.forEach(f => eleventyConfig.ignores.add(f));
  // Safety net: ignore all caps .md files and any file with internal markers
  eleventyConfig.ignores.add('**/*RULES*.md');
  eleventyConfig.ignores.add('**/*CHECKLIST*.md');
  eleventyConfig.ignores.add('**/*PENDING*.md');
  eleventyConfig.ignores.add('**/*README*.md');

  // ── Markdown: allow raw HTML (needed for Schema JSON-LD in posts) ──────────
  const md = markdownIt({ html: true, linkify: true, typographer: true });
  eleventyConfig.setLibrary("md", md);

  // ── Static asset passthrough ───────────────────────────────────────────────
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("favicon.ico");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("sitemap.xml");

  // ── Collections (future-dated posts filtered at build time) ───────────────
  const now = new Date();

  eleventyConfig.addCollection("blog", function (api) {
    return api
      .getFilteredByGlob("blog/*.md")
      .filter((p) => p.date <= now)
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("blogEs", function (api) {
    return api
      .getFilteredByGlob("es/blog/*.md")
      .filter((p) => p.date <= now)
      .sort((a, b) => b.date - a.date);
  });

  // ── Date display filters ───────────────────────────────────────────────────
  eleventyConfig.addFilter("readableDate", (d) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    })
  );

  eleventyConfig.addFilter("readableDateEs", (d) =>
    new Date(d).toLocaleDateString("es-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    })
  );

  // ISO 8601 date for schema.org datePublished / dateModified.
  // Use UTC calendar date so YAML `2026-07-22` does not shift to the previous day in US timezones.
  eleventyConfig.addFilter("isoDate", (d) => {
    if (!d) return "";
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) {
      return d.slice(0, 10);
    }
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  // ── Eleventy config ────────────────────────────────────────────────────────
  return {
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: false, // Existing HTML files copied verbatim — no layout wrapping
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
  };
};
