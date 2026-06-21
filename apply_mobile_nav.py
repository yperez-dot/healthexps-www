#!/usr/bin/env python3
"""
Apply approved mobile nav CSS/JS from index.html to all pages.
Extracts the mobile nav <style> and <script> blocks and injects them.
"""

import os, glob, re

# Read the gold standard mobile nav from index.html
with open('index.html') as f:
    gold = f.read()

# Extract the mobile nav <style> block (after </header>)
style_start = gold.find('<style>\n .dropdown a:hover')
style_end = gold.find('</style>', style_start) + 8
MOBILE_NAV_STYLE = gold[style_start:style_end]

# Extract the mobile nav <script> block (after </header>)
# Find the script that has nav-toggle in it
scripts = []
for match in re.finditer(r'<script>(.*?)</script>', gold, re.DOTALL):
    if 'nav-toggle' in match.group(1) and 'scrollToTop' in match.group(1):
        scripts.append((match.start(), match.end(), match.group(0)))

if scripts:
    MOBILE_NAV_SCRIPT = scripts[0][2]  # Take the first matching script
else:
    print("ERROR: Could not find mobile nav script in index.html")
    exit(1)

print(f"Extracted mobile nav style: {len(MOBILE_NAV_STYLE)} chars")
print(f"Extracted mobile nav script: {len(MOBILE_NAV_SCRIPT)} chars")

SKIP_FILES = [
    'medigap-calculator.html',
    'irmaa-calculator.html',
    'enrollment-calculator.html',
    'medicare-myths.html',
]

files = (
    [f for f in glob.glob('*.html') if f not in SKIP_FILES and f != 'index.html'] +
    [f for f in glob.glob('es/*.html') if f not in [f'es/{s}' for s in SKIP_FILES]] +
    [f for f in glob.glob('medicare/*.html')] +
    [f for f in glob.glob('es/medicare/*.html')]
)

updated = 0

for fpath in sorted(files):
    if not os.path.exists(fpath):
        continue
        
    with open(fpath) as f:
        h = f.read()
    
    changed = False
    
    # Remove any existing mobile nav style blocks
    h = re.sub(r'<style>\s*\.dropdown a:hover.*?</style>', '', h, flags=re.DOTALL)
    
    # Remove any existing mobile nav script blocks (containing nav-toggle)
    # Find all script blocks
    def script_replacer(match):
        script_content = match.group(1)
        if 'nav-toggle' in script_content and 'scrollToTop' in script_content:
            return ''  # Remove it
        return match.group(0)  # Keep it
    
    h = re.sub(r'<script>(.*?)</script>', script_replacer, h, flags=re.DOTALL)
    
    # Find where to insert: after </header>
    header_end = h.find('</header>')
    if header_end < 0:
        print(f"  SKIP: {fpath} (no </header> tag)")
        continue
    
    # Insert mobile nav style and script after </header>
    insert_pos = header_end + len('</header>')
    h = h[:insert_pos] + '\n\n' + MOBILE_NAV_STYLE + '\n' + MOBILE_NAV_SCRIPT + h[insert_pos:]
    
    with open(fpath, 'w') as f:
        f.write(h)
    
    updated += 1
    print(f"  Updated: {fpath}")

print(f"\nTotal updated: {updated} files")
