const assert = require("assert");
const { injectSharedChrome } = require("./shared-chrome");

const old = '<html><head></head><body><div class="v4-nav-outer"><a>Old</a></div><div id="v4-mobile-menu"><div>Old mobile</div></div><main>Body</main><div id="site-footer"><div>Old footer</div></div></body></html>';
const en = injectSharedChrome(old, "/tmp/_site/index.html");
assert(en.includes("Medicare Articles"));
assert(en.includes("All Resources"));
assert(!en.includes("Medicare Advantage</a><a"));
assert(!en.includes("Old mobile"));
assert(en.includes("shared-chrome.css"));
const es = injectSharedChrome(old, "/tmp/_site/es/index.html");
assert(es.includes("Artículos de Medicare"));
assert(es.includes("Todos los Recursos"));
assert(es.includes('/es/contacto/'));
console.log("shared chrome tests passed");
