#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { injectSharedChrome } = require("./shared-chrome");

const root = path.resolve(__dirname, "..");
const en = fs.readFileSync(path.join(root, "index.html"), "utf8");
const es = fs.readFileSync(path.join(root, "es", "index.html"), "utf8");
const countdown = fs.readFileSync(path.join(root, "js", "aep-countdown.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "homepage-aep.css"), "utf8");

function sectionOrder(html, ids) {
  const positions = ids.map((id) => {
    const re = new RegExp(`id=["']${id}["']`);
    const match = html.match(re);
    assert.ok(match, `missing #${id}`);
    return { id, index: html.search(re) };
  });
  for (let i = 1; i < positions.length; i++) {
    assert.ok(
      positions[i].index > positions[i - 1].index,
      `expected #${positions[i - 1].id} before #${positions[i].id}`
    );
  }
}

function count(html, needle) {
  return html.split(needle).length - 1;
}

for (const [label, html] of [["EN", en], ["ES", es]]) {
  assert.ok(!html.includes("id=\"avmed-alert\""), `${label}: AvMed homepage block removed`);
  assert.ok(!html.includes("id=\"aep-home-banner\""), `${label}: pale pink strip removed`);
  assert.ok(html.includes("id=\"aep-message\""), `${label}: aep-message wrapper`);
  assert.ok(html.includes("id=\"aep-countdown\""), `${label}: aep-countdown span`);
  assert.ok(html.includes("/css/homepage-aep.css"), `${label}: banner CSS`);
  assert.ok(html.includes("/js/aep-countdown.js"), `${label}: countdown script`);
  assert.strictEqual(count(html, "Winnie Tseng"), 1, `${label}: Winnie appears once`);
  assert.ok(html.includes(">Gerry<"), `${label}: Gerry review in grid`);
  assert.ok(html.includes("Kiss Michelle"), `${label}: Kiss Michelle kept`);
  assert.ok(html.includes("Leela C."), `${label}: Leela C. kept`);
  assert.ok(!/weeks ago|hace \d+ semanas/i.test(html), `${label}: no relative review dates`);
  sectionOrder(html, ["hero-outer", "path-strip", "plans-grid", "stat-strip", "trust-quote"]);
  assert.strictEqual(count(html, "id=\"plans-grid\""), 1, `${label}: one plans grid`);
}

assert.ok(en.includes("class=\"aep-stat-num\">14<"), "EN stats use 14 carriers");
assert.ok(en.includes("insurance carriers"), "EN stats label");
assert.ok(en.includes("years combined agent experience"), "EN 14+ years stat");
assert.ok(en.includes("We currently represent 14 organizations"), "footer keeps 14 organizations");
assert.ok(en.includes("14 carriers, no exclusivity"), "trust card keeps 14 carriers");
assert.ok(!en.includes("14+ Carriers"), "EN hero no longer says 14+ Carriers");
assert.ok(en.includes("Licensed Florida agents"), "optional hero pill swap");
assert.ok(en.includes("Local, women-owned"), "optional hero pill swap");
assert.ok(
  en.includes("Free bilingual Medicare comparison in Miami"),
  "EN hero paragraph updated"
);
assert.ok(
  en.includes("Founded in 2019 by Yahoska &amp; Katy, both career agents with 14+ years of combined experience."),
  "EN local card copy updated"
);

const enBannerHref = (en.match(/class="aep-topbar-cta" href="([^"]+)"/) || [])[1];
const enHeroHref = (en.match(/id="hero-btns"[\s\S]*?<a href="([^"]+)"/) || [])[1];
assert.strictEqual(enBannerHref, "/medicare-annual-enrollment-2027");
assert.strictEqual(enHeroHref, enBannerHref, "EN enrollment buttons share a destination");

const esBannerHref = (es.match(/class="aep-topbar-cta" href="([^"]+)"/) || [])[1];
const esHeroHref = (es.match(/id="hero-btns"[\s\S]*?<a href="([^"]+)"/) || [])[1];
assert.strictEqual(esBannerHref, "/es/inscripcion-anual-medicare-2027");
assert.strictEqual(esHeroHref, esBannerHref, "ES enrollment buttons share a destination");
assert.ok(es.includes("Inscripción Abierta de Medicare"), "ES banner uses brief Spanish copy");
assert.ok(es.includes("Revisión gratuita de su plan 2027"), "ES banner CTA");
assert.ok(es.includes("class=\"aep-stat-num\">14<"), "ES stats use 14 carriers");

assert.ok(en.includes('Ms. Perez and her team have been fantastic in providing excellent customer service during the open enrollment period. She provided quick responses to all our questions in order to make our decision much easier.'), "Gerry review text");

assert.ok(countdown.includes("2026-10-15T00:00:00-04:00"), "countdown start ET");
assert.ok(countdown.includes("2026-12-07T23:59:59-05:00"), "countdown end ET");
assert.ok(countdown.includes("Ends in"), "switches to Ends in");
assert.ok(countdown.includes("Termina en"), "Spanish Ends in");
assert.ok(countdown.includes("msg.hidden = true"), "hides after Dec 7");
assert.ok(css.includes("#3F2566"), "banner purple");
assert.match(css, /\.aep-topbar\s*\{[^}]*background:\s*#3F2566/i);
assert.match(css, /\.aep-topbar-text\s*\{[^}]*color:\s*#fff/i);
assert.match(css, /\.aep-topbar-cta\s*\{[^}]*color:\s*#3F2566/i);
assert.doesNotMatch(css, /\.aep-topbar[^{]*\{[^}]*#EA158C/i);
assert.match(css, /\.home-sticky-chrome\s+\.shared-header\s*\{[^}]*position:\s*relative/i);

function panelAfter(html, triggerRe) {
  const start = html.search(triggerRe);
  assert.ok(start >= 0, `missing trigger ${triggerRe}`);
  const slice = html.slice(start);
  const panel = slice.match(/<div class="shared-nav__panel">([\s\S]*?)<\/div>/);
  assert.ok(panel, `missing shared-nav panel after ${triggerRe}`);
  return panel[1];
}

function detailsAfter(html, summary) {
  const re = new RegExp(`<details><summary>${summary}</summary><div>([\\s\\S]*?)</div></details>`);
  const match = html.match(re);
  assert.ok(match, `missing mobile <details> for ${summary}`);
  return match[1];
}

for (const homePath of [
  path.join(root, "_site", "index.html"),
  "_site/index.html",
  "./_site/index.html",
  "index.html",
]) {
  const builtHome = injectSharedChrome(en, homePath);
  assert.ok(builtHome.includes("id=\"aep-message\""), `inject keeps AEP banner for ${homePath}`);
  assert.ok(builtHome.includes("class=\"aep-topbar-cta\""), `inject keeps AEP pill CTA for ${homePath}`);
  assert.ok(!builtHome.includes("shared-topbar"), `inject does not rewrite topbar for ${homePath}`);
  const desktopResources = panelAfter(builtHome, /Resources <span aria-hidden="true">▾<\/span>/);
  assert.ok(desktopResources.includes('href="/resources"'), `desktop Resources lists All Resources for ${homePath}`);
  assert.ok(desktopResources.includes('href="/medicare-articles/"'), `desktop Resources lists Medicare Articles for ${homePath}`);
  assert.ok(desktopResources.includes('href="/events/"'), `desktop Resources lists Events for ${homePath}`);
  const mobileResources = detailsAfter(builtHome, "Resources");
  assert.ok(mobileResources.includes('href="/events/"'), `mobile Resources lists Events for ${homePath}`);
  assert.ok(mobileResources.includes("Events &amp; Workshops"), `mobile Resources Events label for ${homePath}`);
  const desktopGuides = panelAfter(builtHome, /Guides <span aria-hidden="true">▾<\/span>/);
  assert.ok(!desktopGuides.includes("/medicare-articles/"), `desktop Guides no longer lists Medicare Articles for ${homePath}`);
  assert.ok(!desktopGuides.includes("AvMed"), `desktop Guides no longer lists AvMed for ${homePath}`);
  const mobileGuides = detailsAfter(builtHome, "Guides");
  assert.ok(!mobileGuides.includes("/medicare-articles/"), `mobile Guides no longer lists Medicare Articles for ${homePath}`);
  assert.ok(!mobileGuides.includes("AvMed"), `mobile Guides no longer lists AvMed for ${homePath}`);
  assert.ok(!builtHome.includes('href="/resources" style="cursor:pointer">Resources</a>'), `stale flat desktop Resources link gone for ${homePath}`);
}

const builtEsHome = injectSharedChrome(es, "_site/es/index.html");
assert.ok(builtEsHome.includes("id=\"aep-message\""), "ES inject keeps AEP banner");
assert.ok(!builtEsHome.includes("shared-topbar"), "ES inject does not rewrite topbar");
const esDesktopResources = panelAfter(builtEsHome, /Recursos <span aria-hidden="true">▾<\/span>/);
assert.ok(esDesktopResources.includes('href="/es/recursos"'), "ES desktop Recursos lists Todos los Recursos");
assert.ok(esDesktopResources.includes('href="/es/articulos-medicare/"'), "ES desktop Recursos lists Artículos");
const esMobileResources = detailsAfter(builtEsHome, "Recursos");
assert.ok(esMobileResources.includes('href="/es/recursos"'), "ES mobile Recursos lists hub");
assert.ok(esMobileResources.includes('href="/es/articulos-medicare/"'), "ES mobile Recursos lists Artículos");
const esDesktopGuides = panelAfter(builtEsHome, /Guías <span aria-hidden="true">▾<\/span>/);
assert.ok(!esDesktopGuides.includes("/es/articulos-medicare/"), "ES desktop Guías no longer lists Artículos");
assert.ok(!esDesktopGuides.includes("AvMed"), "ES desktop Guías has no AvMed");
const esMobileGuides = detailsAfter(builtEsHome, "Guías");
assert.ok(!esMobileGuides.includes("/es/articulos-medicare/"), "ES mobile Guías no longer lists Artículos");

// Do not read _site/*.html here: a leftover `eleventy --serve` can rewrite
// those files with a stale transform while unit tests are running.

const avmedEn = fs.readFileSync(path.join(root, "avmed-medicare-florida.html"), "utf8");
const avmedEs = fs.readFileSync(path.join(root, "es", "avmed-medicare-florida.html"), "utf8");
assert.ok(!/You may still qualify for a Special Enrollment Period/i.test(avmedEn), "EN AvMed no current SEP claim");
assert.ok(!/Puede calificar para un Período de Inscripción Especial/i.test(avmedEs), "ES AvMed no current SEP claim");

console.log("homepage AEP refresh tests passed");
