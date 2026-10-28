/**
 * Insert a snippet right before the page's real closing </body> tag.
 *
 * Uses the LAST </body>: pages can contain "</body>" inside a JavaScript string
 * (e.g. an HTML email template), and inserting a <script> tag there cuts the
 * page's script in half — the browser then fails to parse the whole block.
 */
"use strict";

function insertBeforeBodyEnd(html, snippet) {
  const matches = [...String(html).matchAll(/<\/body>/gi)];
  if (!matches.length) return html;
  const at = matches[matches.length - 1].index;
  return html.slice(0, at) + snippet + html.slice(at);
}

module.exports = { insertBeforeBodyEnd };
