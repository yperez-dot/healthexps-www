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
assert.ok(/guardLeadForms\(\);\s*var lang = pageLang\(\);/.test(widget), "guard runs on every page, even without a chat widget ID");
assert.ok(widget.includes("@media (max-width:640px){"), "guard only applies on phones");
assert.ok(widget.includes("html.thei-form-active #scrollToTop"), "guard hides back-to-top over forms");
assert.ok(widget.includes('chat-widget:not([data-active=\\"true\\"])') || widget.includes('chat-widget:not([data-active="true"])'), "guard never hides an open chat window");
assert.ok(widget.includes("IntersectionObserver"), "guard watches lead forms coming into view");
assert.ok(SCRIPT_TAG.includes("?v=formguard1"), "cache-bust for the guard release");

console.log("ghl-chat-widget inject tests passed");
