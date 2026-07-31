#!/usr/bin/env python3
"""
a11y-bump.py — Accessibility font/input size bump for 65+ audience
Applies to all HTML files in the current directory.

Changes:
- Input/select/textarea font-size: 14.5px → 16px
- Form label font-size: 12px (uppercase labels) → 14px
- Fine print / consent text: 12px, 11.5px, 11px → 13.5px
- Input borders: 1px solid / 1.5px solid → 2px solid
- Button padding: ensure min 15px vertical (already standard)
"""

import os, re, sys

# Files to process
TARGET_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_FILES = [f for f in os.listdir(TARGET_DIR) if f.endswith('.html')
              and f not in ('homepage-form-snippet.html',)]

def bump(html):
    original = html

    # 1. Form inputs/selects/textareas: 14.5px → 16px
    html = re.sub(
        r'(<(?:input|select|textarea)[^>]*font-size:)14\.5px',
        r'\g<1>16px', html
    )

    # 2. Inline input styles with 14.5px font-size (padding context)
    # Catches: padding:13px 14px;...font-size:14.5px
    html = re.sub(
        r'(padding:\d+px[\s\d\w;:]+font-size:)14\.5px',
        r'\g<1>16px', html
    )

    # 3. Fine print: font-size:12px → 13.5px (consent, captions, small text)
    html = re.sub(r'font-size:12px(?=;|")', 'font-size:13.5px', html)

    # 4. Even smaller fine print
    html = re.sub(r'font-size:11\.5px(?=;|")', 'font-size:13px', html)
    html = re.sub(r'font-size:11px(?=;|")', 'font-size:13px', html)

    # 5. Input borders: 1px solid → 2px solid, 1.5px solid → 2px solid
    html = re.sub(r'border:1px solid (#[a-fA-F0-9]+|var\([^)]+\))',
                  r'border:2px solid \1', html)
    html = re.sub(r'border:1\.5px solid (#[a-fA-F0-9]+|var\([^)]+\))',
                  r'border:2px solid \1', html)

    # 6. Uppercase label font-size (small caps labels like "FIRST NAME")
    # These are typically 12px with letter-spacing — bump to 13.5px
    html = re.sub(
        r'(text-transform:uppercase[^"]*font-size:)12px',
        r'\g<1>13.5px', html
    )
    html = re.sub(
        r'(font-size:12px[^"]*text-transform:uppercase)',
        lambda m: m.group(0).replace('font-size:12px', 'font-size:13.5px'),
        html
    )

    # 7. CSS class definitions for .ff label, .faq-q, etc.
    # In <style> blocks, bump 12px → 13.5px for labels
    html = re.sub(
        r'(\.ff label[^{]*\{[^}]*font-size:)12px',
        r'\g<1>13.5px', html
    )

    return html, html != original


changed = 0
for fname in sorted(HTML_FILES):
    path = os.path.join(TARGET_DIR, fname)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content, was_changed = bump(content)
        if was_changed:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'✅ {fname}')
            changed += 1
        else:
            print(f'   {fname} (no changes)')
    except Exception as e:
        print(f'❌ {fname}: {e}')

print(f'\nDone — {changed}/{len(HTML_FILES)} files updated.')
