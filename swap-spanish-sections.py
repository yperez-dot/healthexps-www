#!/usr/bin/env python3
"""
Swap GUÍAS and HERRAMIENTAS sections in es/recursos.html
"""

from pathlib import Path

filepath = Path('es/recursos.html')
lines = filepath.read_text(encoding='utf-8').splitlines(keepends=True)

# Find section boundaries
guias_start = None
herramientas_start = None
faq_start = None

for i, line in enumerate(lines):
    if '<!-- GUÍAS DE MEDICARE -->' in line:
        guias_start = i
    elif '<!-- HERRAMIENTAS Y RECURSOS -->' in line:
        herramientas_start = i
    elif '<!-- FAQ QUICK LINKS -->' in line or 'Preguntas Frecuentes por Tema' in line:
        if faq_start is None and herramientas_start is not None:
            faq_start = i
            break

print(f"Found sections:")
print(f"  GUÍAS starts at line {guias_start}")
print(f"  HERRAMIENTAS starts at line {herramientas_start}")
print(f"  FAQ/Next section starts at line {faq_start}")

if guias_start and herramientas_start and faq_start:
    # Extract sections
    before_guias = lines[:guias_start]
    guias_section = lines[guias_start:herramientas_start]
    herramientas_section = lines[herramientas_start:faq_start]
    after_herramientas = lines[faq_start:]
    
    # Reorder: before + HERRAMIENTAS + GUÍAS + after
    new_content = before_guias + herramientas_section + guias_section + after_herramientas
    
    # Write back
    filepath.write_text(''.join(new_content), encoding='utf-8')
    print("\n✅ Sections swapped successfully")
    print("  Order is now: HERRAMIENTAS → GUÍAS → FAQ")
else:
    print("\n❌ Could not find all section markers")

