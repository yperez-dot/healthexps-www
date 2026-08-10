#!/usr/bin/env python3
"""Batch fix script: header/footer standardization for 38 English pages."""

import re
import os
import sys

WORKDIR = '/home/medicare-ai-agent/.openclaw/workspace/healthexps-www'

# ─── Canonical footer from index.html ────────────────────────────────────────
CANONICAL_FOOTER = '''\
<!-- FOOTER -->
      <div id="site-footer" style="background:#fff;color:#241a30;padding:56px 56px 24px;border-top:1px solid #ece5f0">
        <div style="max-width:1160px;margin:0 auto">
          <div id="footer-grid" style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;gap:32px;margin-bottom:36px">
            <div>
              <img src="/images/logo.webp" alt="The Health Experts Insurance" style="height:70px;width:auto;margin-bottom:16px"/>
              <p style="font-size:13.5px;color:#6f6478;line-height:1.6;max-width:260px">Independent bilingual health insurance brokers. Office in Doral, FL.</p>
              <div style="display:flex;flex-direction:column;gap:4px;margin-top:14px;font-size:13.5px">
                <a href="tel:18003806821" style="color:#452068;font-weight:700">1-800-380-6821</a>
                <a href="https://wa.me/13054646888" style="color:#452068;font-weight:700" onclick="gtag(\'event\',\'whatsapp_click\',{\'page\':window.location.pathname})">WhatsApp</a>
                <a href="mailto:info@healthexps.com" style="color:#452068;font-weight:700">info@healthexps.com</a>
              </div>
              <p style="font-size:13.5px;color:#4a4051;margin-top:14px">1695 NW 110 Ave, Ste 224<br/>Doral, FL 33172</p>
            </div>
            <div>
              <div style="font-weight:700;font-size:12.5px;letter-spacing:.06em;margin-bottom:14px;color:#452068">MEDICARE</div>
              <div style="display:flex;flex-direction:column;gap:9px;font-size:13.5px">
                <a href="/medicare-plans-miami" style="cursor:pointer;color:#241a30;font-weight:700">Medicare Plans</a>
                <a href="/medicare-advantage-miami" style="color:#4a4051">Medicare Advantage</a>
                <a href="/medicare-supplement-miami" style="color:#4a4051">Medicare Supplement</a>
                <a href="/medicare-dual-eligible-miami" style="cursor:pointer;color:#4a4051">Dual Eligible (D-SNP)</a>
                <a href="/medicare-plan-finder" style="cursor:pointer;color:#4a4051">Medicare Plan Finder</a>
                <a href="/avmed-medicare-florida" style="color:#4a4051">AvMed Transition</a>
              </div>
            </div>
            <div>
              <div style="font-weight:700;font-size:12.5px;letter-spacing:.06em;margin-bottom:14px;color:#452068">MEDICARE GUIDES</div>
              <div style="display:flex;flex-direction:column;gap:9px;font-size:13.5px">
                <a href="/medicare/what-is-medicare" style="cursor:pointer;color:#4a4051">What Is Medicare</a>
                <a href="/medicare/new-to-medicare" style="cursor:pointer;color:#4a4051">New to Medicare</a>
                <a href="/medicare-irmaa-penalties" style="cursor:pointer;color:#4a4051">Medicare Costs &amp; IRMAA</a>
                <a href="/medicare-advantage-miami" style="cursor:pointer;color:#4a4051">Medicare Advantage Guide</a>
                <a href="/medicare-supplement-miami" style="cursor:pointer;color:#4a4051">Medicare Supplement Guide</a>
                <a href="/medicare-savings-program" style="cursor:pointer;color:#4a4051">Medicare Savings Program</a>
              </div>
            </div>
            <div>
              <div style="font-weight:700;font-size:12.5px;letter-spacing:.06em;margin-bottom:14px;color:#452068">MORE</div>
              <div style="display:flex;flex-direction:column;gap:9px;font-size:13.5px">
                <a href="/private-health-insurance-miami" style="cursor:pointer;color:#4a4051">Private Health Insurance</a>
                <a href="/aca-plans-miami" style="cursor:pointer;color:#4a4051">ACA Marketplace Plans</a>
                <a href="/cobra-alternatives-miami" style="cursor:pointer;color:#4a4051">COBRA Alternatives</a>
                <a href="/dental-vision-miami" style="cursor:pointer;color:#4a4051">Dental &amp; Vision</a>
                <a href="/medicare-agent-miami" style="cursor:pointer;color:#4a4051">About Us</a>
                <a href="/contact" style="cursor:pointer;color:#4a4051">Contact</a>
                <a href="/es/" style="color:#4a4051">Sitio en Espa&ntilde;ol</a>
              </div>
            </div>
          </div>
          <div style="border-top:1px solid #ece5f0;padding-top:20px;font-size:13px;color:#4a4051">
            \u00a9 2026 The Health Experts Insurance. <a href="/privacy" style="color:#452068;font-weight:600">Privacy Policy &amp; Terms</a>
          </div>
          <div style="padding-top:12px;font-size:13.5px;color:#a79db2;line-height:1.6">
            Medicare has not reviewed or endorsed this information. We do not offer every plan available in your area. We currently represent 14 organizations offering 82 products in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local SHIP program for information about all your options.
          </div>
        </div>
      </div>'''

# ─── Nav additions ────────────────────────────────────────────────────────────
DESKTOP_DENTAL = '<a href="/dental-vision-miami" style="padding:10px 14px;border-radius:8px;cursor:pointer;font-weight:600">Dental &amp; Vision</a>'
DESKTOP_LIFE   = '<a href="/life-insurance-miami" style="padding:10px 14px;border-radius:8px;cursor:pointer;font-weight:600">Life Insurance</a>'
DESKTOP_FEX    = '<a href="/final-expense-insurance" style="padding:10px 14px;border-radius:8px;cursor:pointer;font-weight:600">Final Expense</a>'

MOBILE_DENTAL  = '<a href="/dental-vision-miami" style="padding:11px 12px;border-radius:8px;color:#241a30;font-weight:600;font-size:15px">Dental &amp; Vision</a>'
MOBILE_LIFE    = '<a href="/life-insurance-miami" style="padding:11px 12px;border-radius:8px;color:#241a30;font-weight:600;font-size:15px">Life Insurance</a>'
MOBILE_FEX     = '<a href="/final-expense-insurance" style="padding:11px 12px;border-radius:8px;color:#241a30;font-weight:600;font-size:15px">Final Expense</a>'

# ─── Fix helpers ──────────────────────────────────────────────────────────────

def fix_emoji(content):
    content = content.replace('\U0001f4f1 WhatsApp', 'WhatsApp')
    content = content.replace('📱 WhatsApp', 'WhatsApp')
    content = content.replace('&#128241; WhatsApp', 'WhatsApp')
    return content

def fix_extra_cta(content):
    # Remove Schedule Free Consultation anchor from top bar
    content = re.sub(
        r'\s*<a[^>]*>Schedule Free Consultation[^<]*</a>',
        '', content
    )
    return content

def fix_nav_life(content):
    """Add Life Insurance + Final Expense to desktop nav after Dental & Vision (if missing)."""
    if 'life-insurance-miami' not in content:
        # Desktop nav
        if DESKTOP_DENTAL in content:
            content = content.replace(
                DESKTOP_DENTAL,
                DESKTOP_DENTAL + '\n            ' + DESKTOP_LIFE + '\n            ' + DESKTOP_FEX
            )
        # Mobile nav
        if MOBILE_DENTAL in content:
            content = content.replace(
                MOBILE_DENTAL,
                MOBILE_DENTAL + '\n      ' + MOBILE_LIFE + '\n      ' + MOBILE_FEX
            )
    return content

def fix_nav_fex(content):
    """Add Final Expense only (Life already present) to desktop+mobile nav if missing."""
    if 'final-expense-insurance' not in content and 'life-insurance-miami' in content:
        # Desktop
        content = content.replace(
            DESKTOP_LIFE,
            DESKTOP_LIFE + '\n            ' + DESKTOP_FEX
        )
        # Mobile
        content = content.replace(
            MOBILE_LIFE,
            MOBILE_LIFE + '\n      ' + MOBILE_FEX
        )
    return content

def find_div_end(content, open_pos):
    """
    Given the start position of '<div', find the position immediately after
    the matching '</div>'.
    """
    # Find end of opening tag
    tag_body_end = content.index('>', open_pos)
    depth = 1
    pos = tag_body_end + 1

    while pos < len(content) and depth > 0:
        next_open  = content.find('<div', pos)
        next_close = content.find('</div>', pos)
        if next_close == -1:
            return -1
        if next_open != -1 and next_open < next_close:
            # Peek: is this really a <div (not <divider etc)?
            after = content[next_open + 4]
            if after in ' \t\n\r>':
                depth += 1
            pos = next_open + 5
        else:
            depth -= 1
            pos = next_close + 6  # len('</div>') == 6
    return pos  # position after the final </div>

def fix_old_footer(content):
    """Replace the old footer-wrap block with the canonical site-footer."""

    # ── Strategy 1: <footer class="footer-wrap"> ... </footer> ───────────────
    # Also cover the comment before it (possibly with ===== markers or ── markers)
    pat_footer_tag = re.compile(
        r'(?:<!--\s*(?:={3,}\s+)?FOOTER(?:\s+={3,})?\s*-->[ \t]*\n\s*)?'
        r'<footer class="footer-wrap"[^>]*>.*?</footer>',
        re.DOTALL
    )
    m = pat_footer_tag.search(content)
    if m:
        return content[:m.start()] + CANONICAL_FOOTER + content[m.end():]

    # ── Strategy 2: <!-- FOOTER --> \n <div class="footer-wrap" ...> ─────────
    # This pattern has 0+ leading whitespace / comment then the div
    pat_comment = re.compile(
        r'<!--\s*(?:={3,}\s+)?(?:──\s+)?FOOTER(?:\s+(?:={3,}|──))?\s*-->[ \t]*\n',
        re.IGNORECASE
    )
    mc = pat_comment.search(content)
    if mc:
        # After the comment, find the <div class="footer-wrap"
        after_comment = content[mc.end():]
        # strip leading whitespace
        stripped = after_comment.lstrip()
        if stripped.startswith('<div class="footer-wrap"'):
            div_start = mc.end() + (len(after_comment) - len(stripped))
            div_end = find_div_end(content, div_start)
            if div_end > 0:
                # Replace from comment start to div end
                start = mc.start()
                return content[:start] + CANONICAL_FOOTER + content[div_end:]

    # ── Strategy 3: bare <div class="footer-wrap" no preceding comment ───────
    pat_bare_div = re.compile(r'<div class="footer-wrap"')
    mb = pat_bare_div.search(content)
    if mb:
        div_end = find_div_end(content, mb.start())
        if div_end > 0:
            return content[:mb.start()] + CANONICAL_FOOTER + content[div_end:]

    return content  # no old footer found


def remove_footer_css(content):
    """Remove .footer-wrap, .footer-grid, .footer-bottom CSS rules from <style> blocks."""
    # Remove individual CSS rules for these classes
    content = re.sub(
        r'\s*\.footer-wrap(?:-inner|-bottom|-grid)?\s*\{[^}]*\}',
        '', content
    )
    content = re.sub(
        r'\s*\.footer-grid\s*\{[^}]*\}',
        '', content
    )
    content = re.sub(
        r'\s*\.footer-bottom\s*\{[^}]*\}',
        '', content
    )
    content = re.sub(
        r'\s*\.footer-legal\s*\{[^}]*\}',
        '', content
    )
    content = re.sub(
        r'\s*\.footer-cms\s*\{[^}]*\}',
        '', content
    )
    content = re.sub(
        r'\s*\.footer-links-col\s*\{[^}]*\}',
        '', content
    )
    content = re.sub(
        r'\s*\.footer-col-label\s*\{[^}]*\}',
        '', content
    )
    # Remove /* FOOTER */ / /* ===== FOOTER ===== */ comments in style blocks
    content = re.sub(r'/\*\s*(?:={3,}\s+)?FOOTER(?:\s+={3,})?\s*\*/', '', content)
    return content


# ─── Page manifest ────────────────────────────────────────────────────────────
# Each entry: (relative_path, set_of_fixes)
# Fixes: 'EMOJI', 'EXTRA_CTA', 'OLD_FOOTER', 'NAV_NO_LIFE', 'NAV_NO_FEX'

PAGES = [
    ('404.html',                                          {'EMOJI'}),
    ('aca-plans-miami.html',                              {'EMOJI'}),
    ('avmed-medicare-florida.html',                       {'EMOJI', 'OLD_FOOTER'}),
    ('cobra-alternatives-miami.html',                     {'EMOJI'}),
    ('compare-medicare-plans.html',                       {'EMOJI'}),
    ('contact.html',                                      {'EXTRA_CTA', 'EMOJI', 'OLD_FOOTER'}),
    ('dental-vision-miami.html',                          {'EMOJI', 'OLD_FOOTER'}),
    ('enrollment-calculator.html',                        {'EMOJI', 'NAV_NO_LIFE', 'NAV_NO_FEX'}),
    ('faq.html',                                          {'EXTRA_CTA', 'EMOJI'}),
    ('final-expense-insurance.html',                      {'EMOJI', 'OLD_FOOTER'}),
    ('find-my-plan.html',                                 {'EMOJI'}),
    ('health-insurance-quiz.html',                        {'EMOJI'}),
    ('healthcare-insurance-for-seniors.html',             {'EXTRA_CTA', 'EMOJI'}),
    ('independent-health-insurance-broker.html',          {'EXTRA_CTA', 'NAV_NO_FEX'}),
    ('index.html',                                        {'EMOJI'}),
    ('irmaa-calculator.html',                             {'NAV_NO_LIFE', 'NAV_NO_FEX'}),
    ('medical-insurance-broker.html',                     {'EXTRA_CTA', 'EMOJI'}),
    ('medicare-advantage-miami.html',                     {'NAV_NO_LIFE', 'NAV_NO_FEX', 'OLD_FOOTER'}),
    ('medicare-advantage-vs-supplement-calculator.html',  {'EXTRA_CTA', 'EMOJI', 'NAV_NO_LIFE', 'NAV_NO_FEX', 'OLD_FOOTER'}),
    ('medicare-agent-miami.html',                         {'EMOJI', 'NAV_NO_FEX'}),
    ('medicare-annual-enrollment-2027.html',              {'EXTRA_CTA', 'EMOJI', 'OLD_FOOTER'}),
    ('medicare-dual-eligible-miami.html',                 {'EMOJI', 'NAV_NO_LIFE', 'NAV_NO_FEX'}),
    ('medicare-enrollment-calculator.html',               {'EMOJI', 'NAV_NO_LIFE', 'NAV_NO_FEX'}),
    ('medicare-enrollment-periods.html',                  {'EMOJI'}),
    ('medicare-irmaa-penalties.html',                     {'EMOJI'}),
    ('medicare-myths.html',                               {'EMOJI'}),
    ('medicare-plan-finder.html',                         {'EXTRA_CTA', 'EMOJI', 'OLD_FOOTER'}),
    ('medicare-plans-miami.html',                         {'EMOJI', 'NAV_NO_LIFE', 'NAV_NO_FEX', 'OLD_FOOTER'}),
    ('medicare-savings-program.html',                     {'EXTRA_CTA', 'EMOJI', 'NAV_NO_LIFE', 'NAV_NO_FEX', 'OLD_FOOTER'}),
    ('medicare-supplement-miami.html',                    {'NAV_NO_LIFE', 'NAV_NO_FEX', 'OLD_FOOTER'}),
    ('medicare/medicare-advantage-plans.html',            {'EMOJI', 'OLD_FOOTER'}),
    ('medicare/medicare-supplement-plans.html',           {'EMOJI', 'OLD_FOOTER'}),
    ('medicare/new-to-medicare.html',                     {'EXTRA_CTA', 'EMOJI', 'OLD_FOOTER'}),
    ('medicare/what-is-medicare.html',                    {'EMOJI', 'OLD_FOOTER'}),
    ('medigap-plan-calculator.html',                      {'EMOJI'}),
    ('privacy.html',                                      {'EXTRA_CTA', 'EMOJI', 'NAV_NO_LIFE', 'NAV_NO_FEX', 'OLD_FOOTER'}),
    ('private-health-insurance-miami.html',               {'EMOJI', 'OLD_FOOTER'}),
    ('resources.html',                                    {'EXTRA_CTA', 'EMOJI', 'NAV_NO_FEX', 'OLD_FOOTER'}),
]

# ─── Main ─────────────────────────────────────────────────────────────────────

def apply_fixes(rel_path, fixes):
    path = os.path.join(WORKDIR, rel_path)
    if not os.path.exists(path):
        return f'  SKIP (not found): {rel_path}'

    with open(path, 'r', encoding='utf-8') as f:
        original = f.read()

    content = original
    applied = []
    skipped = []

    if 'EMOJI' in fixes:
        before = content
        content = fix_emoji(content)
        if content != before:
            applied.append('EMOJI')
        else:
            skipped.append('EMOJI(not_found)')

    if 'EXTRA_CTA' in fixes:
        before = content
        content = fix_extra_cta(content)
        if content != before:
            applied.append('EXTRA_CTA')
        else:
            skipped.append('EXTRA_CTA(not_found)')

    if 'OLD_FOOTER' in fixes:
        before = content
        content = fix_old_footer(content)
        if content != before:
            content = remove_footer_css(content)
            applied.append('OLD_FOOTER')
        else:
            skipped.append('OLD_FOOTER(not_found)')

    if 'NAV_NO_LIFE' in fixes and 'NAV_NO_FEX' in fixes:
        before = content
        content = fix_nav_life(content)  # adds both Life + FEX
        if content != before:
            applied.append('NAV_NO_LIFE+FEX')
        else:
            skipped.append('NAV_NO_LIFE+FEX(not_found_or_already_present)')
    elif 'NAV_NO_FEX' in fixes:
        before = content
        content = fix_nav_fex(content)
        if content != before:
            applied.append('NAV_NO_FEX')
        else:
            skipped.append('NAV_NO_FEX(not_found_or_already_present)')
    elif 'NAV_NO_LIFE' in fixes:
        before = content
        content = fix_nav_life(content)
        if content != before:
            applied.append('NAV_NO_LIFE')
        else:
            skipped.append('NAV_NO_LIFE(not_found_or_already_present)')

    if content == original:
        return f'  NOCHANGE: {rel_path}'

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    parts = []
    if applied: parts.append('applied=' + ','.join(applied))
    if skipped:  parts.append('skipped=' + ','.join(skipped))
    return f'  OK  {rel_path} [{"; ".join(parts)}]'


def main():
    print(f'Processing {len(PAGES)} pages in {WORKDIR}')
    changed = 0
    nochange = 0
    errors = []

    for rel_path, fixes in PAGES:
        try:
            result = apply_fixes(rel_path, fixes)
            print(result)
            if result.startswith('  OK'):
                changed += 1
            else:
                nochange += 1
        except Exception as e:
            msg = f'  ERROR {rel_path}: {e}'
            print(msg)
            errors.append(msg)

    print(f'\nDone. {changed} changed, {nochange} unchanged, {len(errors)} errors.')
    if errors:
        print('Errors:')
        for e in errors:
            print(e)
        sys.exit(1)

if __name__ == '__main__':
    main()
