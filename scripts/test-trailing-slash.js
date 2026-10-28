const assert = require("assert");
const path = require("path");
const { makeResolver, normalizeHtml, normalizeSitemap, loadRedirects } = require("./trailing-slash");

const pages = new Set(["/book", "/private-health-insurance-miami", "/es/seguro-medico-privado-miami",
  "/medicare-annual-enrollment-2027", "/es/inscripcion-anual-medicare-2027", "/es", "/faq", "/enrollment-calculator",
  "/medicare-enrollment-calculator", "/blog/medicare-enrollment-periods-explained"]);
const redirects = new Map([
  ["/private-insurance", "/private-health-insurance-miami/"],
  ["/enrollment-calculator", "/medicare-enrollment-calculator/"],
  ["/old-a", "/old-b"], ["/old-b", "/faq"],
  ["/blog/mastering-medicare-essential-tips-to-avoid-common-enrollment-mistakes", "/blog/medicare-enrollment-periods-explained/"],
]);
const resolve = makeResolver((p) => pages.has(p), redirects);

const html = [
  '<a href="/book">Book</a>',
  '<a href="/private-health-insurance-miami#form">EN</a>',
  '<a href="/es/seguro-medico-privado-miami?x=1">ES</a>',
  '<a href="/medicare-annual-enrollment-2027/">ok</a>',
  '<a href="/es">ES home</a>',
  '<link rel="canonical" href="https://www.healthexps.com/private-health-insurance-miami">',
  '<link rel="alternate" hreflang="es" href="https://healthexps.com/es/inscripcion-anual-medicare-2027"/>',
  '<meta property="og:url" content="https://www.healthexps.com/es/seguro-medico-privado-miami">',
  '{"item": "https://www.healthexps.com/faq", "@id": "https://www.healthexps.com/#org", "url": "https://www.healthexps.com/private-health-insurance-miami"}',
  '<a href="/private-insurance">legacy</a><a href="/enrollment-calculator">calc</a><a href="/old-a">chain</a>',
  '<a href="/css/site.css">css</a><img src="/images/a.png"><a href="/.netlify/functions/submit-lead">fn</a>',
  '<a href="/not-a-page">x</a><a href="https://example.com/book">ext</a><a href="tel:18003806821">tel</a>',
  '<script>window.location = "/book";</script>',
].join("\n");
const { html: out, changed } = normalizeHtml(html, resolve);
assert(out.includes('href="/book/"'));
assert(out.includes('href="/private-health-insurance-miami/#form"'));
assert(out.includes('href="/es/seguro-medico-privado-miami/?x=1"'));
assert(out.includes('href="/medicare-annual-enrollment-2027/"'));
assert(out.includes('href="/es/"'));
assert(out.includes('rel="canonical" href="https://www.healthexps.com/private-health-insurance-miami/"'));
assert(out.includes('href="https://www.healthexps.com/es/inscripcion-anual-medicare-2027/"'), "apex -> www + slash");
assert(out.includes('content="https://www.healthexps.com/es/seguro-medico-privado-miami/"'));
assert(out.includes('"item": "https://www.healthexps.com/faq/"'));
assert(out.includes('"@id": "https://www.healthexps.com/#org"'));
assert(out.includes('"url": "https://www.healthexps.com/private-health-insurance-miami/"'));
assert(out.includes('href="/private-health-insurance-miami/">legacy'), "redirect source -> final target");
assert(out.includes('href="/medicare-enrollment-calculator/">calc'), "forced redirect wins over shadowed page");
assert(out.includes('href="/faq/">chain'), "redirect chain collapsed");
assert(out.includes('href="/css/site.css"') && out.includes('src="/images/a.png"'));
assert(out.includes('href="/.netlify/functions/submit-lead"'));
assert(out.includes('href="/not-a-page"'), "unknown paths untouched");
assert(out.includes('href="https://example.com/book"') && out.includes('href="tel:18003806821"'));
assert(out.includes('window.location = "/book";'), "inline JS untouched");
assert.strictEqual(changed, 12);
assert.strictEqual(normalizeHtml(out, resolve).changed, 0, "idempotent");

const xml = `<urlset>
<url><loc>https://www.healthexps.com/private-health-insurance-miami</loc>
  <xhtml:link rel="alternate" hreflang="es" href="https://www.healthexps.com/es/seguro-medico-privado-miami"/></url>
<url><loc>https://www.healthexps.com/faq</loc></url>
<url><loc>https://www.healthexps.com/faq</loc></url>
<url><loc>https://www.healthexps.com/blog/mastering-medicare-essential-tips-to-avoid-common-enrollment-mistakes</loc></url>
<url><loc>https://www.healthexps.com/</loc></url>
</urlset>`;
const sm = normalizeSitemap(xml, resolve);
assert(sm.xml.includes("<loc>https://www.healthexps.com/private-health-insurance-miami/</loc>"));
assert(sm.xml.includes('href="https://www.healthexps.com/es/seguro-medico-privado-miami/"'));
assert.strictEqual((sm.xml.match(/<loc>https:\/\/www\.healthexps\.com\/faq\/<\/loc>/g) || []).length, 1, "duplicate loc removed");
assert(!sm.xml.includes("mastering-medicare-essential-tips-to-avoid"), "redirected loc dropped");
assert(sm.xml.includes("<loc>https://www.healthexps.com/</loc>"));
assert.strictEqual(sm.dropped.length, 2);

const live = loadRedirects(path.resolve(__dirname, ".."));
function follow(start) {
  const seen = [];
  let cur = start;
  for (let i = 0; i < 8; i++) {
    const key = cur.length > 1 ? cur.replace(/\/+$/, "") : cur;
    if (seen.includes(key)) throw new Error("redirect loop: " + seen.concat(key).join(" -> "));
    if (!live.has(key)) return { hops: seen.length, final: cur };
    seen.push(key);
    const next = live.get(key);
    const nextKey = next.length > 1 ? next.replace(/\/+$/, "") : next;
    if (nextKey === key) return { hops: seen.length, final: next };
    cur = next;
  }
  throw new Error("redirect chain too long from " + start);
}
let twoHop = 0;
for (const from of live.keys()) {
  const r = follow(from);
  if (r.hops > 1) twoHop++;
}
assert.strictEqual(twoHop, 0, "redirect targets should not themselves redirect");
assert.ok(live.has("/blog/free-health-insurance-consultation-miami"));

console.log("test-trailing-slash: ok");
