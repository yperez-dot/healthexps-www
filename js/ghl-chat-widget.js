/**
 * GoHighLevel / LeadConnector chat widget loader.
 *
 * Create the widgets in GHL (Sites → Chat Widgets), then paste the
 * widget IDs below. An empty ID means that language has no bubble.
 *
 * EN pages load WIDGET_IDS.en; /es/ pages load WIDGET_IDS.es.
 * An empty ID means no bubble on that language.
 */
(function (global) {
  "use strict";

  if (global.__THEI_GHL_CHAT__) return;
  global.__THEI_GHL_CHAT__ = true;

  // Paste IDs from GHL → Sites → Chat Widgets → Get Code → data-widget-id
  // EN + ES live chat (not SMS / email chat).
  // If the bubble still opens a name/phone/SMS consent form, that is a GHL
  // widget setting (Chat Window → Enable Contact Form), not this file.
  var WIDGET_IDS = {
    en: "6a90f87f23454f63fe77f574",
    es: "6a90f98e3cbef685c55fc386",
  };

  var LOADER_SRC = "https://widgets.leadconnectorhq.com/loader.js";
  var RESOURCES_URL = "https://widgets.leadconnectorhq.com/chat-widget/loader.js";

  function pageLang() {
    var path = (global.location && global.location.pathname) || "";
    if (/^\/es(\/|$)/i.test(path)) return "es";
    var htmlLang = (document.documentElement && document.documentElement.lang) || "";
    if (/^es/i.test(htmlLang)) return "es";
    return "en";
  }

  function widgetIdFor(lang) {
    return String(WIDGET_IDS[lang] || "").trim();
  }

  function bumpScrollTopButton() {
    if (document.getElementById("thei-ghl-chat-offset")) return;
    var style = document.createElement("style");
    style.id = "thei-ghl-chat-offset";
    style.textContent =
      "#scrollToTop{bottom:96px !important;}@media (max-width:640px){#scrollToTop{bottom:88px !important;}}";
    document.head.appendChild(style);
  }

  function track(eventName, params) {
    if (typeof global.gtag === "function") {
      global.gtag("event", eventName, params || {});
    }
  }

  function loadWidget(widgetId, lang) {
    if (!widgetId) return;

    var script = document.createElement("script");
    script.src = LOADER_SRC;
    script.async = true;
    script.setAttribute("data-resources-url", RESOURCES_URL);
    script.setAttribute("data-widget-id", widgetId);
    document.body.appendChild(script);

    bumpScrollTopButton();
    quietUntilClick();

    global.addEventListener("LC_chatWidgetLoaded", function () {
      track("chat_widget_loaded", { language: lang });
      quietUntilClick();
    });
  }

  /**
   * Show the round launcher only. GHL auto-opens "Hi! How can I help?"
   * (often inside <chat-widget> shadow DOM) and that bubble covers the
   * homepage stats band. Stay quiet until the visitor clicks the icon.
   */
  function quietUntilClick() {
    var QUIET_CSS =
      '[class*="Proactive"],[class*="proactive"],' +
      '[class*="message-preview"],[class*="MessagePreview"],' +
      '[class*="greeting"],[class*="Greeting"],' +
      '[data-testid*="proactive"],[class*="widget-preview"],' +
      '[class*="auto-message"],[class*="AutoMessage"]{display:none !important;}';

    if (!document.getElementById("thei-ghl-chat-quiet")) {
      var style = document.createElement("style");
      style.id = "thei-ghl-chat-quiet";
      style.textContent =
        '[class*="lc_text-widget"] [class*="Proactive"],' +
        '[class*="lc_text-widget"] [class*="proactive"],' +
        '[class*="lc_text-widget"] [class*="message-preview"],' +
        '[class*="lc_text-widget"] [class*="MessagePreview"],' +
        '[class*="chat-widget"] [class*="greeting"],' +
        '[class*="chat-widget"] [class*="Greeting"],' +
        '[data-testid*="proactive"],' +
        '[class*="widget-preview"]{display:none !important;}';
      document.head.appendChild(style);
    }

    function greetingPhrases() {
      return [
        "Hi! How can I help?",
        "How can I help?",
        "¡Hola! ¿En qué puedo ayudarte?",
        "¿En qué puedo ayudarte?",
      ];
    }

    function hideGreetingCopy(root) {
      if (global.__THEI_CHAT_USER_OPEN) return;
      if (!root || !root.querySelectorAll) return;
      var phrases = greetingPhrases();
      var nodes = root.querySelectorAll("div, span, p, button");
      for (var i = 0; i < nodes.length; i++) {
        var text = (nodes[i].textContent || "").replace(/\s+/g, " ").trim();
        if (phrases.indexOf(text) === -1) continue;
        var box = nodes[i].closest("div") || nodes[i];
        if (box && !box.querySelector("iframe")) {
          box.style.setProperty("display", "none", "important");
        }
      }
    }

    function clickCloseIn(root) {
      if (global.__THEI_CHAT_USER_OPEN) return;
      if (!root || !root.querySelectorAll) return;
      var buttons = root.querySelectorAll("button");
      for (var i = 0; i < buttons.length; i++) {
        var label = (buttons[i].getAttribute("aria-label") || "").toLowerCase();
        if (
          /close chat|minimize chat|cerrar chat|minimizar/.test(label) ||
          (/close|minimize|cerrar/.test(label) && /chat|widget/.test(label))
        ) {
          try { buttons[i].click(); } catch (err) {}
        }
      }
    }

    function injectShadowQuiet(shadow) {
      if (!shadow || shadow.getElementById("thei-ghl-chat-quiet-shadow")) return;
      var style = document.createElement("style");
      style.id = "thei-ghl-chat-quiet-shadow";
      style.textContent = QUIET_CSS;
      try { shadow.appendChild(style); } catch (err) {}
    }

    function walkShadows(node) {
      if (!node) return;
      var shadow = node.shadowRoot;
      if (shadow) {
        injectShadowQuiet(shadow);
        hideGreetingCopy(shadow);
        clickCloseIn(shadow);
        var nested = shadow.querySelectorAll("*");
        for (var i = 0; i < nested.length; i++) {
          if (nested[i].shadowRoot) walkShadows(nested[i]);
        }
      }
    }

    function sweep() {
      if (global.__THEI_CHAT_USER_OPEN) return;
      hideGreetingCopy(document);
      clickCloseIn(document);
      var hosts = document.querySelectorAll("chat-widget, [id*='chat-widget'], [class*='lc_text-widget'], [class*='chat-widget']");
      for (var i = 0; i < hosts.length; i++) walkShadows(hosts[i]);
    }

    if (document.body && !document.body.getAttribute("data-thei-ghl-quiet")) {
      document.body.setAttribute("data-thei-ghl-quiet", "1");
      document.addEventListener(
        "click",
        function (event) {
          var t = event.target;
          if (!t || !t.closest) return;
          if (t.closest("chat-widget, [id*='chat-widget'], [class*='lc_text-widget'], [class*='chat-widget']")) {
            global.__THEI_CHAT_USER_OPEN = true;
          }
        },
        true
      );
      var obs = new MutationObserver(function () { sweep(); });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(sweep, 400);
      setTimeout(sweep, 1200);
      setTimeout(sweep, 3000);
      setTimeout(sweep, 6000);
    }

    sweep();
  }

  function init() {
    var lang = pageLang();
    var widgetId = widgetIdFor(lang);
    if (!widgetId) return;
    loadWidget(widgetId, lang);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
