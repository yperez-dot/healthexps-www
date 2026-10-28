#!/usr/bin/env node
"use strict";
/**
 * FORM SUBMIT-PATH GUARD — blocks deploy if any visible lead form on any built
 * EN/ES page (preview pages included) would lose or mislabel a lead.
 *
 * For every built page with a lead form or phone/email inputs it:
 *   1. loads the page in jsdom with the real site scripts (incl. the sitewide
 *      form-spam-guard.js), all network stubbed — nothing leaves this machine;
 *   2. fills every lead field like a real visitor and triggers each submit path
 *      (each <form>'s submit button, every onclick="submit…()" control, every
 *      #…submit… button);
 *   3. runs each payload the page actually sends through the real
 *      netlify/functions/submit-lead.js handler (GHL + alerts stubbed) and fails if:
 *        - it posts a lead anywhere except /.netlify/functions/submit-lead
 *          (directly to GHL = spam guard missing; unknown endpoint),
 *        - submit-lead rejects it, filters it as spam, or forwards it only as
 *          "needs-review" (a real visitor's lead must pass cleanly),
 *        - the GHL label is missing, says "Homepage" off the homepage, says
 *          "Preview" on a live page, reuses another page's label on the same
 *          workflow, or is an English page's label on a Spanish page;
 *   4. re-runs each submit path with submit-lead answering 400 and fails if the
 *      visitor gets no error (no alert / error text) — i.e. a fake thank-you;
 *   5. fails if a page shows lead inputs but no submit path produced a lead,
 *      or if any inline <script> in the built page fails to parse (a broken
 *      script silently kills every form handler on the page).
 *
 * Usage: node scripts/test-form-submit-paths.js [--site <built _site dir>]
 * Without --site it builds the site (./_site) first.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { JSDOM, ResourceLoader, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://www.healthexps.com";
const PROXY = "/.netlify/functions/submit-lead";
const GHL_RE = /leadconnectorhq\.com\/hooks\/[^/]+\/webhook-trigger\/([^/?#]+)/i;
const NON_LEAD_ENDPOINTS = [/\/\.netlify\/functions\/send-email/, /\/\.netlify\/functions\/meta-capi/, /google|gtag|facebook|doubleclick|clarity/i];

/** Labels intentionally shared by several URLs of the same tool (same workflow). */
const SHARED_LABEL_OK = new Map([
  // The same health-insurance quiz is served at both URLs.
  ["ACA Quiz|c3ed8125-4847-4ebb-aca6-a5aa7817b557", ["/find-my-plan", "/health-insurance-quiz"]],
  ["Medicare Exit Screen|c3ed8125-4847-4ebb-aca6-a5aa7817b557", ["/find-my-plan", "/health-insurance-quiz"]],
  // AEP EN/ES pages send the ad channel as "source" on purpose (js/aep-season.js:
  // facebook vs organic attribution); source_key aep-2027 + language identify them.
  ["organic|dc6c8b35-9480-412e-b56d-4a4c8c7bd438", ["/medicare-annual-enrollment-2027", "/es/inscripcion-anual-medicare-2027"]],
]);

function argSite() {
  const i = process.argv.indexOf("--site");
  if (i !== -1) return path.resolve(process.argv[i + 1]);
  // The Eleventy config post-processes ./_site in place, so build there.
  execFileSync(process.execPath, [require.resolve("@11ty/eleventy/cmd.js"), "--quiet"], {
    cwd: ROOT, stdio: ["ignore", "ignore", "inherit"],
  });
  return path.join(ROOT, "_site");
}

function listPages(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) out.push(p);
    }
  })(dir);
  return out.sort();
}

function urlPathFor(site, file) {
  let rel = "/" + path.relative(site, file).split(path.sep).join("/");
  rel = rel.replace(/index\.html$/, "").replace(/\.html$/, "");
  return rel || "/";
}

const isHome = (p) => ["/", "/es/", "/es", "/index.html", "/es/index.html"].includes(p);
const isPreviewPath = (p) => /preview/i.test(p);
const isEs = (p) => /^\/es(\/|$)|^\/es-/.test(p);

class LocalLoader extends ResourceLoader {
  constructor(site) { super(); this.site = site; }
  fetch(url) {
    try {
      const u = new URL(url);
      if (u.origin === ORIGIN) {
        const f = path.join(this.site, decodeURIComponent(u.pathname));
        if (fs.existsSync(f) && fs.statSync(f).isFile()) return Promise.resolve(fs.readFileSync(f));
      }
    } catch (e) { /* ignore */ }
    return Promise.resolve(Buffer.from(""));
  }
}

const HONEYPOT = /^(_hp_name|honeypot|website|company_url|_calc_qcb_hp|_qcb_hp)$/i;

function fakeValue(el) {
  const hint = [el.name, el.id, el.getAttribute("placeholder"), el.getAttribute("autocomplete")].join(" ").toLowerCase();
  const type = (el.getAttribute("type") || "text").toLowerCase();
  if (type === "tel" || /phone|tel\b|telefono|teléfono/.test(hint)) return "3054646888";
  if (type === "email" || /e-?mail|correo/.test(hint)) return "maria.garcia@gmail.com";
  if (type === "month") return "1958-04";
  if (type === "date" || /dob|birth|nacimiento/.test(hint)) return "1958-04-12";
  if (/zip|postal|código postal|codigo/.test(hint)) return "33172";
  if (/last|family|apellido/.test(hint)) return "Garcia";
  if (/first|given|nombre/.test(hint) || /\bname\b|fname/.test(hint)) return "Maria";
  if (type === "number" || /income|age|edad|ingreso|amount|monto/.test(hint)) return "67";
  if (/notes|message|mensaje|comment/.test(hint)) return "";
  return "Maria";
}

function fillFields(win, scope) {
  const els = scope.querySelectorAll("input, select, textarea");
  const radiosDone = new Set();
  for (const el of els) {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (HONEYPOT.test(el.name || "") || HONEYPOT.test(el.id || "")) continue;
    if (type === "hidden" || type === "submit" || type === "button") continue;
    if (el.tagName === "SELECT") {
      const opt = Array.from(el.options).find((o) => o.value && !o.disabled);
      if (opt) el.value = opt.value;
    } else if (type === "checkbox") {
      el.checked = true;
    } else if (type === "radio") {
      if (radiosDone.has(el.name)) continue;
      radiosDone.add(el.name);
      el.checked = true;
    } else {
      el.value = fakeValue(el);
    }
    for (const ev of ["input", "change", "keyup"]) el.dispatchEvent(new win.Event(ev, { bubbles: true }));
  }
}

const tick = (ms) => new Promise((r) => setTimeout(r, ms));

/** Script errors raised while a submit path runs (uncaught or unhandled promise). */
let pageErrors = [];
let collecting = false;
process.on("unhandledRejection", (e) => { if (collecting) pageErrors.push(String((e && e.message) || e)); });

async function loadPage(site, file, urlPath, mode) {
  const calls = [];
  const alerts = [];
  const html = fs.readFileSync(file, "utf8");
  const vc = new VirtualConsole(); // swallow page console noise, keep script errors
  const loadErrors = [];
  vc.on("jsdomError", (e) => {
    const msg = String((e && e.message) || e).split("\n")[0];
    const detail = e && e.detail ? String(e.detail).split("\n")[0] : "";
    if (collecting) pageErrors.push(msg);
    else if (/SyntaxError/.test(msg + detail)) loadErrors.push(detail || msg); // a whole <script> failed to parse
  });
  const dom = new JSDOM(html, {
    url: ORIGIN + urlPath,
    runScripts: "dangerously",
    resources: new LocalLoader(site),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      const realNow = win.Date.now.bind(win.Date);
      // The page "loaded" a minute ago (a real visitor takes time to fill a form);
      // __advance() brings the page clock back to real time before submitting.
      let offset = -60 * 1000;
      win.__advance = (ms) => { offset = Math.min(0, offset + ms); };
      win.Date.now = () => realNow() + offset;
      win.fetch = (input, init) => {
        const url = typeof input === "string" ? input : (input && input.url) || String(input);
        calls.push({ url, init: init || {} });
        const fail = mode === "fail" && url.includes(PROXY);
        const body = fail ? { ok: false, error: "forced_failure" } : { ok: true };
        return Promise.resolve({
          ok: !fail, status: fail ? 400 : 200,
          json: async () => body, text: async () => JSON.stringify(body),
          clone() { return this; },
        });
      };
      win.alert = (m) => alerts.push(String(m));
      win.confirm = () => true;
      win.scrollTo = () => {};
      win.gtag = () => {};
      win.fbq = () => {};
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      win.HTMLElement.prototype.scrollIntoView = function () {};
    },
  });
  const win = dom.window;
  await new Promise((r) => { if (win.document.readyState === "complete") r(); else win.addEventListener("load", r); setTimeout(r, 3000); });
  await tick(30);
  win.__advance(60 * 1000); // a real visitor takes more than a few seconds to fill a form
  return { dom, win, calls, alerts, loadErrors };
}

function triggers(doc) {
  const list = [];
  const seen = new Set();
  const add = (el, why) => { if (el && !seen.has(el)) { seen.add(el); list.push({ el, why }); } };
  for (const f of doc.querySelectorAll("form")) {
    const btn = f.querySelector('button[type="submit"], input[type="submit"], button:not([type])') ||
      f.querySelector("button[onclick]");
    add(btn || f, "form#" + (f.id || "?"));
  }
  for (const el of doc.querySelectorAll("[onclick]")) {
    if (/^\s*(?:return\s+)?submit[A-Za-z0-9_]*\s*\(/.test(el.getAttribute("onclick"))) add(el, "onclick " + el.getAttribute("onclick").trim().slice(0, 40));
  }
  for (const el of doc.querySelectorAll("button[id], a[id], div[id][role=button]")) {
    if (/submit/i.test(el.id)) add(el, "#" + el.id);
  }
  return list;
}

function fire(win, t) {
  const el = t.el;
  if (el.tagName === "FORM") {
    if (typeof el.requestSubmit === "function") el.requestSubmit();
    else el.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
    return;
  }
  if (el.disabled) el.disabled = false; // buttons enabled by input handlers
  el.click();
}

function leadCalls(calls) {
  return calls.filter((c) => !NON_LEAD_ENDPOINTS.some((re) => re.test(c.url)));
}

function parseBody(init) {
  try { return JSON.parse(init.body || "{}"); } catch (e) {
    try { return Object.fromEntries(new URLSearchParams(String(init.body || ""))); } catch (e2) { return {}; }
  }
}

async function runServer(payload) {
  const lead = require("../netlify/functions/submit-lead");
  const forwards = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => {
    if (GHL_RE.test(String(url))) forwards.push(JSON.parse(init.body));
    return { ok: true, status: 200, text: async () => "{}", json: async () => ({}) };
  };
  const quiet = console.log; const qw = console.warn;
  const logged = [];
  console.log = (...a) => logged.push(a.join(" ")); console.warn = () => {};
  try {
    const res = await lead.handler({
      httpMethod: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const why = (logged.join(" ").match(/(?:filtered|rejected):\s*([a-z_]+)/) || [])[1];
    return { res, body: JSON.parse(res.body || "{}"), forwards, why };
  } finally {
    console.log = quiet; console.warn = qw;
    global.fetch = realFetch;
  }
}

async function main() {
  delete process.env.GHL_API_TOKEN; // enrichment + alerts become no-ops; nothing reaches GHL
  for (const k of Object.keys(process.env)) if (/^(GHL_|ALERT_SMTP)/.test(k)) delete process.env[k];
  const { pageLabel } = require("../netlify/lib/ghl-enrich");
  const { resolveWebhookId } = require("../netlify/functions/submit-lead");
  const site = argSite();
  const problems = [];
  const labelUse = new Map(); // label|webhook -> Set(paths)
  const enLabels = new Map(); // label|webhook -> path (EN pages)
  const esLabels = [];
  let pagesWithForms = 0;
  let paths = 0;

  for (const file of listPages(site)) {
    const html = fs.readFileSync(file, "utf8");
    if (!/<form\b|type=["'](tel|email)["']/i.test(html)) continue;
    const urlPath = urlPathFor(site, file);
    const only = process.argv.indexOf("--only");
    if (only !== -1 && !urlPath.includes(process.argv[only + 1])) continue;
    if (/noindex/i.test(html) && !isPreviewPath(urlPath) && !/<form\b/i.test(html)) continue;
    pagesWithForms++;
    const page = await loadPage(site, file, urlPath, "ok");
    for (const err of new Set(page.loadErrors)) problems.push(`${urlPath} has a <script> that fails to parse in the built page: ${err.slice(0, 120)}`);
    const ts = triggers(page.win.document);
    let leadsSeen = 0;
    for (let i = 0; i < ts.length; i++) {
      // fresh page per trigger so one path cannot mask another
      const p = i === 0 ? page : await loadPage(site, file, urlPath, "ok");
      const t = triggers(p.win.document)[i];
      if (!t) continue;
      fillFields(p.win, p.win.document);
      const before = p.calls.length;
      pageErrors = []; collecting = true;
      try { fire(p.win, t); } catch (e) { pageErrors.push(String(e.message || e)); }
      await tick(150);
      collecting = false;
      for (const err of new Set(pageErrors)) problems.push(`${urlPath} [${t.why}] script error while submitting: ${err.slice(0, 120)}`);
      const calls = leadCalls(p.calls.slice(before));
      if (!calls.length) { if (p !== page) p.win.close(); continue; }
      paths++;
      for (const c of calls) {
        if (!c.url.includes(PROXY)) {
          problems.push(`${urlPath} [${t.why}] posts a lead to ${GHL_RE.test(c.url) ? "GHL directly (spam guard not loaded)" : "an unknown endpoint: " + c.url.slice(0, 60)}`);
          continue;
        }
        const payload = parseBody(c.init);
        if (process.env.FORM_GUARD_DEBUG) console.log(urlPath, t.why, JSON.stringify({ source: payload.source, keys: Object.keys(payload) }));
        const hasContact = Boolean(payload.phone || payload.email || payload.phone_number || payload.firstName || payload.first_name);
        if (!hasContact && !(payload.contactData)) continue; // e.g. WhatsApp click pings, no lead
        leadsSeen++;
        const out = await runServer(payload);
        const tags = out.forwards.map((f) => String(f.tags || "")).join(",");
        if (out.res.statusCode !== 200 || !out.body.ok || out.body.filtered) {
          problems.push(`${urlPath} [${t.why}] REJECTED by submit-lead: ${out.res.statusCode} ${out.body.error || (out.body.filtered ? "filtered (" + (out.why || "?") + ")" : "")}`);
        } else if (!out.forwards.length) {
          problems.push(`${urlPath} [${t.why}] accepted but never forwarded to GHL`);
        } else if (/needs-review/.test(tags)) {
          problems.push(`${urlPath} [${t.why}] only forwarded as needs-review (${(tags.match(/review:[a-z_]+/) || [""])[0]})`);
        }
        const fwdPath = (out.forwards[0] && out.forwards[0].page_path) || payload.page_path || urlPath;
        const label = pageLabel(payload, fwdPath);
        const webhook = resolveWebhookId(payload) || "?";
        if (!label || /^(Website form|Form: )$/.test(label)) problems.push(`${urlPath} [${t.why}] has no GHL label`);
        if (/homepage/i.test(label.replace(/^Form: \S+$/, "")) && !isHome(urlPath)) problems.push(`${urlPath} [${t.why}] labeled "${label}" (homepage label off the homepage)`);
        if (/preview/i.test(label) && !isPreviewPath(urlPath)) problems.push(`${urlPath} [${t.why}] labeled "${label}" (preview label on a live page)`);
        const key = label + "|" + webhook;
        if (!labelUse.has(key)) labelUse.set(key, new Set());
        labelUse.get(key).add(urlPath.replace(/\/$/, "") || "/");
        if (isEs(urlPath)) esLabels.push({ key, urlPath, label, why: t.why });
        else enLabels.set(key, urlPath);
      }
      if (p !== page) p.win.close();

      // failure UX: same path with submit-lead failing must show the visitor an error
      const f = await loadPage(site, file, urlPath, "fail");
      const tf = triggers(f.win.document)[i];
      if (tf) {
        fillFields(f.win, f.win.document);
        const errBefore = visibleErrorText(f.win.document);
        try { fire(f.win, tf); } catch (e) { /* ignore */ }
        await tick(150);
        const sent = leadCalls(f.calls).some((c) => c.url.includes(PROXY) && /phone|email|first/i.test(String(c.init.body || "")));
        if (sent && !f.alerts.length && visibleErrorText(f.win.document) === errBefore) {
          problems.push(`${urlPath} [${t.why}] shows no error when the submit fails (fake thank-you)`);
        }
      }
      f.win.close();
    }
    const hasInputs = page.win.document.querySelector('input[type="tel"], input[type="email"]');
    if (hasInputs && !leadsSeen) problems.push(`${urlPath} shows lead inputs but no submit path produced a lead`);
    page.win.close();
  }

  for (const [key, set] of labelUse) {
    const pages = Array.from(set);
    // Preview pages mirror a live page (sometimes under a different URL), so they
    // may reuse its label; two LIVE pages sharing one label is the real problem.
    const live = pages.filter((p) => !isPreviewPath(p));
    const base = new Set((live.length ? live : pages).map((p) => p.replace(/-preview$/, "")));
    if (base.size > 1) {
      const ok = SHARED_LABEL_OK.get(key);
      if (!(ok && pages.every((p) => ok.includes(p)))) problems.push(`label "${key.split("|")[0]}" is shared by different pages on the same workflow: ${pages.join(", ")}`);
    }
  }
  for (const e of esLabels) {
    const en = enLabels.get(e.key);
    const ok = SHARED_LABEL_OK.get(e.key);
    if (ok && ok.includes(e.urlPath.replace(/\/$/, ""))) continue;
    if (en && en.replace(/-preview$/, "") !== e.urlPath.replace(/-preview$/, "")) {
      problems.push(`${e.urlPath} [${e.why}] sends the English page label "${e.label}" (same as ${en})`);
    }
  }

  const onlyRun = process.argv.includes("--only");
  if (!onlyRun && pagesWithForms < 20) problems.push(`only ${pagesWithForms} pages with forms found in ${site} — wrong build directory?`);
  const uniq = Array.from(new Set(problems));
  console.log(`test-form-submit-paths: ${pagesWithForms} pages with forms, ${paths} submit paths exercised`);
  if (uniq.length) {
    console.error(`test-form-submit-paths: ${uniq.length} problem(s)`);
    for (const p of uniq) console.error(" - " + p);
    process.exit(1);
  }
  console.log("test-form-submit-paths: ok");
}

// Own visibility only: multi-step forms keep the error banner inside a step the
// harness never navigated to, but the banner itself still flips to visible.
function isShown(el) {
  if (el.hidden) return false;
  const cs = el.ownerDocument.defaultView.getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden";
}

function visibleErrorText(doc) {
  return Array.from(doc.querySelectorAll('[id*="rror"], [class*="rror"], [id*="Err"], [class*="Err"], [role="alert"]'))
    .filter((el) => isShown(el) && (el.textContent || "").trim())
    .map((el) => el.textContent.trim()).join("|");
}

main().catch((e) => { console.error(e); process.exit(1); });
