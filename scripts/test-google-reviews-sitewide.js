#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "_site", ".git", ".netlify", "scripts"]);
const STALE_NAMES = [
  "Winnie Tseng",
  "Kiss Michelle",
  "Leela C.",
  "Margaret",
];
const STALE_COUNTS = [
  /38 Google reviews/i,
  /38 reseñas de Google/i,
  /38\+ Google/i,
  /38\+ verified/i,
  /38 five-star/i,
  /48 Google reviews/i,
  /48 reseñas de Google/i,
  /\b48 verified reviews\b/i,
  /\b48 reseñas verificadas\b/i,
];
const RELATIVE_DATES = /weeks ago|days ago|hace \d+\s+semanas?/i;
const ALLOWED_AUTHORS = ["Rudy G", "Elaine Pajaro", "Maria Lopez"];
const THREE_CARD_FILES = [
  "index.html",
  "es/index.html",
  "es-homepage-preview.html",
  "medicare-plans-miami.html",
  "es/planes-de-medicare-miami.html",
  "es/planes-de-medicare-miami-preview.html",
  "medicare-advantage-miami.html",
  "es/medicare-advantage-miami.html",
  "es/medicare-advantage-miami-preview.html",
  "medicare-agent-miami.html",
  "es/agente-de-medicare-miami.html",
  "es/seguro-de-vida-miami.html",
  "es/seguro-de-vida-miami-preview.html",
];
const BASICS_HTML = "blog/private-health-insurance-basics-plans-costs-and-coverage-explained.html";

function walk(dir, acc) {
  acc = acc || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (SKIP_DIRS.has(ent.name)) return;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (/\.(html|md|njk)$/.test(ent.name)) acc.push(full);
  });
  return acc;
}

function rel(file) {
  return path.relative(root, file);
}

const files = walk(root);
const htmlFiles = files.filter(function (f) {
  return f.endsWith(".html");
});
assert.ok(htmlFiles.length >= 130, "expected >=130 public HTML sources, got " + htmlFiles.length);
assert.ok(files.length >= 170, "expected >=170 html+md+njk sources, got " + files.length);

files.forEach(function (file) {
  const text = fs.readFileSync(file, "utf8");
  const label = rel(file);
  STALE_NAMES.forEach(function (name) {
    assert.ok(!text.includes(name), label + ": stale reviewer " + name);
  });
  assert.ok(!/>Gerry</.test(text) && !/\bGerry\b/.test(text), label + ": stale Gerry reviewer");
  STALE_COUNTS.forEach(function (re) {
    assert.ok(!re.test(text), label + ": stale count " + re);
  });
  assert.ok(!RELATIVE_DATES.test(text), label + ": frozen relative review date");
});

htmlFiles.forEach(function (file) {
  const html = fs.readFileSync(file, "utf8");
  const label = rel(file);
  const isPreviewHome = label === "es-homepage-preview.html";
  if (/aggregateRating/i.test(html)) {
    assert.ok(isPreviewHome, label + ": AggregateRating not allowed (do not add)");
  }
  if (/"@type":\s*"Review"/.test(html)) {
    assert.ok(isPreviewHome, label + ": Review schema only on existing ES homepage preview");
  }
  if (/Verified Google review|Reseña verificada de Google/.test(html)) {
    ALLOWED_AUTHORS.forEach(function (name) {
      if (label === "medical-insurance-broker.html" && name === "Maria Lopez") return;
      assert.ok(html.includes(name), label + ": Google review slot missing " + name);
    });
  }
});

THREE_CARD_FILES.forEach(function (relPath) {
  const html = fs.readFileSync(path.join(root, relPath), "utf8");
  const rudy = html.indexOf("Rudy G");
  const elaine = html.indexOf("Elaine Pajaro");
  const maria = html.indexOf("Maria Lopez");
  assert.ok(rudy >= 0 && elaine >= 0 && maria >= 0, relPath + ": missing newest-3 authors");
  assert.ok(rudy < elaine && elaine < maria, relPath + ": newest order Rudy → Elaine → Maria");
  assert.ok(html.includes("share.google/UmSs9MnoSC9ydz4Fs"), relPath + ": Rudy share URL");
  assert.ok(html.includes("share.google/WIggnXxHq8vBy43gw"), relPath + ": Elaine share URL");
  assert.ok(html.includes("share.google/um9dfH93g6fQgjIHh"), relPath + ": Maria share URL");
});

const broker = fs.readFileSync(path.join(root, "medical-insurance-broker.html"), "utf8");
assert.ok(broker.includes("Rudy G") && broker.includes("Elaine Pajaro"), "broker 2-slot Google cites");
assert.ok(!broker.includes("doctors and hospital were in-network"), "broker invented Google cite removed");
assert.ok(broker.indexOf("Rudy G") < broker.indexOf("Elaine Pajaro"), "broker newest-two order");

const redirects = fs.readFileSync(path.join(root, "_redirects"), "utf8");
assert.ok(/\/post\/\*\s+\/blog\/:splat\s+301!/.test(redirects), "/post/* splat 301 to /blog/:splat");
assert.ok(
  !fs.existsSync(path.join(root, "post")),
  "no source /post/ directory (Wix slug is redirect-only)"
);
assert.ok(
  !fs.existsSync(path.join(root, "blog", "private-health-insurance-basics.html")),
  "short /blog/private-health-insurance-basics is not a source page"
);
const netlify = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");
assert.ok(
  netlify.includes('from = "/blog/private-health-insurance-basics/"') &&
    netlify.includes("private-health-insurance-basics-plans-costs-and-coverage-explained"),
  "short blog slug 301s to current basics article"
);

const basics = fs.readFileSync(path.join(root, BASICS_HTML), "utf8");
["Winnie", "Kiss Michelle", "Leela", "Margaret", "Rudy G", "38 Google", "48 Google", "49 Google", "Verified Google", "aggregateRating"].forEach(
  function (needle) {
    assert.ok(!basics.includes(needle), BASICS_HTML + " must not contain " + needle);
  }
);

const homepage = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(!/aggregateRating/i.test(homepage), "production EN homepage has no AggregateRating");
assert.ok(homepage.includes("49 verified reviews") || homepage.includes("49 Google reviews"), "EN home count 49");

console.log(
  "test-google-reviews-sitewide: ok (" +
    htmlFiles.length +
    " html, " +
    files.length +
    " html+md+njk)"
);
