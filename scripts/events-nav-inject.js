/**
 * Add the English Events destination in Resources menus.
 * Shared chrome already includes the link; this transform covers leftover
 * legacy HTML that still has the older Resources list without Events.
 */
"use strict";

const EN_LINK = '<a href="/events/">Events &amp; Workshops</a>';
const EN_MOBILE_LINK = '<a href="/events/">Events &amp; Workshops</a>';

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
  if (content.includes('href="/events/"')) return content;

  const afterArticles = addAfterMatchingLink(
    content,
    "/medicare-articles",
    "Medicare Articles",
    EN_LINK,
    EN_MOBILE_LINK
  );
  if (afterArticles !== content) return afterArticles;

  return addAfterMatchingLink(
    content,
    "/resources",
    "All Resources",
    EN_LINK,
    EN_MOBILE_LINK
  );
}

module.exports = { injectEventsNav, EN_LINK, EN_MOBILE_LINK };
