#!/usr/bin/env python3
"""
Fix remaining 2 Spanish pages with incomplete headers
"""

from pathlib import Path
import re

# Load Spanish header template
header_es = Path('/tmp/header_es.html').read_text(encoding='utf-8')

def replace_simple_header(filepath):
    """Replace simple header with full navigation header"""
    content = filepath.read_text(encoding='utf-8')
    
    # Find and replace the simple <header class="header">...</header>
    pattern = r'<header class="header">.*?</header>'
    
    if re.search(pattern, content, re.DOTALL):
        # Replace simple header with full header
        content = re.sub(pattern, header_es, content, flags=re.DOTALL)
        filepath.write_text(content, encoding='utf-8')
        return True
    else:
        print(f"  ❌ {filepath}: No simple header found to replace")
        return False

def main():
    print("=== REPLACING SIMPLE HEADERS WITH FULL NAVIGATION ===\n")
    
    pages = [
        "es/buscador-de-planes.html",
        "es/calculadora-de-inscripcion.html"
    ]
    
    fixed = 0
    for page in pages:
        filepath = Path(page)
        if filepath.exists():
            if replace_simple_header(filepath):
                print(f"  ✅ {page}")
                fixed += 1
        else:
            print(f"  ❌ {page} not found")
    
    print(f"\nHeaders replaced: {fixed}/2\n")

if __name__ == '__main__':
    main()
