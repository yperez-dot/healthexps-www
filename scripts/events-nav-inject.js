/**
 * Add the bilingual Events destination immediately after AEP in Guides menus.
 * Most site pages are legacy static HTML, so an Eleventy transform keeps the
 * shared navigation current without mass-editing every page.
 */
"use strict";

const EN_LINK = '<a href="/events/" style="padding:10px 14px;border-radius:8px;cursor:pointer;font-weight:600;white-space:nowrap">Events &amp; Workshops</a>';
const EN_MOBILE_LINK = '<a href="/events/" style="padding:11px 12px;border-radius:8px;color:#241a30;font-weight:600;font-size:18px">Events &amp; Workshops</a>';
const ES_LINK = '<a href="/es/eventos/" style="padding:10px 14px;border-radius:8px;cursor:pointer;font-weight:600;white-space:nowrap">Eventos y Talleres</a>';
const ES_MOBILE_LINK = '<a href="/es/eventos/" style="padding:11px 12px;border-radius:8px;color:#241a30;font-weight:600;font-size:18px">Eventos y Talleres</a>';

function addAfterMatchingLink(content, href, labelPattern, desktopLink, mobileLink) {
  let count = 0;
  const pattern = new RegExp(
    `(<a\\b[^>]*href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?["'][^>]*>\\s*${labelPattern}\\s*</a>)`,
    "gi"
  );

  return content.replace(pattern, (match) => {
    const addition = count++ === 0 ? desktopLink : mobileLink;
    return `${match}\n                  ${addition}`;
  });
}

function injectEventsNav(content, outputPath) {
  if (!outputPath || !/\.html$/i.test(String(outputPath))) return content;
  if (typeof content !== "string") return content;

  let updated = content;
  if (!updated.includes('href="/events/"')) {
    updated = addAfterMatchingLink(
      updated,
      "/medicare-annual-enrollment-2027",
      "Annual Enrollment \\(AEP\\)",
      EN_LINK,
      EN_MOBILE_LINK
    );
  }
  if (!updated.includes('href="/es/eventos/"')) {
    updated = addAfterMatchingLink(
      updated,
      "/es/inscripcion-anual-medicare-2027",
      "Inscripci[oó]n Anual \\(AEP\\)",
      ES_LINK,
      ES_MOBILE_LINK
    );
  }
  return updated;
}

module.exports = { injectEventsNav, EN_LINK, EN_MOBILE_LINK, ES_LINK, ES_MOBILE_LINK };
