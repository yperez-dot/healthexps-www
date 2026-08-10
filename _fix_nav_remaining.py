#!/usr/bin/env python3
"""Fix nav Life Insurance + Final Expense for pages where exact-match failed."""

import re
import os

WORKDIR = '/home/medicare-ai-agent/.openclaw/workspace/healthexps-www'

DESKTOP_LIFE = '<a href="/life-insurance-miami" style="padding:10px 14px;border-radius:8px;cursor:pointer;font-weight:600">Life Insurance</a>'
DESKTOP_FEX  = '<a href="/final-expense-insurance" style="padding:10px 14px;border-radius:8px;cursor:pointer;font-weight:600">Final Expense</a>'

MOBILE_LIFE  = '<a href="/life-insurance-miami" style="padding:11px 12px;border-radius:8px;color:#241a30;font-weight:600;font-size:15px">Life Insurance</a>'
MOBILE_FEX   = '<a href="/final-expense-insurance" style="padding:11px 12px;border-radius:8px;color:#241a30;font-weight:600;font-size:15px">Final Expense</a>'

def fix_nav_regex(content, add_life, add_fex):
    """
    Add Life Insurance and/or Final Expense to desktop + mobile nav.
    Uses regex to match any style variant of the dental-vision nav link.
    Pre-computes what to add to avoid closure-variable mutation bugs.
    """
    if not add_life and not add_fex:
        return content

    # Pre-compute additions (check original content, not mid-substitution state)
    desktop_additions = ''
    if add_life:
        desktop_additions += '\n            ' + DESKTOP_LIFE
    if add_fex:
        desktop_additions += '\n            ' + DESKTOP_FEX

    mobile_additions = ''
    if add_life:
        mobile_additions += '\n      ' + MOBILE_LIFE
    if add_fex:
        mobile_additions += '\n      ' + MOBILE_FEX

    # Desktop: padding:10px 14px variant
    content = re.sub(
        r'(<a href="/dental-vision-miami" style="padding:10px 14px;[^"]*">Dental &amp; Vision</a>)',
        r'\1' + desktop_additions.replace('\\', '\\\\'),
        content
    )

    # Mobile: padding:11px 12px variant
    content = re.sub(
        r'(<a href="/dental-vision-miami" style="padding:11px 12px;[^"]*">Dental &amp; Vision</a>)',
        r'\1' + mobile_additions.replace('\\', '\\\\'),
        content
    )

    return content

# Pages that still need the nav fix
# Format: (rel_path, add_life, add_fex)
REMAINING = [
    # irmaa-calculator.html: desktop was done, mobile still missing
    ('irmaa-calculator.html',                    False, False),  # will re-eval below
    # medicare-advantage-miami.html: needs both
    ('medicare-advantage-miami.html',            False, False),  # will re-eval below
    # medicare-supplement-miami.html: needs both
    ('medicare-supplement-miami.html',           False, False),  # will re-eval below
    # resources.html: needs both
    ('resources.html',                           False, False),  # will re-eval below
    # independent-health-insurance-broker.html
    ('independent-health-insurance-broker.html', False, False),  # will re-eval below
]

# We re-evaluate based on what's currently in each file
TARGET_FILES = [
    'irmaa-calculator.html',
    'medicare-advantage-miami.html',
    'medicare-supplement-miami.html',
    'resources.html',
    'independent-health-insurance-broker.html',
]

changed = 0
for rel_path in TARGET_FILES:
    path = os.path.join(WORKDIR, rel_path)
    with open(path, 'r', encoding='utf-8') as f:
        original = f.read()

    life_missing = 'life-insurance-miami' not in original
    fex_missing  = 'final-expense-insurance' not in original

    if not life_missing and not fex_missing:
        print(f'  SKIP (already present): {rel_path}')
        continue

    # Check if there's even a nav dental link to insert after
    has_desktop_dental = bool(re.search(
        r'<a href="/dental-vision-miami" style="padding:10px 14px;[^"]*">Dental &amp; Vision</a>',
        original
    ))
    has_mobile_dental = bool(re.search(
        r'<a href="/dental-vision-miami" style="padding:11px 12px;[^"]*">Dental &amp; Vision</a>',
        original
    ))

    if not has_desktop_dental and not has_mobile_dental:
        print(f'  NOCHANGE (no nav dental anchor found): {rel_path}')
        continue

    content = fix_nav_regex(original, life_missing, fex_missing)

    if content == original:
        print(f'  NOCHANGE (pattern sub returned same): {rel_path}')
        continue

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    added = []
    if life_missing: added.append('Life')
    if fex_missing:  added.append('FEX')
    print(f'  OK  {rel_path} [added={",".join(added)}, desktop={has_desktop_dental}, mobile={has_mobile_dental}]')
    changed += 1

print(f'\nDone. {changed} pages updated.')
