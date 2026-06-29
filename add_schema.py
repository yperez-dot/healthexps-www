#!/usr/bin/env python3
"""
Add JSON-LD schema markup to healthexps.com pages.
Tasks: 8c (English individual pages), 8d (Spanish individual pages),
       8e (parity fixes), 8f (blog posts).
"""

import json
import re
import os

BASE = "/home/medicare-ai-agent/.openclaw/workspace/healthexps-www"
SITE = "https://www.healthexps.com"

# ─── helpers ──────────────────────────────────────────────────────────────────

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def get_canonical(html):
    m = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)["\']', html, re.I)
    if m:
        return m.group(1).strip()
    return None

def get_title(html):
    m = re.search(r'<title[^>]*>([^<]+)</title>', html, re.I)
    if m:
        t = m.group(1).strip()
        # strip trailing " | Health Experts" or " - Health Experts" etc.
        t = re.sub(r'\s*[\|–\-]\s*(?:The\s+)?Health\s+Experts.*$', '', t, flags=re.I).strip()
        return t
    return ""

def get_h1(html):
    m = re.search(r'<h1[^>]*>([^<]+)</h1>', html, re.I)
    if m:
        return m.group(1).strip()
    return ""

def get_description(html):
    m = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']*)["\']', html, re.I)
    if not m:
        m = re.search(r'<meta\s+content=["\']([^"\']*)["\'][^>]*name=["\']description["\']', html, re.I)
    if m:
        return m.group(1).strip()
    return ""

def has_type(html, schema_type):
    """Return True if the HTML already contains a JSON-LD block with @type == schema_type."""
    for block in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                             html, re.S | re.I):
        try:
            data = json.loads(block)
            if isinstance(data, dict):
                data = [data]
            for item in data:
                if isinstance(item, dict) and item.get("@type") == schema_type:
                    return True
        except Exception:
            pass
    return False

def inject_script(html, *schema_dicts):
    """Inject one <script> block per schema dict, all before </head>."""
    blocks = []
    for sd in schema_dicts:
        js = json.dumps(sd, ensure_ascii=False, indent=2)
        blocks.append(f'<script type="application/ld+json">\n{js}\n</script>')
    insertion = "\n".join(blocks) + "\n"
    # Insert before </head>
    new_html = re.sub(r'(</head>)', insertion + r'\1', html, count=1, flags=re.I)
    if new_html == html:
        # No </head> found — append at end
        new_html = html + "\n" + insertion
    return new_html

def org_ref():
    return {
        "@type": "Organization",
        "name": "The Health Experts Insurance",
        "url": SITE
    }

def breadcrumb_schema(items):
    """items = list of (name, url) tuples."""
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i+1, "name": n, "item": u}
            for i, (n, u) in enumerate(items)
        ]
    }

# ─── schema builders ──────────────────────────────────────────────────────────

def make_breadcrumb_page(page_name, canonical):
    return breadcrumb_schema([
        ("Home", SITE),
        (page_name, canonical)
    ])

def make_breadcrumb_es_page(page_name, canonical):
    return breadcrumb_schema([
        ("Inicio", SITE + "/es/"),
        (page_name, canonical)
    ])

def make_webpage(canonical, title, lang="en"):
    d = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "url": canonical,
        "inLanguage": lang,
        "isPartOf": {"@type": "WebSite", "url": SITE}
    }
    return d

def make_service(canonical, title, service_type, lang="en"):
    d = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": title,
        "serviceType": service_type,
        "url": canonical,
        "provider": org_ref()
    }
    if lang != "en":
        d["inLanguage"] = lang
    return d

def make_insurance_agency(canonical, title, lang="en"):
    d = {
        "@context": "https://schema.org",
        "@type": "InsuranceAgency",
        "name": title,
        "url": canonical
    }
    if lang != "en":
        d["inLanguage"] = lang
    return d

def make_article(canonical, title, description, author, lang="en"):
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": description,
        "author": {"@type": "Person", "name": author},
        "publisher": org_ref(),
        "url": canonical,
        "inLanguage": lang
    }

def make_faq_page(canonical, name, lang="en"):
    d = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "name": name,
        "url": canonical
    }
    if lang != "en":
        d["inLanguage"] = lang
    return d

def make_contact_page():
    return {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "name": "Contacto — The Health Experts Insurance",
        "url": SITE + "/es/contacto"
    }

# ─── processing functions ─────────────────────────────────────────────────────

results = []

def process(filepath, schemas_to_add):
    """
    schemas_to_add: list of ("TypeName", schema_dict_or_callable).
    If callable, it's called with (html, canonical, title) → dict or None.
    """
    if not os.path.exists(filepath):
        results.append(f"SKIP (not found): {filepath}")
        return

    html = read(filepath)
    canonical = get_canonical(html)
    title = get_title(html) or get_h1(html)

    added = []
    new_html = html
    for type_name, schema_obj in schemas_to_add:
        if has_type(new_html, type_name):
            continue  # already present
        if callable(schema_obj):
            sd = schema_obj(new_html, canonical, title)
            if sd is None:
                continue
        else:
            sd = schema_obj
        new_html = inject_script(new_html, sd)
        added.append(type_name)

    if added:
        write(filepath, new_html)
        results.append(f"ADDED {added}: {filepath.replace(BASE+'/', '')}")
    else:
        results.append(f"SKIP (all present): {filepath.replace(BASE+'/', '')}")


# ═════════════════════════════════════════════════════════════════════════════
# TASK A — 8c: English individual pages
# ═════════════════════════════════════════════════════════════════════════════

def en_page(rel, schemas_extra, bc_name=None):
    fp = os.path.join(BASE, rel)
    if not os.path.exists(fp):
        results.append(f"SKIP (not found): {rel}")
        return
    html = read(fp)
    canonical = get_canonical(html)
    title = get_title(html) or get_h1(html)
    name = bc_name or title

    schemas = []
    # BreadcrumbList
    if not has_type(html, "BreadcrumbList"):
        schemas.append(breadcrumb_schema([("Home", SITE), (name, canonical)]))
    # extra schemas
    for type_name, make_fn in schemas_extra:
        if not has_type(html, type_name):
            sd = make_fn(canonical, title)
            schemas.append(sd)

    if schemas:
        new_html = html
        for sd in schemas:
            new_html = inject_script(new_html, sd)
        write(fp, new_html)
        added = (["BreadcrumbList"] if not has_type(html, "BreadcrumbList") else []) + \
                [t for t, _ in schemas_extra if not has_type(html, t)]
        # recompute what was actually added
        added_actual = []
        if not has_type(html, "BreadcrumbList"):
            added_actual.append("BreadcrumbList")
        for t, _ in schemas_extra:
            if not has_type(html, t):
                added_actual.append(t)
        results.append(f"ADDED {added_actual}: {rel}")
    else:
        results.append(f"SKIP (all present): {rel}")

# 1. /medicare-irmaa-penalties.html → BreadcrumbList + FAQPage
en_page("medicare-irmaa-penalties.html",
        [("FAQPage", lambda c, t: make_faq_page(c, "IRMAA Medicare Penalties FAQ", "en"))],
        bc_name="IRMAA Medicare Penalties")

# 2. /enrollment-calculator.html → BreadcrumbList + WebPage
en_page("enrollment-calculator.html",
        [("WebPage", lambda c, t: make_webpage(c, t, "en"))])

# 3. /irmaa-calculator.html → BreadcrumbList + WebPage
en_page("irmaa-calculator.html",
        [("WebPage", lambda c, t: make_webpage(c, t, "en"))])

# 4. /medigap-plan-calculator.html → BreadcrumbList + WebPage
en_page("medigap-plan-calculator.html",
        [("WebPage", lambda c, t: make_webpage(c, t, "en"))])

# 5. /medicare-advantage-vs-supplement-calculator.html → BreadcrumbList + WebPage
en_page("medicare-advantage-vs-supplement-calculator.html",
        [("WebPage", lambda c, t: make_webpage(c, t, "en"))])

# 6. /private-health-insurance-miami.html → BreadcrumbList + Service
en_page("private-health-insurance-miami.html",
        [("Service", lambda c, t: make_service(c, t, "Private Health Insurance", "en"))])

# 7. /dental-vision-miami.html → BreadcrumbList + Service
en_page("dental-vision-miami.html",
        [("Service", lambda c, t: make_service(c, t, "Dental & Vision Insurance", "en"))])

# 8. /resources.html → BreadcrumbList + WebPage
en_page("resources.html",
        [("WebPage", lambda c, t: make_webpage(c, t, "en"))])

# 9. /find-my-plan.html → BreadcrumbList + WebPage
en_page("find-my-plan.html",
        [("WebPage", lambda c, t: make_webpage(c, t, "en"))])

# 10. /healthcare-insurance-for-seniors.html → BreadcrumbList + Service
en_page("healthcare-insurance-for-seniors.html",
        [("Service", lambda c, t: make_service(c, t, "Senior Health Insurance", "en"))])

# 11. /independent-health-insurance-broker.html → BreadcrumbList (InsuranceAgency skip)
en_page("independent-health-insurance-broker.html", [])

# 12. /medical-insurance-broker.html → BreadcrumbList (InsuranceAgency skip)
en_page("medical-insurance-broker.html", [])

# 13. /cobra-alternatives-miami.html → BreadcrumbList + Service
en_page("cobra-alternatives-miami.html",
        [("Service", lambda c, t: make_service(c, t, "COBRA Alternatives", "en"))])

# 14. /medicare-annual-enrollment-2027.html → BreadcrumbList + Service
en_page("medicare-annual-enrollment-2027.html",
        [("Service", lambda c, t: make_service(c, t, "Medicare Annual Enrollment", "en"))])


# ═════════════════════════════════════════════════════════════════════════════
# TASK A — 8d: Spanish individual pages
# ═════════════════════════════════════════════════════════════════════════════

def es_page(rel, schemas_extra, bc_name=None):
    fp = os.path.join(BASE, rel)
    if not os.path.exists(fp):
        results.append(f"SKIP (not found): {rel}")
        return
    html = read(fp)
    canonical = get_canonical(html)
    title = get_title(html) or get_h1(html)
    name = bc_name or title

    # BreadcrumbList for Spanish
    bc = breadcrumb_schema([("Inicio", SITE + "/es/"), (name, canonical)])

    schemas = []
    if not has_type(html, "BreadcrumbList"):
        schemas.append(bc)
    for type_name, make_fn in schemas_extra:
        if not has_type(html, type_name):
            sd = make_fn(canonical, title)
            schemas.append(sd)

    if schemas:
        new_html = html
        for sd in schemas:
            new_html = inject_script(new_html, sd)
        write(fp, new_html)
        added_actual = []
        if not has_type(html, "BreadcrumbList"):
            added_actual.append("BreadcrumbList")
        for t, _ in schemas_extra:
            if not has_type(html, t):
                added_actual.append(t)
        results.append(f"ADDED {added_actual}: {rel}")
    else:
        results.append(f"SKIP (all present): {rel}")

# 1. es/planes-de-medicare-miami.html → BreadcrumbList + Service
es_page("es/planes-de-medicare-miami.html",
        [("Service", lambda c, t: make_service(c, t, "Medicare Plans", "es"))],
        bc_name="Planes de Medicare Miami")

# 2. es/medicare/planes-medicare-advantage.html → BreadcrumbList + Article + FAQPage
es_page("es/medicare/planes-medicare-advantage.html",
        [("Article",  lambda c, t: make_article(c, t, "", "Yahoska Perez", "es")),
         ("FAQPage",  lambda c, t: make_faq_page(c, t, "es"))],
        bc_name="Planes Medicare Advantage")

# 3. es/medicare/medicare-suplementario.html → BreadcrumbList + Article + FAQPage
es_page("es/medicare/medicare-suplementario.html",
        [("Article",  lambda c, t: make_article(c, t, "", "Yahoska Perez", "es")),
         ("FAQPage",  lambda c, t: make_faq_page(c, t, "es"))],
        bc_name="Medicare Suplementario")

# 4. es/medicare/costos-de-medicare.html → BreadcrumbList + Article + FAQPage
es_page("es/medicare/costos-de-medicare.html",
        [("Article",  lambda c, t: make_article(c, t, "", "Yahoska Perez", "es")),
         ("FAQPage",  lambda c, t: make_faq_page(c, t, "es"))],
        bc_name="Costos de Medicare")

# 5. es/medicare/programa-ahorros-medicare.html → BreadcrumbList + Article + FAQPage
es_page("es/medicare/programa-ahorros-medicare.html",
        [("Article",  lambda c, t: make_article(c, t, "", "Yahoska Perez", "es")),
         ("FAQPage",  lambda c, t: make_faq_page(c, t, "es"))],
        bc_name="Programa de Ahorros Medicare")

# 6. es/periodos-inscripcion-medicare.html → BreadcrumbList + FAQPage
es_page("es/periodos-inscripcion-medicare.html",
        [("FAQPage", lambda c, t: make_faq_page(c, t, "es"))],
        bc_name="Períodos de Inscripción Medicare")

# 7. es/buscador-de-planes.html → BreadcrumbList + WebPage
es_page("es/buscador-de-planes.html",
        [("WebPage", lambda c, t: make_webpage(c, t, "es"))])

# 8. es/calculadora-de-inscripcion.html → BreadcrumbList + WebPage
es_page("es/calculadora-de-inscripcion.html",
        [("WebPage", lambda c, t: make_webpage(c, t, "es"))])

# 9. es/planes-aca-miami.html → BreadcrumbList + Service
es_page("es/planes-aca-miami.html",
        [("Service", lambda c, t: make_service(c, t, "ACA Marketplace Plans", "es"))],
        bc_name="Planes ACA Miami")

# 10. es/recursos.html → BreadcrumbList + WebPage
es_page("es/recursos.html",
        [("WebPage", lambda c, t: make_webpage(c, t, "es"))])

# 11. es/faq.html → BreadcrumbList + FAQPage
es_page("es/faq.html",
        [("FAQPage", lambda c, t: make_faq_page(c, t, "es"))])

# 12. es/preguntas-medicare.html → BreadcrumbList + FAQPage
es_page("es/preguntas-medicare.html",
        [("FAQPage", lambda c, t: make_faq_page(c, t, "es"))],
        bc_name="Preguntas sobre Medicare")

# 13. es/preguntas-aca.html → BreadcrumbList + FAQPage
es_page("es/preguntas-aca.html",
        [("FAQPage", lambda c, t: make_faq_page(c, t, "es"))],
        bc_name="Preguntas sobre ACA")

# 14. es/find-my-plan.html → BreadcrumbList + WebPage
es_page("es/find-my-plan.html",
        [("WebPage", lambda c, t: make_webpage(c, t, "es"))])

# 15. es/corredor-de-seguros-de-salud-miami.html → BreadcrumbList (InsuranceAgency already added)
es_page("es/corredor-de-seguros-de-salud-miami.html", [],
        bc_name="Corredor de Seguros de Salud Miami")

# 16. es/alternativas-cobra-miami.html → BreadcrumbList + Service
es_page("es/alternativas-cobra-miami.html",
        [("Service", lambda c, t: make_service(c, t, "COBRA Alternatives", "es"))],
        bc_name="Alternativas COBRA Miami")

# 17. es/inscripcion-anual-medicare-2027.html → BreadcrumbList + Service
es_page("es/inscripcion-anual-medicare-2027.html",
        [("Service", lambda c, t: make_service(c, t, "Medicare Annual Enrollment", "es"))],
        bc_name="Inscripción Anual Medicare 2027")


# ═════════════════════════════════════════════════════════════════════════════
# TASK A — 8e: Parity fixes
# ═════════════════════════════════════════════════════════════════════════════

# es/medicare-advantage-miami.html → Service (serviceType: "Medicare Advantage Plans")
es_page("es/medicare-advantage-miami.html",
        [("Service", lambda c, t: make_service(c, t, "Medicare Advantage Plans", "es"))],
        bc_name="Medicare Advantage Miami")

# es/medicare/nuevo-en-medicare.html → Article
es_page("es/medicare/nuevo-en-medicare.html",
        [("Article", lambda c, t: make_article(c, t, get_description(read(os.path.join(BASE, "es/medicare/nuevo-en-medicare.html"))), "Yahoska Perez", "es"))],
        bc_name="Nuevo en Medicare")

# es/contacto.html → ContactPage
{
    # handled inline below
}

fp_contacto = os.path.join(BASE, "es/contacto.html")
if os.path.exists(fp_contacto):
    html = read(fp_contacto)
    if not has_type(html, "ContactPage"):
        sd = make_contact_page()
        new_html = inject_script(html, sd)
        # Also add BreadcrumbList if missing
        if not has_type(html, "BreadcrumbList"):
            canonical = get_canonical(html)
            title = get_title(html) or "Contacto"
            bc = breadcrumb_schema([("Inicio", SITE + "/es/"), ("Contacto", canonical or SITE + "/es/contacto")])
            new_html = inject_script(new_html, bc)
            results.append(f"ADDED ['ContactPage', 'BreadcrumbList']: es/contacto.html")
        else:
            results.append(f"ADDED ['ContactPage']: es/contacto.html")
        write(fp_contacto, new_html)
    else:
        results.append(f"SKIP (all present): es/contacto.html")
else:
    results.append(f"SKIP (not found): es/contacto.html")


# ═════════════════════════════════════════════════════════════════════════════
# TASK B — 8f: Blog posts
# ═════════════════════════════════════════════════════════════════════════════

# Author mapping by filename keywords
YAHOSKA = "Yahoska Perez"
KATY    = "Katy Robles"

EN_AUTHOR_MAP = {
    "avmed":            YAHOSKA,
    "errors":           YAHOSKA,
    "mistakes":         YAHOSKA,
    "sep":              YAHOSKA,
    "special-enrollment": YAHOSKA,
    "broker":           YAHOSKA,
    "cobra":            YAHOSKA,
    "income":           KATY,
    "irmaa":            KATY,
    "mapd":             KATY,
    "savings":          KATY,
    "medicare-savings": KATY,
    "savings-program":  KATY,
}

ES_AUTHOR_MAP = {
    "avmed":      YAHOSKA,   # 2
    "errores":    YAHOSKA,   # 5
    "sep":        YAHOSKA,
    "inscripcion-especial": YAHOSKA,  # 9
    "corredor":   YAHOSKA,  # 7 broker
    "cobra":      YAHOSKA,  # 1
    "ingreso":    KATY,     # 3
    "mapd":       KATY,     # 4
    "diferencias": KATY,    # 4
    "programa":   KATY,     # 8
    "ahorros":    KATY,
}

def guess_en_author(filename):
    fn = filename.lower()
    for key, author in EN_AUTHOR_MAP.items():
        if key in fn:
            return author
    return YAHOSKA  # default

def guess_es_author(filename):
    fn = filename.lower()
    for key, author in ES_AUTHOR_MAP.items():
        if key in fn:
            return author
    # Spanish posts 1,2,5,6,7,9 = Yahoska; 3,4,8 = Katy per task spec
    # Map by sort position
    return YAHOSKA  # default

def process_blog_post(filepath, blog_list_url, lang):
    if not os.path.exists(filepath):
        return f"SKIP (not found): {filepath}"

    html = read(filepath)
    canonical = get_canonical(html)
    title = get_title(html) or get_h1(html)
    description = get_description(html)
    filename = os.path.basename(filepath)

    if lang == "en":
        author = guess_en_author(filename)
    else:
        author = guess_es_author(filename)

    schemas = []
    bc_name = title or filename

    if not has_type(html, "BreadcrumbList"):
        bc = breadcrumb_schema([
            ("Home" if lang == "en" else "Inicio", SITE),
            ("Blog", blog_list_url),
            (bc_name, canonical)
        ])
        schemas.append(bc)

    if not has_type(html, "Article"):
        art = make_article(canonical, title, description, author, lang)
        schemas.append(art)

    if schemas:
        new_html = html
        for sd in schemas:
            new_html = inject_script(new_html, sd)
        write(filepath, new_html)
        added_types = []
        if not has_type(html, "BreadcrumbList"):
            added_types.append("BreadcrumbList")
        if not has_type(html, "Article"):
            added_types.append("Article")
        rel = filepath.replace(BASE + "/", "")
        return f"ADDED {added_types}: {rel}"
    else:
        rel = filepath.replace(BASE + "/", "")
        return f"SKIP (all present): {rel}"

# English blog posts
blog_en_dir = os.path.join(BASE, "blog")
for fname in sorted(os.listdir(blog_en_dir)):
    if fname.endswith(".html") and fname != "index.html":
        results.append(process_blog_post(os.path.join(blog_en_dir, fname),
                                         SITE + "/blog/", "en"))

# Spanish blog posts
blog_es_dir = os.path.join(BASE, "es/blog")
for fname in sorted(os.listdir(blog_es_dir)):
    if fname.endswith(".html") and fname != "index.html":
        results.append(process_blog_post(os.path.join(blog_es_dir, fname),
                                         SITE + "/es/blog/", "es"))

# ─── summary ──────────────────────────────────────────────────────────────────
print("\n=== SCHEMA INJECTION SUMMARY ===\n")
for r in results:
    print(r)
print(f"\nTotal files processed: {len(results)}")
print("Done.")
