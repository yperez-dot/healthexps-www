#!/usr/bin/env python3
"""
Add headers and footers to pages missing them
"""

from pathlib import Path
import re

# Load templates
header_en = Path('/tmp/header_en.html').read_text(encoding='utf-8')
header_es = Path('/tmp/header_es.html').read_text(encoding='utf-8')
footer_en = Path('/tmp/footer_en.html').read_text(encoding='utf-8')
footer_es = Path('/tmp/footer_es.html').read_text(encoding='utf-8')

# Navigation script that goes before </body>
nav_script = """<script>
var _nt=document.getElementById('nav-toggle');
var _nl=document.getElementById('nav-links');
if(_nt && _nl){
 _nt.addEventListener('click',function(){
  _nl.classList.toggle('open');
 });
 var _nc=document.getElementById('nav-close-btn');
 if(_nc){
  _nc.addEventListener('click',function(){
   _nl.classList.remove('open');
  });
 }
 var _dd=document.querySelectorAll('.has-dropdown');
 for(var i=0;i<_dd.length;i++){
  _dd[i].addEventListener('click',function(e){
   if(window.innerWidth<=768){
    e.stopPropagation();
    this.classList.toggle('open');
   }
  });
 }
 document.addEventListener('click',function(e){
  if(window.innerWidth<=768 && !e.target.closest('#nav-links') && !e.target.closest('#nav-toggle')){
   _nl.classList.remove('open');
  }
 }
});

var _st=document.getElementById('scrollToTop');
if(_st){
 window.addEventListener('scroll',function(){_st.style.display=window.scrollY>400?'flex':'none';});
 _st.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});
}

var _navLinks=document.querySelectorAll('#nav-links a');
for(var k=0;k<_navLinks.length;k++){
 _navLinks[k].addEventListener('click',function(){
  if(window.innerWidth<=768 && !this.parentElement.classList.contains('has-dropdown')){
   _nl.classList.remove('open');
  }
 });
}
</script>"""

def add_header(filepath, header_content, lang='en'):
    """Add header after <body> tag"""
    content = filepath.read_text(encoding='utf-8')
    
    # Check if already has header
    if '<header' in content or '<nav' in content:
        print(f"  ⏭️  {filepath} already has header")
        return False
    
    # Find <body> tag and insert header after it
    if '<body>' in content:
        content = content.replace('<body>', f'<body>\n\n{header_content}\n')
    elif re.search(r'<body[^>]*>', content):
        content = re.sub(r'(<body[^>]*>)', f'\\1\n\n{header_content}\n', content)
    else:
        print(f"  ❌ {filepath}: No <body> tag found")
        return False
    
    filepath.write_text(content, encoding='utf-8')
    return True

def add_footer(filepath, footer_content):
    """Add footer before scroll-to-top button or </body>"""
    content = filepath.read_text(encoding='utf-8')
    
    # Check if already has footer
    if '<footer' in content:
        print(f"  ⏭️  {filepath} already has footer")
        return False
    
    # Insert footer before scroll-to-top button if present, otherwise before </body>
    if 'id="scrollToTop"' in content:
        content = content.replace('<button id="scrollToTop"', f'{footer_content}\n\n<button id="scrollToTop"')
    elif '</body>' in content:
        content = content.replace('</body>', f'{footer_content}\n\n{nav_script}\n</body>')
    else:
        print(f"  ❌ {filepath}: No </body> tag found")
        return False
    
    filepath.write_text(content, encoding='utf-8')
    return True

def main():
    print("=== ADDING HEADERS AND FOOTERS TO 9 PAGES ===\n")
    
    # English pages needing headers
    print("1. Adding English headers...")
    en_header_pages = [
        "healthcare-insurance-for-seniors.html",
        "independent-health-insurance-broker.html",
        "medical-insurance-broker.html"
    ]
    
    en_header_count = 0
    for page in en_header_pages:
        filepath = Path(page)
        if filepath.exists():
            if add_header(filepath, header_en, 'en'):
                print(f"  ✅ {page}")
                en_header_count += 1
        else:
            print(f"  ❌ {page} not found")
    
    print(f"\nEnglish headers added: {en_header_count}\n")
    
    # Spanish pages needing headers
    print("2. Adding Spanish headers...")
    es_header_pages = [
        "es/buscador-de-planes.html",
        "es/calculadora-de-inscripcion.html",
        "es/corredor-de-seguros-de-salud-miami.html",
        "es/encuentra-mi-plan.html",
        "es/medicare-medicaid-miami.html"
    ]
    
    es_header_count = 0
    for page in es_header_pages:
        filepath = Path(page)
        if filepath.exists():
            if add_header(filepath, header_es, 'es'):
                print(f"  ✅ {page}")
                es_header_count += 1
        else:
            print(f"  ❌ {page} not found")
    
    print(f"\nSpanish headers added: {es_header_count}\n")
    
    # Spanish pages needing footers
    print("3. Adding Spanish footers...")
    es_footer_pages = [
        "es/buscador-de-planes.html",
        "es/calculadora-de-inscripcion.html",
        "es/encuentra-mi-plan.html",
        "es/medicare-medicaid-miami.html",
        "es/mitos-medicare.html"
    ]
    
    es_footer_count = 0
    for page in es_footer_pages:
        filepath = Path(page)
        if filepath.exists():
            if add_footer(filepath, footer_es):
                print(f"  ✅ {page}")
                es_footer_count += 1
        else:
            print(f"  ❌ {page} not found")
    
    print(f"\nSpanish footers added: {es_footer_count}\n")
    
    print("=== COMPLETE ===")
    print(f"Total added:")
    print(f"  - English headers: {en_header_count}/3")
    print(f"  - Spanish headers: {es_header_count}/5")
    print(f"  - Spanish footers: {es_footer_count}/5")
    print(f"  - Total: {en_header_count + es_header_count + es_footer_count}/13")

if __name__ == '__main__':
    main()
