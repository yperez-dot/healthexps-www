#!/usr/bin/env node
"use strict";
/**
 * chat_widget_loaded used to fire when GHL dispatched LC_chatWidgetLoaded
 * (~10s after page load). That is not a conversion. Only a real click
 * on the launcher should send a chat event.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const src = fs.readFileSync(path.join(__dirname, "../js/ghl-chat-widget.js"), "utf8");

const events = [];
const html = '<!doctype html><html lang="en"><body><chat-widget></chat-widget></body></html>';
const dom = new JSDOM(html, {
  url: "https://www.healthexps.com/contact/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const win = dom.window;
win.gtag = function () { events.push(Array.from(arguments)); };
win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
win.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {}, removeEventListener() {} });

win.eval(src);
if (win.document.readyState === "loading") {
  win.document.dispatchEvent(new win.Event("DOMContentLoaded", { bubbles: true }));
}

win.dispatchEvent(new win.Event("LC_chatWidgetLoaded"));
assert.strictEqual(
  events.filter((e) => e[1] === "chat_widget_loaded").length,
  0,
  "LC_chatWidgetLoaded must not send chat_widget_loaded"
);
assert.strictEqual(
  events.filter((e) => e[1] === "chat_widget_opened").length,
  0,
  "widget load is not a chat interaction"
);

const host = win.document.querySelector("chat-widget");
assert.ok(host, "chat-widget host exists");
assert.strictEqual(win.document.body.getAttribute("data-thei-ghl-quiet"), "1", "quiet/click listener installed");
host.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
const opened = events.filter((e) => e[0] === "event" && e[1] === "chat_widget_opened");
assert.strictEqual(opened.length, 1, "first click on the widget fires chat_widget_opened once; events=" + JSON.stringify(events) + " user=" + win.__THEI_CHAT_USER_OPEN);
assert.strictEqual(opened[0][2].language, "en");

win.document.querySelector("chat-widget").dispatchEvent(
  new win.MouseEvent("click", { bubbles: true })
);
assert.strictEqual(
  events.filter((e) => e[1] === "chat_widget_opened").length,
  1,
  "repeat clicks do not double-count"
);

dom.window.close();
console.log("ghl chat widget track tests passed");
console.log("  load: no chat events; click: chat_widget_opened x1");
