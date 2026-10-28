#!/usr/bin/env node
"use strict";
/**
 * Contact-page lead events must not fire on load. generate_lead and
 * contact_form_submit fire only after a successful form submit (EN + ES).
 * There is no GTM container and no Google Ads AW- tag in site source.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM, ResourceLoader, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://www.healthexps.com";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const en = read("contact.html");
const es = read("es/contacto.html");
const chat = read("js/ghl-chat-widget.js");

assert.ok(!/GTM-[A-Z0-9]+/.test(en + es), "no GTM container on contact pages");
assert.ok(!/AW-\d+/.test(en + es), "no Google Ads AW- conversion tag on contact pages");
assert.ok(!/send_to/.test(en + es), "no gtag send_to conversion snippet on contact pages");

function gtagConfigBlock(html) {
  const m = html.match(/gtag\('config',\s*'G-SJSGF3E9MD'\);/);
  assert.ok(m, "GA4 config present");
  const around = html.slice(Math.max(0, m.index - 200), m.index + 80);
  assert.ok(!/generate_lead/.test(around), "generate_lead is not next to gtag config (page load)");
}

gtagConfigBlock(en);
gtagConfigBlock(es);

assert.ok(
  /FormSpamGuard\.submit\(payload\)[\s\S]{0,400}generate_lead/.test(en),
  "EN contact fires generate_lead only after FormSpamGuard.submit succeeds"
);
assert.ok(
  /if\(res\.ok\)\{[\s\S]{0,400}generate_lead/.test(es),
  "ES contact fires generate_lead only after the webhook accepts the lead"
);
assert.ok(
  /campaign:\s*'contact'/.test(en) && /language:\s*'en'/.test(en),
  "EN generate_lead is labeled contact / en"
);
assert.ok(
  /campaign:\s*'contacto'/.test(es) && /language:\s*'es'/.test(es),
  "ES generate_lead is labeled contacto / es"
);

class LocalLoader extends ResourceLoader {
  fetch(url) {
    try {
      const u = new URL(url);
      if (u.origin === ORIGIN) {
        const f = path.join(ROOT, decodeURIComponent(u.pathname));
        if (fs.existsSync(f) && fs.statSync(f).isFile()) return Promise.resolve(fs.readFileSync(f));
      }
    } catch (e) { /* ignore */ }
    return Promise.resolve(Buffer.from(""));
  }
}

function listedEvents(win) {
  return Array.from(win.dataLayer || []).filter((row) => row && row[0] === "event");
}

function eventsNamed(events, name) {
  return events.filter((e) => e[0] === "event" && e[1] === name);
}

async function loadContact(rel, urlPath) {
  const events = [];
  const html = read(rel);
  const vc = new VirtualConsole();
  const dom = new JSDOM(html, {
    url: ORIGIN + urlPath,
    runScripts: "dangerously",
    resources: new LocalLoader(),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      const realNow = win.Date.now.bind(win.Date);
      let offset = -60 * 1000;
      win.__advance = (ms) => { offset = Math.min(0, offset + ms); };
      win.Date.now = () => realNow() + offset;
      win.dataLayer = win.dataLayer || [];
      win.fetch = () => Promise.resolve({
        ok: true, status: 200,
        json: async () => ({ ok: true }),
        text: async () => JSON.stringify({ ok: true }),
        clone() { return this; },
      });
      win.alert = () => {};
      win.scrollTo = () => {};
      win.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {}, removeEventListener() {} });
      win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    },
  });
  const win = dom.window;
  await new Promise((r) => {
    if (win.document.readyState === "complete") r();
    else win.addEventListener("load", r);
    setTimeout(r, 2000);
  });
  win.__advance(60 * 1000);
  assert.ok(win.FormSpamGuard, rel + " loaded FormSpamGuard");
  return { win, loadEvents: listedEvents(win), dom };
}

function fillEn(doc) {
  doc.getElementById("cCoverage").value = "Medicare — Advantage, Supplement or Part D";
  doc.getElementById("cFirst").value = "Maria";
  doc.getElementById("cLast").value = "Garcia";
  doc.getElementById("cPhone").value = "3054646888";
  doc.getElementById("cEmail").value = "maria.garcia@gmail.com";
}

function fillEs(doc) {
  doc.getElementById("contact_first").value = "Maria";
  doc.getElementById("contact_last").value = "Garcia";
  doc.getElementById("contact_phone").value = "3054646888";
  doc.getElementById("contact_email").value = "maria.garcia@gmail.com";
  doc.getElementById("contact_reason").value = "Planes de Medicare";
  doc.getElementById("contact_consent").checked = true;
}

(async () => {
  const enPage = await loadContact("contact.html", "/contact/");
  const onLoadEn = eventsNamed(enPage.loadEvents, "generate_lead")
    .concat(eventsNamed(enPage.loadEvents, "contact_form_submit"));
  assert.strictEqual(onLoadEn.length, 0, "EN /contact/ does not fire lead events on load: " + JSON.stringify(enPage.loadEvents.map((e) => e[1])));

  fillEn(enPage.win.document);
  enPage.win.document.getElementById("enContactForm").dispatchEvent(
    new enPage.win.Event("submit", { bubbles: true, cancelable: true })
  );
  await new Promise((r) => setTimeout(r, 80));
  const enAfter = listedEvents(enPage.win);
  const enLead = eventsNamed(enAfter, "generate_lead");
  const enSubmit = eventsNamed(enAfter, "contact_form_submit");
  assert.strictEqual(enSubmit.length, 1, "EN contact_form_submit fires once on success");
  assert.strictEqual(enLead.length, 1, "EN generate_lead fires once on success");
  assert.strictEqual(enLead[0][2].language, "en");
  enPage.dom.window.close();

  const esPage = await loadContact("es/contacto.html", "/es/contacto/");
  const onLoadEs = eventsNamed(esPage.loadEvents, "generate_lead")
    .concat(eventsNamed(esPage.loadEvents, "contact_form_submit"));
  assert.strictEqual(onLoadEs.length, 0, "ES /es/contacto/ does not fire lead events on load: " + JSON.stringify(esPage.loadEvents.map((e) => e[1])));

  fillEs(esPage.win.document);
  esPage.win.document.getElementById("esContactForm").dispatchEvent(
    new esPage.win.Event("submit", { bubbles: true, cancelable: true })
  );
  await new Promise((r) => setTimeout(r, 80));
  const esAfter = listedEvents(esPage.win);
  const esLead = eventsNamed(esAfter, "generate_lead");
  const esSubmit = eventsNamed(esAfter, "contact_form_submit");
  assert.strictEqual(esSubmit.length, 1, "ES contact_form_submit fires once on success");
  assert.strictEqual(esLead.length, 1, "ES generate_lead fires once on success");
  assert.strictEqual(esLead[0][2].language, "es");
  esPage.dom.window.close();

  assert.ok(!/track\(["']chat_widget_loaded["']/.test(chat), "chat loader no longer sends chat_widget_loaded");
  assert.ok(/track\(["']chat_widget_opened["']/.test(chat), "chat loader sends chat_widget_opened on click");

  console.log("contact lead tracking tests passed");
  console.log("  EN load events (lead): 0; EN submit: contact_form_submit + generate_lead");
  console.log("  ES load events (lead): 0; ES submit: contact_form_submit + generate_lead");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
