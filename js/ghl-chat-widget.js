/**
 * GoHighLevel / LeadConnector chat widget loader.
 *
 * Create the widgets in GHL (Sites → Chat Widgets), then paste the
 * widget IDs below. Until both IDs are set, this file is a no-op so
 * production does not show a broken bubble.
 *
 * EN pages load WIDGET_IDS.en; /es/ pages load WIDGET_IDS.es.
 * See the Notion playbook: GHL Conversation AI (website chat).
 */
(function (global) {
  "use strict";

  if (global.__THEI_GHL_CHAT__) return;
  global.__THEI_GHL_CHAT__ = true;

  // Paste IDs from GHL → Sites → Chat Widgets → Get Code → data-widget-id
  var WIDGET_IDS = {
    en: "",
    es: "",
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
    var id = String(WIDGET_IDS[lang] || "").trim();
    if (id) return id;
    return String(WIDGET_IDS.en || "").trim();
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
