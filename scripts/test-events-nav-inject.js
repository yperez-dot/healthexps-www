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
assert(!/\.event-card__visual/.test(css), "event cards have no photo-band styles");
assert(!/object-fit:\s*contain/.test(css), "no card uses contain letterboxing");
assert(!/#f3e6c8/.test(css), "no beige letterbox background remains");
assert(/\.events-grid\s*\{[\s\S]*align-items:\s*stretch/.test(css), "text-only cards stretch to a uniform row height");

const eventsPage = fs.readFileSync(path.join(__dirname, "../events.njk"), "utf8");
assert(!/<figure/.test(eventsPage), "event cards have no figure wrappers");
assert(!/<img\b/.test(eventsPage), "event cards have no images");
assert(!eventsPage.includes("/images/events/"), "events page does not reference event image assets");
assert(eventsPage.includes(">For residents only<"), "East Ridge badge is residents-only");
assert(eventsPage.includes("event-card__badge--sentence"), "East Ridge badge keeps sentence-case wording");
assert(/\.event-card__badge--sentence\s*\{[\s\S]*text-transform:\s*none/.test(css), "residents-only badge is not forced to uppercase");
assert((eventsPage.match(/RSVP required/g) || []).length === 3, "Pinecrest, Senior LIFT, and Keiser stay RSVP required");
assert(eventsPage.includes("Pinecrest Community Center, 5855 Killian Dr, Pinecrest, FL 33156"), "Pinecrest location is the community center address");
assert(!/Pinecrest Community Center,,/.test(eventsPage), "Pinecrest location has no double comma");
assert(eventsPage.includes("Keiser University, Auditorium, 2101 NW 117th Ave, Miami, FL 33172"), "Keiser location leads with the university");

const eventsDir = path.join(__dirname, "../images/events");
assert(!fs.existsSync(eventsDir) || fs.readdirSync(eventsDir).length === 0, "unused images/events files are removed");

console.log("events nav inject tests passed");
