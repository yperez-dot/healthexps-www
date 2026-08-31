/**
 * Inject the mobile-nav accordion loader before </body> on HTML pages.
 * Used by the Eleventy transform so static HTML still gets the script.
 */
"use strict";

const SCRIPT_MARK = "js/mobile-nav-accordion.js";
const SCRIPT_TAG = '<script src="/js/mobile-nav-accordion.js?v=1" defer></script>\n';

function injectMobileNavAccordion(content, outputPath) {
  if (!outputPath || !/\.html$/i.test(String(outputPath))) return content;
  if (typeof content !== "string") return content;
  if (content.includes(SCRIPT_MARK)) return content;
  if (!/<\/body>/i.test(content)) return content;
  return content.replace(/<\/body>/i, SCRIPT_TAG + "</body>");
}

module.exports = { injectMobileNavAccordion, SCRIPT_TAG, SCRIPT_MARK };
