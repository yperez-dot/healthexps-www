const markdownIt = require("markdown-it");

module.exports = function (eleventyConfig) {
  // ── Markdown: allow raw HTML (needed for Schema JSON-LD in posts) ──────────
  const md = markdownIt({ html: true, linkify: true, typographer: true });
  eleventyConfig.setLibrary("md", md);

  // ── Static asset passthrough ───────────────────────────────────────────────
  eleventyConfig.addPassthroughCopy("css");
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
