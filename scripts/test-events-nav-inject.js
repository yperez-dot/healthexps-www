#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { injectEventsNav } = require("./events-nav-inject");

const en = '<a href="/medicare-articles/">Medicare Articles</a><a href="/medicare-articles/">Medicare Articles</a>';
const enResult = injectEventsNav(en, "/workspace/_site/index.html");
assert.strictEqual((enResult.match(/href="\/events\/"/g) || []).length, 2, "adds desktop and mobile English links");
assert.strictEqual(injectEventsNav(enResult, "/workspace/_site/index.html"), enResult, "English injection is idempotent");

const resourcesFallback = '<a href="/resources">All Resources</a><a href="/resources">All Resources</a>';
const resourcesResult = injectEventsNav(resourcesFallback, "/workspace/_site/index.html");
assert.strictEqual((resourcesResult.match(/href="\/events\/"/g) || []).length, 2, "falls back to All Resources anchors");

const guidesOnly = '<a href="/medicare-annual-enrollment-2027">Annual Enrollment (AEP)</a><a href="/medicare-annual-enrollment-2027/">Annual Enrollment (AEP)</a>';
assert.strictEqual(injectEventsNav(guidesOnly, "/workspace/_site/index.html"), guidesOnly, "does not inject Events under Guides");

const es = '<a href="/es/inscripcion-anual-medicare-2027/">Inscripción Anual (AEP)</a><a href="/es/articulos-medicare/">Artículos de Medicare</a>';
const esResult = injectEventsNav(es, "/workspace/_site/es/index.html");
assert.strictEqual((esResult.match(/href="\/es\/eventos\/"/g) || []).length, 0, "does not add a Spanish events page");
assert.strictEqual((esResult.match(/href="\/events\/"/g) || []).length, 0, "does not inject English events into Spanish chrome");

assert.strictEqual(injectEventsNav(en, "/workspace/_site/app.css"), en, "skips non-HTML output");

const header = fs.readFileSync(path.join(__dirname, "../_includes/medicare-articles-en-header.njk"), "utf8");
const footer = fs.readFileSync(path.join(__dirname, "../_includes/medicare-articles-en-footer.njk"), "utf8");
assert(!/Annual Enrollment \(AEP\)<\/a><a href="\/events\/">/.test(header), "desktop Guides no longer list Events after AEP");
assert(!/Annual Enrollment \(AEP\)<\/a><a href="\/events\/">/.test(footer), "footer Guides no longer list Events after AEP");
assert(header.includes('<details><summary>Resources</summary><div><a href="/resources">All Resources</a><a href="/medicare-articles/">Medicare Articles</a><a href="/events/">Events &amp; Workshops</a></div></details>'), "mobile Resources lists Events with articles");
assert(footer.includes('<a href="/medicare-articles/">Medicare Articles</a><a href="/events/">Events &amp; Workshops</a>'), "footer Resources lists Events with articles");

const aep = fs.readFileSync(path.join(__dirname, "../medicare-annual-enrollment-2027.html"), "utf8");
assert((aep.match(/href="\/events\/"/g) || []).length >= 2, "AEP page includes Events CTAs");
assert(aep.includes("Free local Medicare events this October"), "AEP page has the October events headline");
assert(aep.includes("See October workshops"), "AEP page has the workshops CTA label");

const css = fs.readFileSync(path.join(__dirname, "../css/events.css"), "utf8");
assert(/\.event-card__visual\s*\{[\s\S]*aspect-ratio:\s*1\s*\/\s*1/.test(css), "flyer frames use a square aspect ratio");
assert(/\.event-card__visual img\s*\{[\s\S]*object-fit:\s*cover/.test(css), "flyer images cover the frame without stretching");
assert(/\.event-card__visual img\s*\{[\s\S]*object-position:\s*center/.test(css), "flyer images stay centered in the frame");
assert(/\.event-card__visual\s*\{[\s\S]*overflow:\s*hidden/.test(css), "flyer frames clip overflow");

console.log("events nav inject tests passed");
