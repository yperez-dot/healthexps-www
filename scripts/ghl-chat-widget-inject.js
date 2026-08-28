/**
 * Inject the GHL chat-widget loader before </body> on HTML pages.
 * Used by the Eleventy transform so static HTML (htmlTemplateEngine: false)
 * still gets the bubble without editing every file.
 */
"use strict";

const SCRIPT_MARK = "js/ghl-chat-widget.js";
const SCRIPT_TAG = '<script src="/js/ghl-chat-widget.js" defer></script>\n';

function injectGhlChatWidget(content, outputPath) {
  if (!outputPath || !/\.html$/i.test(String(outputPath))) return content;
  if (typeof content !== "string") return content;
  if (content.includes(SCRIPT_MARK)) return content;
  if (!/<\/body>/i.test(content)) return content;
  return content.replace(/<\/body>/i, SCRIPT_TAG + "</body>");
}

module.exports = { injectGhlChatWidget, SCRIPT_TAG, SCRIPT_MARK };
