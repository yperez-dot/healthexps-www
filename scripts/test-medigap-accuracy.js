const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const M = require("../js/medigap-cost-model");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assertIncludes(haystack, needle, msg) {
  assert(haystack.includes(needle), msg || "expected to include: " + needle);
}

function assertNotIncludes(haystack, needle, msg) {
  assert(!haystack.includes(needle), msg || "expected not to include: " + needle);
}

/* Official CMS amounts used in this PR. */
assert.strictEqual(M.PART_B_YEAR, 2026);
assert.strictEqual(M.PART_B_PREMIUM_MONTHLY, 202.9);
assert.strictEqual(M.PART_B_DEDUCTIBLE_ANNUAL, 283);
assert.strictEqual(M.HD_G_DEDUCTIBLE_2026, 2950);
assert.strictEqual(M.HD_G_DEDUCTIBLE_2027, 3050);
assert.strictEqual(M.PLAN_K_OOP_2026, 8000);
assert.strictEqual(M.PLAN_L_OOP_2026, 4000);
assert.strictEqual(M.PLAN_K_OOP_2027, 8360);
assert.strictEqual(M.PLAN_L_OOP_2027, 4180);
assert.strictEqual(M.HD_USAGE_OOP.high, 2950, "calculator HD high-usage OOP stays on 2026 HDG");
assert.strictEqual(M.DEFAULT_PREMIUMS_BY_AGE[65].G, 337);
assert.strictEqual(M.DEFAULT_PREMIUMS_BY_AGE[65].N, 260);
assert.strictEqual(M.DEFAULT_PREMIUMS_BY_AGE[65].HD, 80);

/* Fair G vs N slider: both pay Part B deductible; N adds copays; no $283 cap. */
const zero = M.gnSliderCosts(0);
assert.strictEqual(zero.g, 283);
assert.strictEqual(zero.n, 283);
const six = M.gnSliderCosts(6);
assert.strictEqual(six.g, 283);
assert.strictEqual(six.n, 403);
const twelve = M.gnSliderCosts(12);
assert.strictEqual(twelve.n, 283 + 240);
assert.notStrictEqual(twelve.n, 283);

/* Per-plan quote replacement throughout 20-year projection. */
const estimates = M.resolvePremiums(65, {});
assert.deepStrictEqual(estimates.premiums, { G: 337, N: 260, HD: 80 });
assert.deepStrictEqual(estimates.sources, { G: "estimate", N: "estimate", HD: "estimate" });

const partial = M.resolvePremiums(65, { G: "400", N: "  ", HD: "" });
assert.strictEqual(partial.premiums.G, 400);
assert.strictEqual(partial.premiums.N, 260);
assert.strictEqual(partial.premiums.HD, 80);
assert.strictEqual(partial.sources.G, "entered");
assert.strictEqual(partial.sources.N, "estimate");
assert.strictEqual(partial.sources.HD, "estimate");
assert.deepStrictEqual(M.sourceCounts(partial.sources), { entered: 1, estimate: 2 });

const projEst = M.projectCosts({ premiums: estimates.premiums, usage: "med" });
const projPartial = M.projectCosts({ premiums: partial.premiums, usage: "med" });
assert.strictEqual(Math.round(projPartial.yearlyPremium.G[0]), 400 * 12);
assert.strictEqual(Math.round(projPartial.yearlyPremium.G[19]), Math.round(400 * Math.pow(1.021, 19) * 12));
assert.ok(projPartial.totals.G > projEst.totals.G, "entered G premium replaces estimate in all years");
assert.strictEqual(projPartial.totals.N, projEst.totals.N, "blank N keeps estimate");
assert.strictEqual(projPartial.totals.HD, projEst.totals.HD, "blank HD keeps estimate");

const allEntered = M.resolvePremiums(70, { G: "1", N: "2", HD: "3" });
assert.deepStrictEqual(allEntered.premiums, { G: 1, N: 2, HD: 3 });
assert.strictEqual(M.sourceCounts(allEntered.sources).entered, 3);

/* Live pages: 2027 HDG/K/L informational display, 2026 Part B labeled. */
const enService = read("medicare-supplement-miami.html");
const esService = read("es/medicare-suplementario-miami.html");
const enCalc = read("medigap-plan-calculator.html");
const esCalc = read("es/calculadora-medigap.html");
const enContact = read("contact.html");
const esContact = read("es/contacto.html");
const enroll = read("js/medicare-enrollment-calc.js");
const enVs = read("medicare-advantage-vs-supplement-calculator.html");
const esVs = read("es/calculadora-advantage-vs-suplemento.html");

assertIncludes(enService, "Out-of-pocket limit (2027)");
assertIncludes(enService, "$8,360");
assertIncludes(enService, "$4,180");
assertIncludes(enService, "$3,050 deductible before coverage kicks in (CMS, 2027)");
assertIncludes(enService, "2027 Part B premium and deductible are not yet announced");
assertIncludes(enService, "$283 Part B deductible (2026)");
assertNotIncludes(enService, "Out-of-pocket limit (2026)");
assert.strictEqual((enService.match(/\$8,360/g) || []).length > 0, true);

assertIncludes(esService, "Límite de gastos de bolsillo (2027)");
assertIncludes(esService, "$8,360");
assertIncludes(esService, "$4,180");
assertIncludes(esService, "$3,050");
assertIncludes(esService, "CMS, 2027");
assertIncludes(esService, "Parte B de 2027 aún no están anunciados");
assertIncludes(esService, "$283 (2026)");
assertNotIncludes(esService, "Límite de gastos de bolsillo (2026)");

/* Calculator complete math stays 2026; no mixed 2027 total. */
assertIncludes(enCalc, "does not produce a 2027 total");
assertIncludes(enCalc, "HDG deductible $2,950");
assertIncludes(enCalc, "Part B $202.90/mo and $283 deductible");
assertIncludes(enCalc, "2027 HDG $3,050, Plan K $8,360, and Plan L $4,180");
assertIncludes(enCalc, '<script src="/js/medigap-cost-model.js"></script>');
assertIncludes(enCalc, "Florida has no birthday rule");
assertIncludes(enCalc, "Medigap Cost Calculator Florida 2026");
assertIncludes(esCalc, "no produce un total de 2027");
assertIncludes(esCalc, "deducible HDG $2,950");
assertIncludes(esCalc, '<script src="/js/medigap-cost-model.js"></script>');
assertIncludes(esCalc, "Florida no tiene regla de cumpleaños");
assertIncludes(esCalc, "Calculadora Medigap Florida 2026");
assertIncludes(esCalc, "premiumSourceNote");
assertIncludes(esCalc, "(su cotización)");

/* Titles / H1 preserved. */
assertIncludes(enService, "<title>Medicare Supplement Miami | Any Doctor, Free Quotes</title>");
assertIncludes(enService, "Medicare Supplement in Miami &mdash; No Surprises. No Networks.");
assertIncludes(esService, "<title>Medicare Suplementario Miami | Cualquier Doctor, Gratis</title>");
assertIncludes(esService, "Medicare Suplementario (Medigap)<br>en Miami");

/* Carrier chips unchanged; scoped disclaimer kept. */
[
  "Mutual of Omaha",
  "Aetna",
  "UnitedHealthcare",
  "Humana",
  "Florida Blue",
  "Cigna Supplement",
  "Anthem",
  "Manhattan Life",
  "GPM Life"
].forEach(function (name) {
  assertIncludes(enService, name);
  assertIncludes(esService, name);
});
assertNotIncludes(enService, "United American");
assertNotIncludes(esService, "United American");
assertNotIncludes(enService, "HealthSpring");
assertNotIncludes(esService, "HealthSpring");
assertIncludes(enService, "Not every listed brand sells Medigap");
assertIncludes(esService, "No todas las marcas listadas venden Medigap");

/* Florida has no birthday rule in shared enrollment copy and vs-supplement tools. */
assertIncludes(enroll, "Florida does not have a birthday rule.");
assertIncludes(enroll, "Florida no tiene regla de cumpleaños.");
assertNotIncludes(enroll, "except Florida");
assertNotIncludes(enroll, "salvo la regla de cumpleaños");
assertIncludes(enVs, "Florida does not have a birthday rule");
assertIncludes(esVs, "Florida no tiene regla de cumpleaños");
assertNotIncludes(enVs, "birthday rule helps");
assertNotIncludes(esVs, "regla de cumpleaños de Florida ayuda");

/* Saturday: call center vs office appointment; do not invent 10–2. */
assertIncludes(enContact, "Call center available; office visits by appointment");
assertNotIncludes(enContact, "10am");
assertIncludes(esContact, "centro de llamadas disponible");
assertIncludes(esContact, "visitas a la oficina con cita");
assertNotIncludes(esContact, "10am–2pm");
assertNotIncludes(esContact, "10:00am – 2:00pm");
assertNotIncludes(esContact, '"dayOfWeek":"Saturday"');
assertNotIncludes(esContact, '"opens":"10:00"');

/* Review count 38 is gone where it would be a Google review claim. */
function walkHtml(dir, files) {
  files = files || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (ent.name === "node_modules" || ent.name === "_site" || ent.name === ".git") return;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkHtml(full, files);
    else if (/\.html$/.test(ent.name) && !/-preview\.html$/.test(ent.name) && ent.name !== "es-homepage-preview.html") {
      files.push(full);
    }
  });
  return files;
}
walkHtml(root).forEach(function (file) {
  const html = fs.readFileSync(file, "utf8");
  assert(!/38 Google reviews/.test(html), "stale 38 Google reviews in " + path.relative(root, file));
  assert(!/38 reseñas de Google/.test(html), "stale 38 reseñas in " + path.relative(root, file));
});

/* Bilingual calculator quote-source DOM hooks exist. */
[enCalc, esCalc].forEach(function (html) {
  assertIncludes(html, 'id="premiumSourceNote"');
  assertIncludes(html, 'id="advG"');
  assertIncludes(html, 'id="ctaUrge"');
});

console.log("test-medigap-accuracy: ok");
