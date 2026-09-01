const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  applyBlogPost,
  insertCardByDate,
  insertSitemapUrls,
  validatePostCopy
} = require("./apply-blog-post");

test("validatePostCopy blocks placeholders and plan steering", () => {
  assert.match(validatePostCopy("Content unavailable"), /placeholder/);
  assert.match(validatePostCopy("You should enroll in a Cigna plan"), /plan-recommendation/);
  assert.equal(validatePostCopy("We do not pick the plan."), null);
});

test("insertCardByDate keeps newest-first order", () => {
  const listing = `<div class="card-grid" id="blogGrid">
<a class="blog-card" href="/blog/sep9/"><span class="card-date">2026-09-09</span></a>
<a class="blog-card" href="/blog/aug26/"><span class="card-date">2026-08-26</span></a>
</div>`;
  const out = insertCardByDate(listing, `<a class="blog-card"><span class="card-date">2026-09-01</span></a>`, "2026-09-01");
  const dates = [...out.matchAll(/card-date">(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
  assert.deepEqual(dates, ["2026-09-09", "2026-09-01", "2026-08-26"]);
});

test("insertSitemapUrls is idempotent", () => {
  const xml = `<?xml version="1.0"?><urlset></urlset>`;
  const once = insertSitemapUrls({
    sitemap: xml,
    enUrl: "https://www.healthexps.com/blog/nch/",
    esUrl: "https://www.healthexps.com/es/blog/nch/",
    lastmod: "2026-09-01"
  });
  const twice = insertSitemapUrls({
    sitemap: once,
    enUrl: "https://www.healthexps.com/blog/nch/",
    esUrl: "https://www.healthexps.com/es/blog/nch/",
    lastmod: "2026-09-01"
  });
  assert.equal(once, twice);
});

test("applyBlogPost writes markdown, listings, and sitemap", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-apply-"));
  fs.mkdirSync(path.join(root, "blog"));
  fs.mkdirSync(path.join(root, "es", "blog"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "blog", "index.html"),
    `<div class="card-grid" id="blogGrid">
<a class="blog-card" href="/blog/old/"><span class="card-date">2026-08-01</span></a>
</div>`
  );
  fs.writeFileSync(
    path.join(root, "es", "blog", "index.html"),
    `<div class="card-grid" id="blogGrid">
    <a href="/es/blog/old/" class="blog-card"><span class="card-date">2026-01-01</span></a>
</div>`
  );
  fs.writeFileSync(path.join(root, "sitemap.xml"), `<?xml version="1.0"?><urlset></urlset>`);

  const result = applyBlogPost({
    enSlug: "nch-en",
    enTitle: "NCH EN",
    enDescription: "Check 2027.",
    enMarkdown: "# EN\n\nWe do not pick the plan.",
    esSlug: "nch-es",
    esTitle: "NCH ES",
    esDescription: "Revise 2027.",
    esMarkdown: "# ES\n\nNo elegimos el plan.",
    date: "2026-09-01",
    mode: "live"
  }, { root });

  assert.equal(result.merge, true);
  assert.match(fs.readFileSync(path.join(root, "blog", "nch-en.md"), "utf8"), /permalink: \/blog\/nch-en\//);
  assert.match(fs.readFileSync(path.join(root, "es", "blog", "nch-es.md"), "utf8"), /hreflang_en: nch-en/);
  assert.match(fs.readFileSync(path.join(root, "blog", "index.html"), "utf8"), /nch-en/);
  assert.match(fs.readFileSync(path.join(root, "es", "blog", "index.html"), "utf8"), /nch-es/);
  assert.match(fs.readFileSync(path.join(root, "sitemap.xml"), "utf8"), /blog\/nch-en\//);
});
