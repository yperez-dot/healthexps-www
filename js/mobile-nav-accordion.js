/**
 * Collapsible sections for the v4 mobile nav (and the older blog slide-out).
 * Insurance / Guides / More start collapsed so the menu fits on one screen.
 */
(function () {
  "use strict";

  if (window.__V4_NAV_ACCORDION__) return;
  window.__V4_NAV_ACCORDION__ = true;

  var SECTION_HEADINGS = {
    insurance: true,
    guides: true,
    seguros: true,
    guias: true,
    "guías": true
  };

  function injectStyles() {
    if (document.getElementById("v4-acc-styles")) return;
    var css =
      ".v4-acc-btn{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:0;border-bottom:1px solid #ece5f0;padding:16px 4px;margin:0;font:inherit;font-size:16px;font-weight:700;color:#5c3d7a;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;text-align:left;min-height:48px;}" +
      ".v4-acc-btn:hover{color:#ff1090;}" +
      ".v4-acc-btn:focus-visible{outline:3px solid #ff1090;outline-offset:3px;border-radius:6px;}" +
      ".v4-acc-chevron{width:10px;height:10px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .2s ease;margin-right:8px;flex-shrink:0;}" +
      ".v4-acc-btn.is-open .v4-acc-chevron{transform:rotate(-135deg);margin-top:6px;}" +
      ".v4-acc-panel{display:flex;flex-direction:column;gap:4px;padding:4px 0 10px;}" +
      ".v4-acc-panel[hidden]{display:none!important;}" +
      "@media (prefers-reduced-motion:reduce){.v4-acc-chevron{transition:none;}}" +
      "@media (max-width:768px){" +
        "#nav-links .has-dropdown > .dropdown{display:none!important;position:static!important;box-shadow:none!important;border:none!important;min-width:0!important;padding:0 0 8px 12px!important;}" +
        "#nav-links .has-dropdown.is-open > .dropdown{display:block!important;}" +
      "}";
    var style = document.createElement("style");
    style.id = "v4-acc-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function normalize(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function stripIndexAndHtml(path) {
    path = String(path || "").replace(/\/+$/, "");
    path = path.replace(/\/index\.html$/i, "");
    path = path.replace(/\/index$/i, "");
    path = path.replace(/\.html$/i, "");
    return path || "/";
  }

  function normalizePath(href) {
    if (!href || href.charAt(0) === "#") return "";
    try {
      return stripIndexAndHtml(new URL(href, location.origin).pathname);
    } catch (err) {
      return stripIndexAndHtml(href);
    }
  }

  function currentPath() {
    return stripIndexAndHtml(location.pathname);
  }

  function isSpanish() {
    var lang = (document.documentElement.lang || "").toLowerCase();
    return lang.indexOf("es") === 0 || location.pathname.indexOf("/es/") === 0 || location.pathname === "/es";
  }

  function isSectionHeading(el) {
    if (!el || el.tagName !== "DIV") return false;
    if (el.querySelector("a,button")) return false;
    return !!SECTION_HEADINGS[normalize(el.textContent)];
  }

  function isOtherGroup(el) {
    if (!el || el.tagName !== "DIV") return false;
    if (el.classList.contains("v4-acc-panel")) return false;
    var style = el.getAttribute("style") || "";
    if (style.indexOf("border-top") === -1) return false;
    return !!(
      el.querySelector('a[href*="faq"]') ||
      el.querySelector('a[href*="contact"]') ||
      el.querySelector('a[href*="contacto"]') ||
      el.querySelector('a[href*="blog"]') ||
      el.querySelector('a[href*="resources"]') ||
      el.querySelector('a[href*="recursos"]')
    );
  }

  function isCtaGroup(el) {
    if (!el || el.tagName !== "DIV") return false;
    return !!el.querySelector('a[href^="tel:"]');
  }

  function panelContainsCurrentPage(links) {
    var here = currentPath();
    for (var i = 0; i < links.length; i++) {
      var path = normalizePath(links[i].getAttribute("href"));
      if (path && path === here) return true;
    }
    return false;
  }

  function wrapAccordion(heading, items) {
    if (!heading || !heading.parentNode) return;
    var label = heading.textContent.replace(/\s+/g, " ").trim();
    var slug = normalize(label).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
    var panelId = "v4-acc-" + slug;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "v4-acc-btn";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", panelId);
    btn.innerHTML =
      "<span>" +
      label +
      '</span><span class="v4-acc-chevron" aria-hidden="true"></span>';

    var panel = document.createElement("div");
    panel.id = panelId;
    panel.className = "v4-acc-panel";
    panel.hidden = true;
    items.forEach(function (item) {
      panel.appendChild(item);
    });

    heading.parentNode.insertBefore(btn, heading);
    heading.parentNode.insertBefore(panel, heading);
    heading.parentNode.removeChild(heading);

    function setOpen(open) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.classList.toggle("is-open", open);
      panel.hidden = !open;
    }

    if (panelContainsCurrentPage(items)) setOpen(true);

    btn.addEventListener("click", function () {
      setOpen(btn.getAttribute("aria-expanded") !== "true");
    });
  }

  function wrapOtherGroup(el) {
    var links = Array.prototype.filter.call(el.children, function (n) {
      return n.tagName === "A";
    });
    if (!links.length) return;
    el.innerHTML = "";
    var heading = document.createElement("div");
    heading.textContent = isSpanish() ? "Más" : "More";
    el.appendChild(heading);
    wrapAccordion(heading, links);
  }

  function enhanceV4Nav(nav) {
    if (!nav || nav.getAttribute("data-v4-acc") === "1") return;
    nav.setAttribute("data-v4-acc", "1");

    var children = Array.prototype.slice.call(nav.children);
    var i = 0;
    while (i < children.length) {
      var el = children[i];
      if (isSectionHeading(el)) {
        var items = [];
        var j = i + 1;
        while (j < children.length) {
          var next = children[j];
          if (isSectionHeading(next) || isOtherGroup(next) || isCtaGroup(next)) break;
          if (next.tagName === "A") items.push(next);
          j += 1;
        }
        wrapAccordion(el, items);
        i = j;
        continue;
      }
      if (isOtherGroup(el)) wrapOtherGroup(el);
      i += 1;
    }
  }

  function enhanceOldBlogNav() {
    var nav = document.getElementById("nav-links");
    if (!nav || nav.getAttribute("data-v4-acc") === "1") return;
    nav.setAttribute("data-v4-acc", "1");

    var drops = nav.querySelectorAll(".has-dropdown");
    Array.prototype.forEach.call(drops, function (li) {
      var trigger = Array.prototype.filter.call(li.children, function (n) {
        return n.tagName === "A";
      })[0];
      var menu = li.querySelector(".dropdown");
      if (!trigger || !menu) return;
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", function (e) {
        if (window.innerWidth > 768) return;
        e.preventDefault();
        var open = !li.classList.contains("is-open");
        Array.prototype.forEach.call(drops, function (other) {
          other.classList.remove("is-open");
          var otherTrigger = Array.prototype.filter.call(other.children, function (n) {
            return n.tagName === "A";
          })[0];
          if (otherTrigger) otherTrigger.setAttribute("aria-expanded", "false");
        });
        if (open) {
          li.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  function init() {
    injectStyles();
    var menus = document.querySelectorAll("#v4-mobile-menu nav");
    Array.prototype.forEach.call(menus, enhanceV4Nav);
    enhanceOldBlogNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
