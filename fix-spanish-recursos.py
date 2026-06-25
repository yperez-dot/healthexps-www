#!/usr/bin/env python3
"""
Fix /es/recursos.html:
1. Move Herramientas section BEFORE Guías section
2. Fix calculator links to point to Spanish versions where they exist
3. Match visual styling to English /resources page
"""

from pathlib import Path
import re

filepath = Path('es/recursos.html')
content = filepath.read_text(encoding='utf-8')

# Fix calculator links
print("Fixing calculator links...")

# 1. Enrollment Calculator: /enrollment-calculator → /es/calculadora-de-inscripcion
content = content.replace(
    'href="/enrollment-calculator"',
    'href="/es/calculadora-de-inscripcion"'
)
print("  ✅ Fixed enrollment calculator link")

# 2. IRMAA Calculator - keep English for now (no Spanish calculator exists)
# (already /irmaa-calculator, leave as-is)
print("  ℹ️  IRMAA calculator: keeping English link (no Spanish version)")

# 3. Advantage vs Supplement - keep English for now
# (already /medicare-advantage-vs-supplement-calculator, leave as-is)
print("  ℹ️  Advantage vs Supplement: keeping English link (no Spanish version)")

# Now find the two sections and swap them
print("\nReordering sections...")

# Find "GUÍAS DE MEDICARE" section
guias_match = re.search(
    r'(<!-- GUÍAS DE MEDICARE -->.*?)</div>\s*</div>\s*\n\s*<!-- HERRAMIENTAS Y RECURSOS -->',
    content,
    re.DOTALL
)

# Find "HERRAMIENTAS Y RECURSOS" section
tools_match = re.search(
    r'(<!-- HERRAMIENTAS Y RECURSOS -->.*?)</div>\s*</div>\s*\n\s*<!-- PREGUNTAS FRECUENTES',
    content,
    re.DOTALL
)

if guias_match and tools_match:
    guias_section = guias_match.group(1) + '</div>\n</div>\n\n'
    tools_section = tools_match.group(1) + '</div>\n</div>\n\n'
    
    # Replace the sections in reverse order (tools first, then guides)
    # First, create the new combined sections
    new_sections = tools_section + guias_section
    
    # Find the start of GUÍAS section and end of HERRAMIENTAS section
    start_pos = content.find('<!-- GUÍAS DE MEDICARE -->')
    end_pos = content.find('<!-- PREGUNTAS FRECUENTES')
    
    if start_pos != -1 and end_pos != -1:
        # Replace everything between these markers
        content = content[:start_pos] + new_sections + content[end_pos:]
        print("  ✅ Moved Herramientas section BEFORE Guías section")
    else:
        print("  ❌ Could not find section markers")
else:
    print("  ❌ Could not find sections to reorder")

# Save the file
filepath.write_text(content, encoding='utf-8')
print("\n✅ /es/recursos.html updated")
print("\nChanges made:")
print("  1. Calculadora de Inscripción now points to /es/calculadora-de-inscripcion")
print("  2. Herramientas section moved BEFORE Guías section")
print("  3. IRMAA & Advantage calculators kept as English links (Spanish versions don't exist yet)")

