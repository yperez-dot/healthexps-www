/**
 * Blog listing polish (build-time, runs after hideFutureBlogCards).
 *
 * Source listings keep ISO dates in <span class="card-date">YYYY-MM-DD</span>
 * so apply-blog-post.js and the future-date gate keep working. At build time:
 *   - cards in #blogGrid are sorted newest first (stable for equal dates)
 *   - each date is rendered as <time class="card-date" datetime="YYYY-MM-DD">
 *     with a readable label: "Oct 26, 2026" (EN) / "26 oct 2026" (ES)
 *   - a card with no valid ISO date shows no date (never a guessed one)
 */
const CARD_RE = /<a\b(?=[^>]*\bclass="[^"]*\bblog-card\b)[^>]*>[\s\S]*?<\/a>/gi;
const DATE_RE = /<span\b[^>]*\bclass="[^"]*\bcard-date\b[^"]*"[^>]*>\s*([^<]*?)\s*<\/span>/i;
const EN_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ES_MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function isoOf(card) {
  const m = card.match(DATE_RE);
  if (!m) return null;
  const iso = m[1].trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? iso[0] : null;
}

function formatDate(iso, lang) {
  const [y, mo, d] = iso.split("-").map(Number);
  if (lang === "es") return `${d} ${ES_MON[mo - 1]} ${y}`;
  return `${EN_MON[mo - 1]} ${d}, ${y}`;
}

function renderDate(card, lang) {
  const iso = isoOf(card);
  return card.replace(DATE_RE, () =>
    iso ? `<time class="card-date" datetime="${iso}">${formatDate(iso, lang)}</time>` : ""
  );
}

function formatBlogListing(html, lang = "en") {
  if (typeof html !== "string") return html;
  const cards = [...html.matchAll(CARD_RE)];
  if (!cards.length) return html;
  // Only reorder when the cards form one contiguous run (the #blogGrid list).
  for (let i = 1; i < cards.length; i++) {
    const gap = html.slice(cards[i - 1].index + cards[i - 1][0].length, cards[i].index);
    if (gap.trim()) return html.replace(CARD_RE, (c) => renderDate(c, lang));
  }
  const sorted = cards
    .map((m, i) => ({ html: m[0], iso: isoOf(m[0]) || "", i }))
    .sort((a, b) => (a.iso === b.iso ? a.i - b.i : a.iso < b.iso ? 1 : -1))
    .map((c) => renderDate(c.html, lang));
  const start = cards[0].index;
  const last = cards[cards.length - 1];
  const end = last.index + last[0].length;
  return html.slice(0, start) + sorted.join("\n") + html.slice(end);
}

module.exports = { formatBlogListing, formatDate };
