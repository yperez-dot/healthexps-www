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
  var WIDGET_IDS = {
    en: "6a90f3c823454f63fe7755a4",
    es: "6a90f64d23454f63fe77ac3a",
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

    global.addEventListener("LC_chatWidgetLoaded", function () {
      track("chat_widget_loaded", { language: lang });
    });
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
