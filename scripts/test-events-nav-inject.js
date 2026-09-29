#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { injectEventsNav } = require("./events-nav-inject");

const en = '<a href="/medicare-annual-enrollment-2027">Annual Enrollment (AEP)</a><a href="/medicare-annual-enrollment-2027/">Annual Enrollment (AEP)</a>';
const enResult = injectEventsNav(en, "/workspace/_site/index.html");
assert.strictEqual((enResult.match(/href="\/events\/"/g) || []).length, 2, "adds desktop and mobile English links");
assert.strictEqual(injectEventsNav(enResult, "/workspace/_site/index.html"), enResult, "English injection is idempotent");

const es = '<a href="/es/inscripcion-anual-medicare-2027/">Inscripción Anual (AEP)</a><a href="/es/inscripcion-anual-medicare-2027/">Inscripción Anual (AEP)</a>';
const esResult = injectEventsNav(es, "/workspace/_site/es/index.html");
assert.strictEqual((esResult.match(/href="\/es\/eventos\/"/g) || []).length, 0, "does not add a Spanish events page");
assert.strictEqual((esResult.match(/href="\/events\/"/g) || []).length, 0, "does not inject English events into Spanish chrome");

assert.strictEqual(injectEventsNav(en, "/workspace/_site/app.css"), en, "skips non-HTML output");
console.log("events nav inject tests passed");
