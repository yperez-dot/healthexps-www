const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { injectSharedChrome } = require("./shared-chrome");

const old = '<html><head></head><body><div class="v4-nav-outer"><a>Old</a></div><div id="v4-mobile-menu"><div>Old mobile</div></div><main>Body</main><div id="site-footer"><div>Old footer</div></div></body></html>';
const en = injectSharedChrome(old, "/tmp/_site/medicare-plans-miami/index.html");
assert(en.includes("Medicare Articles"));
assert(en.includes("All Resources"));
assert(en.includes("Events &amp; Workshops"));
assert(!en.includes('Annual Enrollment (AEP)</a><a href="/events/">'));
assert(en.includes('<a href="/medicare-articles/">Medicare Articles</a><a href="/events/">Events &amp; Workshops</a>'));
assert(en.includes('class="shared-nav__panel"'));
assert(!en.includes("Medicare Advantage</a><a"));
assert(!en.includes("Medicare Supplement</a><a"));
assert(!en.includes("Old mobile"));
assert(en.includes("shared-chrome.css"));
assert(en.includes("/css/shared-footer.css"));
assert(en.includes("media=\"print\" onload=\"this.media='all'\""));
assert(en.includes("/css/fonts.css"));
assert(en.includes('href="/fonts/poppins-latin-700.woff2"'));
assert(en.includes('href="/fonts/inter-latin-400.woff2"'));
assert(en.includes('href="/book"'));
const es = injectSharedChrome(old, "/tmp/_site/es/planes-de-medicare-miami/index.html");
const homeHtml = '<html><head></head><body><div id="aep-message">Banner</div><div class="v4-nav-outer"><a href="/resources">Resources</a></div><div id="v4-mobile-menu"><a href="/resources">Resources</a></div><div id="site-footer"></div></body></html>';
for (const homePath of ["/_site/index.html", "_site/index.html", "./_site/index.html", "/workspace/_site/index.html", "index.html", "./index.html"]) {
  const home = injectSharedChrome(homeHtml, homePath);
  assert(home.includes('id="aep-message"'), `homepage keeps AEP banner for ${homePath}`);
  assert(!home.includes("shared-topbar"), `homepage does not rewrite AEP top bar for ${homePath}`);
  assert(home.includes("Events &amp; Workshops"), `homepage still gets shared Resources Events for ${homePath}`);
  assert(home.includes('<details><summary>Resources</summary>'), `homepage mobile Resources accordion for ${homePath}`);
  assert(home.includes('class="shared-nav__panel"'), `homepage desktop vertical panels for ${homePath}`);
  assert(!home.includes('<a href="/resources">Resources</a>'), `homepage stale flat Resources link replaced for ${homePath}`);
}
const esHome = injectSharedChrome(homeHtml, "_site/es/index.html");
assert(esHome.includes('id="aep-message"'), "ES homepage keeps AEP banner");
assert(!esHome.includes("shared-topbar"), "ES homepage does not rewrite AEP top bar");
assert(esHome.includes("<details><summary>Recursos</summary>"), "ES homepage mobile Recursos accordion");
assert(esHome.includes("Todos los Recursos"), "ES homepage Resources panel");
assert(esHome.includes('class="shared-nav__panel"'), "ES homepage desktop vertical panels");
const homeByBanner = injectSharedChrome(homeHtml, "/tmp/_site/unexpected/index.html");
assert(homeByBanner.includes('id="aep-message"'), "aep-message content skip keeps banner");
assert(homeByBanner.includes("Events &amp; Workshops"), "aep-message skip still injects shared nav");
assert(es.includes("Artículos de Medicare"));
assert(es.includes("Todos los Recursos"));
assert(es.includes("/es/contacto/"));
assert(es.includes('class="shared-nav__panel"'));

// Language toggle follows the page's own hreflang alternate
const pairHead = '<html><head><link rel="alternate" hreflang="en" href="https://www.healthexps.com/medical-insurance-broker/"/><link rel="alternate" hreflang="es" href="https://www.healthexps.com/es/corredor-de-seguros-de-salud-miami/"/></head><body><div class="v4-nav-outer"></div><div id="v4-mobile-menu"></div><div id="site-footer"></div></body></html>';
const esPair = injectSharedChrome(pairHead, "/tmp/_site/es/corredor-de-seguros-de-salud-miami/index.html");
assert(esPair.includes('<a href="/medical-insurance-broker/">EN</a><span>ES</span>'), "ES toggle -> hreflang en");
const enPair = injectSharedChrome(pairHead, "/tmp/_site/medical-insurance-broker/index.html");
assert(enPair.includes('<span>EN</span><a href="/es/corredor-de-seguros-de-salud-miami/">ES</a>'), "EN toggle -> hreflang es");
assert(es.includes('<a href="/">EN</a><span>ES</span>'), "ES toggle falls back to / without hreflang");
assert(en.includes('<span>EN</span><a href="/es/">ES</a>'), "EN toggle falls back to /es/ without hreflang");

const css = fs.readFileSync(path.join(__dirname, "../css/shared-chrome.css"), "utf8");
assert(css.includes(".shared-nav__panel"));
assert(/flex-direction:\s*column/.test(css));
assert(/\.shared-nav__panel a[\s\S]*display:\s*block/.test(css));

const fontsCss = fs.readFileSync(path.join(__dirname, "../css/fonts.css"), "utf8");
assert(fontsCss.includes("font-display: swap"));
assert(fontsCss.includes("/fonts/inter-latin-400.woff2"));
assert(fontsCss.includes("/fonts/poppins-latin-700.woff2"));

const withGoogle = injectSharedChrome(
  '<html><head><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet"></head><body><div class="v4-nav-outer"></div><div id="v4-mobile-menu"></div><div id="site-footer"></div></body></html>',
  "/tmp/_site/index.html"
);
assert(!withGoogle.includes("family=Poppins"), "drops render-blocking Inter/Poppins Google Fonts CSS");
assert(!withGoogle.includes('href="https://fonts.googleapis.com"'), "drops fonts.googleapis preconnect");
assert(withGoogle.includes("family=Playfair+Display"), "keeps non-Inter/Poppins Google Fonts");
assert(withGoogle.includes('media="print" onload="this.media=\'all\'"'), "other Google Fonts CSS loads non-blocking");

console.log("shared chrome tests passed");
