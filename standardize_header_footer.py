#!/usr/bin/env python3
"""
Script to standardize header/footer across all English pages.
Run from repo root: python3 standardize_header_footer.py

Gold standard: medicare-plans-miami.html
Skips: calculators and myths page (they have custom headers)
Also runs on es/ subfolder Spanish pages using es/index.html as gold standard.
"""

import os, glob

# ============================================================
# ENGLISH PAGES
# ============================================================
with open('medicare-plans-miami.html') as f:
    gold = f.read()

header_end_markers = ['\n\n<!-- BREADCRUMB', '\n\n<!-- HERO', '\n\n<div class="breadcrumb"', '\n\n<section']

topbar_start = gold.find('<div style="background:#452068;padding:8px 0;">')
header_end = -1
for marker in header_end_markers:
    idx = gold.find(marker)
    if idx > 0 and (header_end < 0 or idx < header_end):
        header_end = idx

STANDARD_HEADER = gold[topbar_start:header_end]

footer_start = gold.find('<footer')
footer_end = gold.find('</footer>') + 9
STANDARD_FOOTER = gold[footer_start:footer_end]

scroll_start = gold.rfind('<button id="scrollToTop"')
scroll_end = gold.find('</body>')
SCROLL_BTN = gold[scroll_start:scroll_end].strip()

print(f"EN Gold standard: medicare-plans-miami.html")
print(f"Header: {len(STANDARD_HEADER)} chars | Footer: {len(STANDARD_FOOTER)} chars")

SKIP_FILES = [
    'medigap-calculator.html',
    'irmaa-calculator.html',
    'enrollment-calculator.html',
    'medicare-myths.html',
    'medicare-plans-miami.html',  # this is the gold standard
]

html_files = [f for f in glob.glob('*.html') if f not in SKIP_FILES]
# Also process medicare/ subfolder
html_files += glob.glob('medicare/*.html')

updated = []
for fname in sorted(html_files):
    with open(fname) as f:
        h = f.read()

    changed = False

    # Replace header
    existing_topbar = h.find('<div style="background:#452068;padding:8px 0;">')
    if existing_topbar < 0:
        existing_topbar = h.find('<div class="topbar"')

    existing_header_end = -1
    for marker in header_end_markers:
        idx = h.find(marker)
        if idx > 0 and (existing_header_end < 0 or idx < existing_header_end):
            existing_header_end = idx

    if existing_topbar > 0 and existing_header_end > 0:
        existing_header = h[existing_topbar:existing_header_end]
        if existing_header.strip() != STANDARD_HEADER.strip():
            h = h[:existing_topbar] + STANDARD_HEADER + h[existing_header_end:]
            changed = True

    # Replace footer
    ef_start = h.find('<footer')
    ef_end = h.find('</footer>') + 9
    if ef_start > 0 and ef_end > 9:
        if h[ef_start:ef_end].strip() != STANDARD_FOOTER.strip():
            h = h[:ef_start] + STANDARD_FOOTER + h[ef_end:]
            changed = True

    # Add scroll to top if missing
    if 'scrollToTop' not in h and '</body>' in h:
        h = h.replace('</body>', SCROLL_BTN + '\n</body>')
        changed = True

    if changed:
        with open(fname, 'w') as f:
            f.write(h)
        updated.append(fname)
        print(f"  Updated: {fname}")

print(f"\nEN pages updated: {len(updated)}")

# ============================================================
# SPANISH PAGES - use es/index.html as gold standard
# ============================================================
if os.path.exists('es/index.html'):
    with open('es/index.html') as f:
        es_gold = f.read()

    es_topbar = es_gold.find('<div style="background:#452068;padding:8px 0;">')
    if es_topbar < 0:
        es_topbar = es_gold.find('<div class="topbar"')

    es_header_end = -1
    for marker in header_end_markers:
        idx = es_gold.find(marker)
        if idx > 0 and (es_header_end < 0 or idx < es_header_end):
            es_header_end = idx

    ES_STANDARD_HEADER = es_gold[es_topbar:es_header_end]

    es_footer_start = es_gold.find('<footer')
    es_footer_end = es_gold.find('</footer>') + 9
    ES_STANDARD_FOOTER = es_gold[es_footer_start:es_footer_end]

    es_scroll_start = es_gold.rfind('<button id="scrollToTop"')
    es_scroll_end = es_gold.find('</body>')
    ES_SCROLL_BTN = es_gold[es_scroll_start:es_scroll_end].strip()

    print(f"\nES Gold standard: es/index.html")
    print(f"Header: {len(ES_STANDARD_HEADER)} chars | Footer: {len(ES_STANDARD_FOOTER)} chars")

    ES_SKIP = ['es/index.html']
    es_files = [f for f in glob.glob('es/*.html') + glob.glob('es/medicare/*.html') if f not in ES_SKIP]

    es_updated = []
    for fname in sorted(es_files):
        with open(fname) as f:
            h = f.read()

        changed = False

        es_tb = h.find('<div style="background:#452068;padding:8px 0;">')
        if es_tb < 0:
            es_tb = h.find('<div class="topbar"')

        es_he = -1
        for marker in header_end_markers:
            idx = h.find(marker)
            if idx > 0 and (es_he < 0 or idx < es_he):
                es_he = idx

        if es_tb > 0 and es_he > 0:
            if h[es_tb:es_he].strip() != ES_STANDARD_HEADER.strip():
                h = h[:es_tb] + ES_STANDARD_HEADER + h[es_he:]
                changed = True

        ef_s = h.find('<footer')
        ef_e = h.find('</footer>') + 9
        if ef_s > 0 and ef_e > 9:
            if h[ef_s:ef_e].strip() != ES_STANDARD_FOOTER.strip():
                h = h[:ef_s] + ES_STANDARD_FOOTER + h[ef_e:]
                changed = True

        if 'scrollToTop' not in h and '</body>' in h:
            h = h.replace('</body>', ES_SCROLL_BTN + '\n</body>')
            changed = True

        if changed:
            with open(fname, 'w') as f:
                f.write(h)
            es_updated.append(fname)
            print(f"  Updated: {fname}")

    print(f"ES pages updated: {len(es_updated)}")

print("\nAll done! Commit with:")
print("git add -A && git commit -m 'Standardize header/footer/scroll across all pages'")
