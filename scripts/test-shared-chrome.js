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

const css = fs.readFileSync(path.join(__dirname, "../css/shared-chrome.css"), "utf8");
assert(css.includes(".shared-nav__panel"));
assert(/flex-direction:\s*column/.test(css));
assert(/\.shared-nav__panel a[\s\S]*display:\s*block/.test(css));

console.log("shared chrome tests passed");
