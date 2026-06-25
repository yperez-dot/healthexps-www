#!/usr/bin/env python3
"""
Comprehensive site repair script
Fixes all audit issues before deployment
"""

import re
from pathlib import Path

SCROLL_TO_TOP_CODE = """
<button id="scrollToTop" aria-label="Back to top">↑</button>
<script>
(function(){
  const btn=document.getElementById('scrollToTop');
  if(!btn)return;
  window.addEventListener('scroll',function(){btn.style.display=window.pageYOffset>300?'block':'none';});
  btn.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});
  btn.addEventListener('mouseenter',function(){btn.style.background='#ff1090';btn.style.transform='translateY(-3px)';});
  btn.addEventListener('mouseleave',function(){btn.style.background='#452068';btn.style.transform='translateY(0)';});
})();
</script>"""

GA4_TAG = """<script async src="https://www.googletagmanager.com/gtag/js?id=G-SJSGF3E9MD"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-SJSGF3E9MD');
</script>"""

def add_scroll_to_top(filepath):
    """Add scroll-to-top button before </body>"""
    content = filepath.read_text(encoding='utf-8')
    
    if 'id="scrollToTop"' in content:
        return False  # Already has it
    
    # Insert before </body>
    content = content.replace('</body>', f'{SCROLL_TO_TOP_CODE}\n</body>')
    filepath.write_text(content, encoding='utf-8')
    return True

def add_canonical(filepath, url):
    """Add canonical tag in <head>"""
    content = filepath.read_text(encoding='utf-8')
    
    if 'rel="canonical"' in content:
        return False  # Already has it
    
    canonical_tag = f'<link rel="canonical" href="{url}">'
    
    # Try to insert after other <link> tags, or before </head>
    if '<link rel="alternate"' in content:
        content = re.sub(
            r'(<link rel="alternate"[^>]*>\s*)',
            f'{canonical_tag}\n\\1',
            content,
            count=1
        )
    elif '</head>' in content:
        content = content.replace('</head>', f'{canonical_tag}\n</head>')
    
    filepath.write_text(content, encoding='utf-8')
    return True

def remove_whatsapp_emoji(filepath):
    """Remove 💬 emoji from WhatsApp links"""
    content = filepath.read_text(encoding='utf-8')
    original = content
    
    # Remove emoji from various WhatsApp link patterns
    content = content.replace('💬 WhatsApp</a>', 'WhatsApp</a>')
    content = content.replace('💬 WhatsApp Us</a>', 'WhatsApp Us</a>')
    content = content.replace('>💬 WhatsApp<', '>WhatsApp<')
    
    if content != original:
        filepath.write_text(content, encoding='utf-8')
        return True
    return False

def update_footer_tagline(filepath):
    """Update footer tagline to 'health insurance brokers'"""
    content = filepath.read_text(encoding='utf-8')
    original = content
    
    # Update English tagline
    content = content.replace(
        'Independent bilingual Medicare brokers',
        'Independent bilingual health insurance brokers'
    )
    
    # Update Spanish variations
    content = content.replace(
        'Corredores bilingües independientes de Medicare',
        'Corredores bilingües independientes de seguros de salud'
    )
    
    if content != original:
        filepath.write_text(content, encoding='utf-8')
        return True
    return False

def main():
    print("=== COMPREHENSIVE SITE REPAIR ===\n")
    
    # 1. Add scroll-to-top to pages missing it
    print("1. Adding scroll-to-top buttons...")
    scroll_pages = [
        "enrollment-calculator.html",
        "es/corredor-de-seguros-de-salud-miami.html",
        "es/medicare-medicaid-miami.html",
        "healthcare-insurance-for-seniors.html",
        "independent-health-insurance-broker.html",
        "irmaa-calculator.html",
        "medical-insurance-broker.html",
        "medicare-advantage-vs-supplement-calculator.html",
        "medicare-myths.html",
        "medigap-plan-calculator.html"
    ]
    
    scroll_fixed = 0
    for page in scroll_pages:
        filepath = Path(page)
        if filepath.exists():
            if add_scroll_to_top(filepath):
                print(f"  ✅ {page}")
                scroll_fixed += 1
            else:
                print(f"  ⏭️  {page} (already has)")
        else:
            print(f"  ❌ {page} (not found)")
    
    print(f"\nScroll-to-top added: {scroll_fixed} pages\n")
    
    # 2. Add canonical tags
    print("2. Adding canonical tags...")
    canonical_pages = {
        "index.html": "https://www.healthexps.com/",
        "irmaa-calculator.html": "https://www.healthexps.com/irmaa-calculator",
        "medicare-advantage-vs-supplement-calculator.html": "https://www.healthexps.com/medicare-advantage-vs-supplement-calculator",
        "medigap-plan-calculator.html": "https://www.healthexps.com/medigap-plan-calculator"
    }
    
    canonical_fixed = 0
    for page, url in canonical_pages.items():
        filepath = Path(page)
        if filepath.exists():
            if add_canonical(filepath, url):
                print(f"  ✅ {page} → {url}")
                canonical_fixed += 1
            else:
                print(f"  ⏭️  {page} (already has)")
        else:
            print(f"  ❌ {page} (not found)")
    
    print(f"\nCanonical tags added: {canonical_fixed} pages\n")
    
    # 3. Remove WhatsApp emoji from all files
    print("3. Removing WhatsApp emoji from footer...")
    all_files = list(Path('.').glob('*.html')) + list(Path('.').glob('*/*.html'))
    emoji_fixed = 0
    
    for filepath in all_files:
        if 'node_modules' not in str(filepath):
            if remove_whatsapp_emoji(filepath):
                emoji_fixed += 1
    
    print(f"  ✅ Emoji removed from {emoji_fixed} files\n")
    
    # 4. Update footer taglines
    print("4. Updating footer taglines...")
    tagline_fixed = 0
    
    for filepath in all_files:
        if 'node_modules' not in str(filepath):
            if update_footer_tagline(filepath):
                tagline_fixed += 1
    
    print(f"  ✅ Tagline updated in {tagline_fixed} files\n")
    
    print("=== REPAIR COMPLETE ===")
    print(f"Total changes:")
    print(f"  - Scroll-to-top: {scroll_fixed}")
    print(f"  - Canonical tags: {canonical_fixed}")
    print(f"  - WhatsApp emoji: {emoji_fixed}")
    print(f"  - Footer taglines: {tagline_fixed}")

if __name__ == '__main__':
    main()
