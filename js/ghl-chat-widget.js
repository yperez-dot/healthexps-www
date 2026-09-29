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
   * and that bubble covers the homepage stats band.
   */
  function quietUntilClick() {
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

    function hideGreetingCopy(root) {
      var phrases = [
        "Hi! How can I help?",
        "How can I help?",
        "¡Hola! ¿En qué puedo ayudarte?",
        "¿En qué puedo ayudarte?",
      ];
      var nodes = (root || document).querySelectorAll("div, span, p");
      for (var i = 0; i < nodes.length; i++) {
        var text = (nodes[i].textContent || "").replace(/\s+/g, " ").trim();
        if (phrases.indexOf(text) === -1) continue;
        var box = nodes[i].closest("div");
        if (box && !box.querySelector("iframe") && box.offsetWidth < 420) {
          box.style.display = "none";
        }
      }
    }

    function clickClose() {
      var roots = document.querySelectorAll(
        '[id*="chat-widget"], [class*="lc_text-widget"], [class*="chat-widget"]'
      );
      for (var r = 0; r < roots.length; r++) {
        var buttons = roots[r].querySelectorAll("button");
        for (var i = 0; i < buttons.length; i++) {
          var label = (buttons[i].getAttribute("aria-label") || "").toLowerCase();
          if (/close chat|minimize chat|cerrar chat|minimizar/.test(label) || (/close|minimize|cerrar/.test(label) && /chat|widget/.test(label))) {
            try { buttons[i].click(); } catch (err) {}
          }
        }
      }
    }

    hideGreetingCopy();
    clickClose();
    if (document.body && !document.body.getAttribute("data-thei-ghl-quiet")) {
      document.body.setAttribute("data-thei-ghl-quiet", "1");
      var obs = new MutationObserver(function () {
        hideGreetingCopy();
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { hideGreetingCopy(); clickClose(); }, 800);
      setTimeout(function () { hideGreetingCopy(); clickClose(); }, 2500);
    }
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
