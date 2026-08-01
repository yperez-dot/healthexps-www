#!/usr/bin/env python3
"""
lang-toggle-inject.py
Single source of truth for EN/ES language toggle hrefs + hreflang tags.
Generates both outputs in one pass from the mapping table below.

Usage:
  python3 scripts/lang-toggle-inject.py --dry-run --file aca-plans-miami.html
  python3 scripts/lang-toggle-inject.py --dry-run          # all pages, no writes
  python3 scripts/lang-toggle-inject.py                    # apply to all pages
"""

import re, sys, os, argparse

# ════════════════════════════════════════════════════════════════════════════
#  MAPPING TABLE — edit here, nowhere else.
#  Both the toggle href and hreflang tags are generated from this dict.
#  EN path → ES path, or None for pages with no confirmed Spanish twin.
# ════════════════════════════════════════════════════════════════════════════
EN_ES = {
    "/":                                        "/es/",
    "/medicare-plans-miami":                    "/es/planes-de-medicare-miami",
    "/medicare-advantage-miami":                "/es/medicare-advantage-miami",
    "/medicare-supplement-miami":               "/es/medicare-suplementario-miami",    # sub-blocker resolved: mirrors EN URL pattern
    "/aca-plans-miami":                         "/es/planes-aca-miami",
    "/private-health-insurance-miami":          "/es/seguro-medico-privado-miami",
    "/cobra-alternatives-miami":                "/es/alternativas-cobra-miami",
    "/dental-vision-miami":                     "/es/dental-vision-miami",
    "/medicare/what-is-medicare":               "/es/medicare/que-es-medicare",
    "/medicare/new-to-medicare":                "/es/medicare/nuevo-en-medicare",
    "/medicare/medicare-advantage-plans":       "/es/medicare/planes-medicare-advantage",
    "/medicare-irmaa-penalties":                "/es/irmaa-penalidades-medicare",
    "/medicare-savings-program":                "/es/medicare/programa-ahorros-medicare",
    "/medicare-dual-eligible-miami":            "/es/medicare-medicaid-miami",
    "/medicare-myths":                          "/es/mitos-medicare",
    "/medicare-annual-enrollment-2027":         "/es/inscripcion-anual-medicare-2027",
    "/medicare-plan-finder":                    "/es/buscador-de-planes",
    "/find-my-plan":                            "/es/encuentra-mi-plan",
    "/compare-medicare-plans":                  "/es/comparar-planes-de-medicare",
    "/enrollment-calculator":                   "/es/calculadora-de-inscripcion",
    "/faq":                                     "/es/preguntas-frecuentes",            # sub-blocker resolved: fuller content page
    "/contact":                                 "/es/contacto",
    "/resources":                               "/es/recursos",
    "/privacy":                                 "/es/privacidad",
    "/independent-health-insurance-broker":     "/es/corredor-de-seguros-de-salud-miami",
    "/medicare-agent-miami":                    "/es/agente-de-medicare-miami",
    "/avmed-medicare-florida":                  "/es/avmed-medicare-florida",
    # No confirmed ES twin — fallback to /es/ home, NO hreflang tags added
    "/life-insurance-miami":                    None,
    "/final-expense-insurance":                 None,
}

# Reverse map auto-derived — never hand-maintained separately
ES_EN = {v: k for k, v in EN_ES.items() if v is not None}

BASE = "https://www.healthexps.com"

# ════════════════════════════════════════════════════════════════════════════
#  HTML TEMPLATES
# ════════════════════════════════════════════════════════════════════════════

def en_toggle_html(es_url):
    """EN page toggle: EN (plain) | ES (linked to correct target)."""
    return (
        f'<span style="opacity:.85">EN | '
        f'<a href="{es_url}" style="color:#fff;text-decoration:none;font-weight:700">ES</a></span>'
    )

def es_toggle_html(en_url):
    """ES page toggle: EN (linked to correct target) | ES (plain)."""
    return (
        f'<span style="opacity:.85">'
        f'<a href="{en_url}" style="color:#fff;text-decoration:none;font-weight:700">EN</a> | ES</span>'
    )

def hreflang_tags(en_path, es_path):
    """Reciprocal hreflang pair — no x-default (brief spec)."""
    return (
        f'<link rel="alternate" hreflang="en" href="{BASE}{en_path}"/>\n'
        f'<link rel="alternate" hreflang="es" href="{BASE}{es_path}"/>'
    )

# ════════════════════════════════════════════════════════════════════════════
#  PATTERNS TO FIND AND REPLACE
# ════════════════════════════════════════════════════════════════════════════

# Strips ALL existing hreflang lines (catches double-slash, x-default, etc.)
HREFLANG_RE = re.compile(
    r'<link rel="alternate" hreflang="[^"]*" href="[^"]*"/?/?/?>[ \t]*\n?'
)

# EN toggle patterns — existing toggle (any href) or plain text fallback
# Handles: opacity:.85 and opacity:.85; (trailing semicolon), &ntilde; / &#241; / literal ñ
EN_TOGGLE_RE = re.compile(
    r'<span style="opacity:\.85;?">EN \| <a href="[^"]*"[^>]*>ES</a></span>'
    r'|<span style="opacity:\.85;?">English &amp; Espa(?:\xf1|&ntilde;|&#241;)ol</span>',
    re.UNICODE
)

# ES toggle patterns — plain text (no link yet)
# Handles: "Español & English", "Espa&ntilde;ol & English", "Inglés y Español" variants
ES_TOGGLE_RE = re.compile(
    r'<span style="color:rgba\(255,255,255,0\.75\);font-size:13px;">(?:Espa(?:\xf1|&ntilde;)ol) &(?:amp;)? English</span>'
    r'|<span style="color:rgba\(255,255,255,0\.75\);font-size:13px;">Ingl(?:\xe9s|&eacute;s) y Espa(?:\xf1|&ntilde;)ol</span>',
    re.UNICODE
)

# Footer "Sitio en Español" link — always points to /es/, needs updating per page
FOOTER_SITIO_RE = re.compile(
    r'<a href="[^"]*" style="color:#4a4051">Sitio en Espa(?:ñol|&ntilde;ol)</a>'
)

# ════════════════════════════════════════════════════════════════════════════
#  CORE LOGIC
# ════════════════════════════════════════════════════════════════════════════

def filepath_to_en_path(filepath):
    """Convert a file path to its canonical EN URL path."""
    path = filepath.replace('\\', '/').replace('.html', '')
    if not path.startswith('/'):
        path = '/' + path
    if path.endswith('/index'):
        path = path[:-6] or '/'
    return path or '/'

def filepath_to_es_path(filepath):
    """Convert an ES file path to its canonical ES URL path."""
    path = filepath.replace('\\', '/').replace('.html', '')
    if not path.startswith('/'):
        path = '/' + path
    if path.endswith('/index'):
        path = path[:-6] or '/'
    return path

def inject_hreflang(html, en_path, es_path):
    """Strip existing hreflang tags, inject correct pair after <link rel='canonical'>."""
    # Strip all existing hreflang lines first
    html = HREFLANG_RE.sub('', html)
    new_tags = hreflang_tags(en_path, es_path)
    # Inject after canonical tag if present
    canonical_re = re.compile(r'(<link rel="canonical"[^>]*/?>\n?)')
    if canonical_re.search(html):
        html = canonical_re.sub(r'\1' + new_tags + '\n', html, count=1)
    else:
        # Fallback: before </head>
        html = html.replace('</head>', new_tags + '\n</head>', 1)
    return html

def process_en_page(filepath, dry_run=False):
    with open(filepath, encoding='utf-8') as f:
        original = f.read()
    html = original

    en_path = filepath_to_en_path(filepath)
    es_path = EN_ES.get(en_path)
    es_url = es_path if es_path else "/es/"

    changes = []

    # 1. hreflang
    if es_path:
        html = inject_hreflang(html, en_path, es_path)
        if html != original:
            changes.append(f"hreflang → en:{BASE}{en_path}  es:{BASE}{es_path}")
    else:
        # Remove any orphan hreflang tags (e.g. life-insurance-miami)
        cleaned = HREFLANG_RE.sub('', html)
        if cleaned != html:
            html = cleaned
            changes.append("hreflang → removed orphan tag(s) (no confirmed twin)")
        else:
            changes.append("hreflang → none (no confirmed twin, no existing tag)")

    # 2. Toggle button
    new_toggle = en_toggle_html(es_url)
    html_new, n = EN_TOGGLE_RE.subn(new_toggle, html, count=1)
    if n:
        html = html_new
        changes.append(f"toggle  → EN | ES → {es_url}")
    else:
        changes.append(f"toggle  → PATTERN NOT FOUND in {filepath}")

    # 3. Footer "Sitio en Español"
    new_footer = f'<a href="{es_url}" style="color:#4a4051">Sitio en Espa&ntilde;ol</a>'
    html_new, n = FOOTER_SITIO_RE.subn(new_footer, html, count=1)
    if n:
        html = html_new
        changes.append(f"footer  → Sitio en Español → {es_url}")

    if not dry_run and html != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)

    return changes, html != original

def process_es_page(filepath, dry_run=False):
    with open(filepath, encoding='utf-8') as f:
        original = f.read()
    html = original

    es_path = filepath_to_es_path(filepath)
    en_path = ES_EN.get(es_path)

    changes = []

    # 1. hreflang
    if en_path:
        html = inject_hreflang(html, en_path, es_path)
        if html != original:
            changes.append(f"hreflang → en:{BASE}{en_path}  es:{BASE}{es_path}")
    else:
        cleaned = HREFLANG_RE.sub('', html)
        if cleaned != html:
            html = cleaned
            changes.append("hreflang → removed tag(s) (no confirmed EN twin in mapping)")

    # 2. Toggle button
    if en_path:
        new_toggle = es_toggle_html(en_path)
        html_new, n = ES_TOGGLE_RE.subn(new_toggle, html, count=1)
        if n:
            html = html_new
            changes.append(f"toggle  → EN → {en_path} | ES")
        else:
            changes.append(f"toggle  → PATTERN NOT FOUND in {filepath}")

    if not dry_run and html != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)

    return changes, html != original

# ════════════════════════════════════════════════════════════════════════════
#  RUNNER
# ════════════════════════════════════════════════════════════════════════════

def collect_en_files(root='.'):
    files = []
    for name in os.listdir(root):
        if name.endswith('.html') and name != '404.html':
            files.append(name)
    # Recurse into medicare/ subdirectory
    med = os.path.join(root, 'medicare')
    if os.path.isdir(med):
        for name in os.listdir(med):
            if name.endswith('.html'):
                files.append(os.path.join('medicare', name))
    return sorted(files)

def collect_es_files(root='.'):
    files = []
    es_root = os.path.join(root, 'es')
    if not os.path.isdir(es_root):
        return files
    for dirpath, _, filenames in os.walk(es_root):
        for name in filenames:
            if name.endswith('.html'):
                rel = os.path.relpath(os.path.join(dirpath, name), root)
                files.append(rel)
    return sorted(files)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--file', help='Single file to process (relative path)')
    args = parser.parse_args()

    mode = "DRY RUN" if args.dry_run else "APPLYING"
    print(f"\n{'═'*60}")
    print(f"  lang-toggle-inject.py — {mode}")
    print(f"{'═'*60}\n")

    changed = 0
    skipped = 0
    errors = []

    if args.file:
        filepath = args.file
        is_es = filepath.startswith('es/') or filepath.startswith('es\\')
        fn = process_es_page if is_es else process_en_page
        changes, did_change = fn(filepath, dry_run=args.dry_run)
        status = "CHANGED" if did_change else "no change"
        print(f"[{status}] {filepath}")
        for c in changes:
            print(f"  {c}")
        return

    print("── EN pages ─────────────────────────────────────────────")
    for f in collect_en_files():
        try:
            changes, did_change = process_en_page(f, dry_run=args.dry_run)
            status = "CHANGED" if did_change else "no change"
            if did_change:
                changed += 1
                print(f"[{status}] {f}")
                for c in changes:
                    print(f"  {c}")
            else:
                skipped += 1
        except Exception as e:
            errors.append((f, str(e)))

    print("\n── ES pages ─────────────────────────────────────────────")
    for f in collect_es_files():
        try:
            changes, did_change = process_es_page(f, dry_run=args.dry_run)
            status = "CHANGED" if did_change else "no change"
            if did_change:
                changed += 1
                print(f"[{status}] {f}")
                for c in changes:
                    print(f"  {c}")
            else:
                skipped += 1
        except Exception as e:
            errors.append((f, str(e)))

    print(f"\n{'═'*60}")
    print(f"  {changed} files changed, {skipped} unchanged, {len(errors)} errors")
    if errors:
        print("  ERRORS:")
        for f, e in errors:
            print(f"    {f}: {e}")
    print(f"{'═'*60}\n")

if __name__ == '__main__':
    main()
