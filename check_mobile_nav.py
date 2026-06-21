#!/usr/bin/env python3
"""
MOBILE NAV PROTECTION SCRIPT
Run before EVERY push: python3 check_mobile_nav.py
If any check fails, DO NOT push until fixed.

Usage:
  python3 check_mobile_nav.py           # Check all pages
  python3 check_mobile_nav.py index.html # Check one page
"""

import sys, os, re, glob

# ============================================================
# REQUIRED STRINGS - these MUST exist in every HTML page
# ============================================================
REQUIRED_CSS = [
  "position: fixed !important",  # Drawer must be fixed, not absolute
  "left: 15%",                   # Drawer starts at 15% from left
  "width: 85%",                  # Drawer is 85% wide
  "max-width: none",             # No max-width cap (this broke it before)
  "white-space: nowrap",         # Text must not wrap/truncate
  "overflow: visible",           # Text must not be cut off
  "font-size: 18px",             # Main links 18px
  "font-size: 16px",             # Dropdown links 16px
  "gap: 12px",                   # Spacing between items
  "padding: 56px 24px 24px",     # Top padding for X button
  "z-index: 999",                # Drawer above everything
]

REQUIRED_JS = [
  "nav-toggle",                  # Hamburger toggle exists
  "nav-links",                   # Nav links element exists
  "nav-close-btn",               # X button exists
  "has-dropdown",                # Dropdown class used
  "stopPropagation",             # Prevents flicker bug
  "classList.toggle('open')",    # Opens drawer
  "classList.remove('open')",    # Closes drawer
  "window.innerWidth<=768",      # Mobile-only check
]

FORBIDDEN_CSS = [
  "max-width: 400px",            # This capped drawer width (broke it)
  "max-width: 290px",            # Old narrow drawer (broke it)
  "width: 100%; max-width:",     # Pattern that caused truncation
]

FORBIDDEN_JS = [
  "openMenu(",                   # Old function names (caused conflicts)
  "closeMenu(",
]

# ============================================================
# SKIP THESE FILES (they have custom headers)
# ============================================================
SKIP_FILES = [
  'medigap-calculator.html',
  'irmaa-calculator.html',
  'enrollment-calculator.html',
  'medicare-myths.html',
  'es/enrollment-calculator.html',
  'es/mitos-medicare.html',
  'find-my-plan.html',
  'es/find-my-plan.html',
  'es/buscador-de-planes.html',
]

def check_file(fpath):
  with open(fpath) as f:
    h = f.read()

  errors = []
  warnings = []

  # Extract CSS between ALL <style> tags (not just first)
  style_matches = re.findall(r'<style>(.*?)</style>', h, re.DOTALL)
  css = ''.join(style_matches) if style_matches else ''

  # Extract JS between ALL <script> tags
  scripts = re.findall(r'<script>(.*?)</script>', h, re.DOTALL)
  js = ''.join(scripts) if scripts else ''

  # Check mobile media query exists
  if '@media (max-width: 768px)' not in css and '@media(max-width:768px)' not in css:
    errors.append("MISSING: @media (max-width: 768px) block")

  if '@media (min-width: 769px)' not in css and '@media(min-width:769px)' not in css:
    errors.append("MISSING: @media (min-width: 769px) desktop guarantee block")

  # Check required CSS strings
  for req in REQUIRED_CSS:
    if req not in css:
      errors.append(f"MISSING CSS: '{req}'")

  # Check required JS strings
  for req in REQUIRED_JS:
    if req not in js:
      errors.append(f"MISSING JS: '{req}'")

  # Check forbidden CSS strings
  for forbidden in FORBIDDEN_CSS:
    if forbidden in css:
      errors.append(f"FORBIDDEN CSS FOUND: '{forbidden}' — this broke the nav before!")

  # Check forbidden JS strings
  for forbidden in FORBIDDEN_JS:
    if forbidden in js:
      warnings.append(f"WARNING JS: '{forbidden}' — old function name, may cause conflicts")

  # Check nav HTML elements exist
  if 'id="nav-toggle"' not in h:
    errors.append("MISSING HTML: id='nav-toggle' (hamburger button)")
  if 'id="nav-links"' not in h:
    errors.append("MISSING HTML: id='nav-links' (nav list)")
  if 'id="nav-close-btn"' not in h:
    errors.append("MISSING HTML: id='nav-close-btn' (X close button)")
  if 'has-dropdown' not in h:
    errors.append("MISSING HTML: class='has-dropdown' on Insurance/Guides li elements")

  return errors, warnings

# ============================================================
# MAIN
# ============================================================
def main():
  if len(sys.argv) > 1:
    files = sys.argv[1:]
  else:
    files = (
      [f for f in glob.glob('*.html') if f not in SKIP_FILES] +
      [f for f in glob.glob('es/*.html') if f not in SKIP_FILES] +
      [f for f in glob.glob('medicare/*.html')] +
      [f for f in glob.glob('es/medicare/*.html')]
    )

  total = 0
  failed = 0
  warned = 0

  print("=" * 60)
  print("MOBILE NAV PROTECTION CHECK")
  print("=" * 60)

  for fpath in sorted(files):
    if not os.path.exists(fpath):
      continue
    if any(skip in fpath for skip in SKIP_FILES):
      continue

    errors, warnings = check_file(fpath)
    total += 1

    if errors:
      failed += 1
      print(f"\n❌ FAIL: {fpath}")
      for e in errors:
        print(f"   → {e}")
    elif warnings:
      warned += 1
      print(f"\n⚠️  WARN: {fpath}")
      for w in warnings:
        print(f"   → {w}")
    else:
      print(f"✅ PASS: {fpath}")

  print("\n" + "=" * 60)
  print(f"RESULTS: {total} files checked")
  print(f"  ✅ Passed: {total - failed - warned}")
  print(f"  ⚠️  Warned: {warned}")
  print(f"  ❌ Failed: {failed}")
  print("=" * 60)

  if failed > 0:
    print("\n🚫 DO NOT PUSH — fix all failures first!")
    print("Run: python3 check_mobile_nav.py <filename> to check one file")
    sys.exit(1)
  else:
    print("\n✅ ALL CLEAR — safe to push!")
    sys.exit(0)

if __name__ == '__main__':
  main()
