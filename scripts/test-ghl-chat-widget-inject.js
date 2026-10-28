#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { injectGhlChatWidget, SCRIPT_TAG, SCRIPT_MARK } = require("./ghl-chat-widget-inject");

const html = "<html><body><h1>Hi</h1></body></html>";
const injected = injectGhlChatWidget(html, "/workspace/_site/index.html");
assert.ok(injected.includes(SCRIPT_TAG.trim()), "injects loader before </body>");
assert.strictEqual(
  injectGhlChatWidget(injected, "/workspace/_site/index.html"),
  injected,
  "does not double-inject"
);

assert.strictEqual(
  injectGhlChatWidget(html, "/workspace/_site/css/global.css"),
  html,
  "skips non-HTML output"
);

assert.strictEqual(
  injectGhlChatWidget("<html><h1>no body</h1></html>", "/workspace/_site/x.html"),
  "<html><h1>no body</h1></html>",
  "skips HTML without </body>"
);

const upper = injectGhlChatWidget("<BODY>x</BODY>", "/tmp/out.html");
assert.ok(upper.includes(SCRIPT_MARK), "matches case-insensitive </body>");

const fs = require("fs");
const path = require("path");
const widget = fs.readFileSync(path.join(__dirname, "../js/ghl-chat-widget.js"), "utf8");
assert.ok(widget.includes("shadowRoot"), "quiets proactive greeting inside chat-widget shadow DOM");
assert.ok(widget.includes("__THEI_CHAT_USER_OPEN"), "stops hiding after visitor clicks the icon");
assert.ok(widget.includes("function guardLeadForms()"), "mobile lead-form guard present");
assert.ok(/guardLeadForms\(\);\s*liftFloatingWidgets\(false\);\s*var lang = pageLang\(\);/.test(widget), "guard and sticky-bar lift run on every page, even without a chat widget ID");
assert.ok(widget.includes("@media (max-width:640px){"), "guard only applies on phones");
assert.ok(widget.includes("html.thei-form-active #scrollToTop"), "guard hides back-to-top over forms");
assert.ok(widget.includes('chat-widget:not([data-active=\\"true\\"])') || widget.includes('chat-widget:not([data-active="true"])'), "guard never hides an open chat window");
assert.ok(widget.includes("IntersectionObserver"), "guard watches lead forms coming into view");
assert.ok(widget.includes('input[name*="phone" i]'), "guard matches home form phone fields by name");
assert.ok(widget.includes('input[name*="email" i]'), "guard matches home form email fields by name");
assert.ok(widget.includes('iframe[src*="leadconnectorhq.com/widget/booking"]'), "guard hides widgets over booking calendars");
assert.ok(widget.includes(".aep-sticky"), "lifts widgets above the AEP sticky Call/WhatsApp bar");
assert.ok(widget.includes(":host-context(html.thei-aep-sticky)"), "lifts the shadow-DOM launcher above the sticky bar");
assert.ok(widget.includes("#lc_text-widget--btn"), "targets the live GHL launcher button");
assert.ok(widget.includes("hola como puedo ayudar"), "hides the live Spanish greeting copy");
assert.ok(widget.includes("como puedo ayudar"), "hides short Spanish greeting variants");
assert.ok(SCRIPT_TAG.includes("?v=overlay3"), "cache-bust for the overlay release");

// "</body>" inside a JS string (e.g. an email template) must not get the tag:
// that split the life-insurance calculator's main script in two.
{
  const page = "<body><script>var t = `<html><body>x</body></html>`; window.ok = 1;</script></body>";
  const out = injectGhlChatWidget(page, "/tmp/out.html");
  assert.ok(out.includes("`<html><body>x</body></html>`"), "leaves </body> inside a JS string alone");
  assert.ok(/<\/script>\n?<\/body>$/.test(out.replace(SCRIPT_TAG, "")), "inserts before the real closing </body>");
  assert.ok(out.lastIndexOf(SCRIPT_TAG) > out.indexOf("window.ok"), "tag goes after the page script");
}

console.log("ghl-chat-widget inject tests passed");
