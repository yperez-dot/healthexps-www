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

  /**
   * Keep #scrollToTop above the chat launcher, and lift both above the AEP
   * sticky Call/WhatsApp bar so they no longer cover those CTAs.
   */
  function liftFloatingWidgets(hasChat) {
    var root = document.documentElement;
    if (document.querySelector(".aep-sticky")) root.classList.add("thei-aep-sticky");
    if (hasChat) root.classList.add("thei-has-chat");

    var style = document.getElementById("thei-ghl-chat-offset");
    if (!style) {
      style = document.createElement("style");
      style.id = "thei-ghl-chat-offset";
      document.head.appendChild(style);
    }
    style.textContent =
      "html.thei-has-chat #scrollToTop{bottom:96px !important;}" +
      "@media (max-width:640px){html.thei-has-chat #scrollToTop{bottom:88px !important;}}" +
      /* Two-row AEP bar is ~116px on 390px; sit the launcher fully above it. */
      "html.thei-aep-sticky chat-widget{bottom:120px !important;}" +
      "html.thei-aep-sticky #scrollToTop{bottom:184px !important;}" +
      "@media (max-width:640px){" +
      "html.thei-aep-sticky chat-widget{bottom:124px !important;}" +
      "html.thei-aep-sticky #scrollToTop{bottom:132px !important;}" +
      "html.thei-aep-sticky.thei-has-chat #scrollToTop{bottom:192px !important;}" +
      "}";
  }

  /**
   * Phones only (max-width 640px): the floating back-to-top and chat buttons
   * sit on top of the right edge of lead-form fields. While a lead form (a
   * form with a phone or email field) is on screen, or a page form field has
   * focus, fade both buttons out. They come back as soon as the form scrolls
   * away. Desktop and tablet are unchanged. An open chat window is never hidden.
   */
  function guardLeadForms() {
    if (document.getElementById("thei-form-guard-css")) return;
    var style = document.createElement("style");
    style.id = "thei-form-guard-css";
    style.textContent =
      "@media (max-width:640px){" +
      "html.thei-form-active #scrollToTop," +
      'html.thei-form-active chat-widget:not([data-active="true"])' +
      "{opacity:0 !important;visibility:hidden !important;pointer-events:none !important;}}";
    document.head.appendChild(style);

    var root = document.documentElement;
    var visible = [];
    var focused = false;
    function update() {
      root.classList.toggle("thei-form-active", focused || visible.length > 0);
    }
    function isPageField(el) {
      return !!(el && el.matches && el.matches("input, select, textarea") &&
        !(el.closest && el.closest("chat-widget")));
    }
    // Home EN/ES #v4LeadForm uses type=text for phone/email. Also match by name.
    var LEAD_FIELDS = 'input[type="tel"], input[type="email"], input[name*="phone" i], input[name*="email" i]';
    var BOOKING_IFRAME = 'iframe[src*="leadconnectorhq.com/widget/booking"]';

    var forms = document.querySelectorAll("form");
    if ("IntersectionObserver" in global) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var idx = visible.indexOf(entries[i].target);
          if (entries[i].isIntersecting && idx === -1) visible.push(entries[i].target);
          if (!entries[i].isIntersecting && idx !== -1) visible.splice(idx, 1);
        }
        update();
      });
      for (var i = 0; i < forms.length; i++) {
        if (forms[i].querySelector(LEAD_FIELDS)) io.observe(forms[i]);
      }
      var bookings = document.querySelectorAll(BOOKING_IFRAME);
      for (var j = 0; j < bookings.length; j++) io.observe(bookings[j]);
    }

    document.addEventListener("focusin", function (event) {
      if (isPageField(event.target)) { focused = true; update(); }
    });
    document.addEventListener("focusout", function () {
      setTimeout(function () { focused = isPageField(document.activeElement); update(); }, 0);
    });
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

    liftFloatingWidgets(true);
    quietUntilClick();

    global.addEventListener("LC_chatWidgetLoaded", function () {
      // Widget ready is not a conversion and must not fire a GA4 event.
      // chat_widget_opened fires only after a real visitor click.
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
      '[class*="auto-message"],[class*="AutoMessage"]{display:none !important;}' +
      /* Launcher is position:fixed inside the closed shadow tree, so host
         bottom: rules never move it. :host-context sees the page classes. */
      ':host-context(html.thei-aep-sticky) #lc_text-widget--btn,' +
      ':host-context(html.thei-aep-sticky) .lc_text-widget--bubble{bottom:124px !important;}';

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
        "hi how can i help",
        "how can i help",
        "hola en que puedo ayudarte",
        "en que puedo ayudarte",
        "hola como puedo ayudar",
        "como puedo ayudar",
      ];
    }

    function normalizePhrase(s) {
      return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[¿?¡!.,;:'"«»]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function hideGreetingCopy(root) {
      if (global.__THEI_CHAT_USER_OPEN) return;
      if (!root || !root.querySelectorAll) return;
      var phrases = greetingPhrases();
      var nodes = root.querySelectorAll("div, span, p, button");
      for (var i = 0; i < nodes.length; i++) {
        var text = normalizePhrase(nodes[i].textContent);
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
            if (!global.__THEI_CHAT_USER_OPEN) {
              track("chat_widget_opened", { language: pageLang() });
            }
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
    guardLeadForms();
    liftFloatingWidgets(false);
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
