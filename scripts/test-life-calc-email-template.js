#!/usr/bin/env node
"use strict";
/**
 * Spanish life-calculator results email must include the same breakdown as EN.
 * Regression: ES used to send html: '' because buildEmailHtml was missing.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

function extract(html) {
  const start = html.indexOf("function buildEmailHtml()");
  assert.ok(start !== -1, "buildEmailHtml() is defined");
  const end = html.indexOf("async function submitToGHL", start);
  assert.ok(end !== -1, "buildEmailHtml sits before submitToGHL");
  return html.slice(start, end);
}

const enSrc = extract(fs.readFileSync(path.join(ROOT, "life-insurance-calculator.html"), "utf8"));
const esSrc = extract(fs.readFileSync(path.join(ROOT, "es/calculadora-seguro-de-vida.html"), "utf8"));

function render(fnSrc, lang) {
  const ctx = {
    S: {
      language: lang,
      recommended: 850000,
      income_replacement: 700000,
      debt_payoff: 180000,
      offsets: 45000,
      fname: "Maria",
    },
  };
  vm.runInNewContext(fnSrc + "\nthis.html = buildEmailHtml();", ctx);
  return ctx.html;
}

const enHtml = render(enSrc, "en");
const esHtml = render(esSrc, "es");

assert.ok(enHtml && enHtml.length > 400, "English email HTML is populated");
assert.ok(esHtml && esHtml.length > 400, "Spanish email HTML is populated (was empty)");
assert.ok(enHtml.includes("YOUR COVERAGE ESTIMATE"), "EN header");
assert.ok(esHtml.includes("TU ESTIMADO DE COBERTURA"), "ES header matches EN meaning");
assert.ok(enHtml.includes("Income replacement"), "EN income row");
assert.ok(esHtml.includes("Reemplazo de ingresos"), "ES income row");
assert.ok(enHtml.includes("Mortgage"), "EN debt row");
assert.ok(esHtml.includes("Hipoteca y deudas"), "ES debt row");
assert.ok(enHtml.includes("See What This Costs Me"), "EN CTA");
assert.ok(esHtml.includes("Ver Cuánto Cuesta"), "ES CTA");
assert.ok(enHtml.includes("$850,000") && esHtml.includes("$850,000"), "both include the coverage amount");
assert.ok(esHtml.includes("https://healthexps.com/es/calculadora-seguro-de-vida/"), "ES CTA points at the Spanish calculator");
assert.ok(
  !/html:\s*typeof buildEmailHtml === 'function' \? buildEmailHtml\(\) : ''/.test(
    fs.readFileSync(path.join(ROOT, "es/calculadora-seguro-de-vida.html"), "utf8").replace(esSrc, "")
  ) || esHtml.length > 0,
  "Spanish page now has a real template even if the call is still guarded"
);

console.log("life calculator email template tests passed");
console.log("  EN html length:", enHtml.length);
console.log("  ES html length:", esHtml.length);
