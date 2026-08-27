/**
 * Blog publish-date helpers.
 *
 * Scheduled posts live in the repo (markdown + listing cards) before they
 * should appear on the /blog/ listing. Compare against the America/New_York
 * calendar date so a build on publish day (Wed 9 AM ET) includes that card,
 * and a build the day before does not. The article URLs themselves still
 * build (HTTP 200, noindex) so uptime checks do not treat them as outages.
 */

function todayYmdET(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function publishYmd(date) {
  if (date == null || date === "") return null;
  if (typeof date === "string") {
    const trimmed = date.trim();
    const calendar = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (calendar) return calendar[1];
  }
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function isFuturePublishDate(date, now = new Date()) {
  const ymd = publishYmd(date);
  if (!ymd) return false;
  return ymd > todayYmdET(now);
}

function isBlogListingOutput(outputPath) {
  if (!outputPath) return false;
  const normalized = String(outputPath).replace(/\\/g, "/");
  return normalized.endsWith("/blog/index.html");
}

function stripFutureBlogCards(html, now = new Date()) {
  if (typeof html !== "string") return html;
  const today = todayYmdET(now);
  return html.replace(
    /<a\b(?=[^>]*\bclass="[^"]*\bblog-card\b)[^>]*>[\s\S]*?<\/a>/gi,
    (card) => {
      const dateMatch = card.match(
        /<span\b[^>]*\bclass="[^"]*\bcard-date\b[^"]*"[^>]*>\s*([^<]+?)\s*</i
      );
      if (!dateMatch) return card;
      const ymd = publishYmd(dateMatch[1]);
      if (ymd && ymd > today) return "";
      return card;
    }
  );
}

module.exports = {
  todayYmdET,
  publishYmd,
  isFuturePublishDate,
  isBlogListingOutput,
  stripFutureBlogCards,
};
