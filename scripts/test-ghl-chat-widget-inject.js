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

console.log("ghl-chat-widget inject tests passed");
