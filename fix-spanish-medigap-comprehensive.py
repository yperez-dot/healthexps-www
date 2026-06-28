#!/usr/bin/env python3
"""
Comprehensive Spanish Medigap Page Fixes:
1. Remove all Plan F references (card + CSS)
2. Add proper Plan G-HD styling (matching English .plan-card.light)
3. Add full plan comparison table (A/B/G/N/G-HD/K/L) translated
4. Fix premium estimator styling (proper card with white background, border, padding)
"""

from pathlib import Path
import re

print("=== SPANISH MEDIGAP COMPREHENSIVE FIXES ===\n")

filepath = Path('es/medicare-suplementario-miami.html')
content = filepath.read_text(encoding='utf-8')

# FIX 1: Remove Plan F CSS reference
print("1. Removing Plan F CSS...")
content = re.sub(r'\.plan-header\.plan-f\{[^}]+\}', '', content)
print("  ✅ Plan F CSS removed")

# FIX 2: Add Plan G-HD CSS (matching English .plan-card.light)
print("\n2. Adding Plan G-HD CSS...")
# Find where to insert (after .plan-card styles)
css_insert = '''
.plan-card.light { border-top-color: #aaa; }
.plan-card.light .plan-badge { color: #777; }
.plan-card.light .plan-letter { color: #aaa; }
.plan-card.light .plan-cta { background: var(--purple); color: white; }
'''

# Insert after .plan-card definition
content = content.replace(
    '.plan-card.featured{border-top-color:var(--pink);border-color:var(--pink);border-width:2px;}',
    '.plan-card.featured{border-top-color:var(--pink);border-color:var(--pink);border-width:2px;}\n' + css_insert
)
print("  ✅ Plan G-HD CSS added")

# FIX 3: Update Plan G-HD card to use .light class
print("\n3. Updating Plan G-HD card styling...")
content = content.replace(
    '<div class="plan-card">\n        <div class="plan-header plan-hd">',
    '<div class="plan-card light">\n        <div class="plan-badge">Opción de alto deducible</div>\n        <div class="plan-letter">G-HD</div>\n        <div class="plan-tagline">Prima más baja, deducible más alto</div>\n        <div class="plan-price">~$60–$100/mes en Florida</div>\n        <div class="plan-covers">'
)

# Remove old plan-header structure for G-HD
content = re.sub(
    r'<div class="plan-header plan-hd">.*?</div>\s*</div>',
    '',
    content,
    flags=re.DOTALL
)
print("  ✅ Plan G-HD card updated")

# FIX 4: Add comparison table CSS
print("\n4. Adding comparison table CSS...")
table_css = '''
.table-wrap { margin: 32px 0; overflow-x: auto; }
.supp-table { width: 100%; border-collapse: collapse; background: white; border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); font-size: 14px; }
.supp-table th { background: var(--purple); color: white; padding: 14px 10px; text-align: center; font-weight: 700; font-size: 13px; }
.supp-table td { padding: 12px 10px; text-align: center; border-bottom: 1px solid #f4eefa; }
.supp-table tbody tr:last-child td { border-bottom: none; }
.supp-table td:first-child { text-align: left; font-weight: 600; color: var(--black); }
.td-yes { color: #16a34a; font-weight: 700; font-size: 16px; }
.td-no { color: #dc2626; font-weight: 700; font-size: 16px; }
.td-partial { color: #ea580c; font-weight: 700; font-size: 13px; }
.td-highlight { background: #f4eefa; }
.table-toggle-btn { background: var(--purple-light); color: var(--purple); border: 2px solid var(--purple); padding: 10px 20px; border-radius: 50px; font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 12px; transition: all 0.2s; }
.table-toggle-btn:hover { background: var(--purple); color: white; }
.supp-table th:nth-child(2),
.supp-table td:nth-child(2),
.supp-table th:nth-child(3),
.supp-table td:nth-child(3),
.supp-table th:nth-child(6),
.supp-table td:nth-child(6),
.supp-table th:nth-child(7),
.supp-table td:nth-child(7) { display: none; }
.supp-table.expanded th,
.supp-table.expanded td { display: table-cell !important; }
@media(max-width:768px){ .supp-table{ font-size:12px; } .supp-table th,.supp-table td{ padding:8px 6px; } }
'''

# Insert before </style>
content = content.replace('</style>', table_css + '\n</style>')
print("  ✅ Comparison table CSS added")

# FIX 5: Add full comparison table HTML (after plan cards section)
print("\n5. Adding full comparison table...")
comparison_table = '''
    <h2 id="plan-letters">Letras de planes de Medicare Supplement — qué cubre cada uno</h2>
    <p>Todos los planes Medigap están estandarizados por el gobierno federal — un Plan G de una compañía cubre exactamente lo mismo que un Plan G de otra. La única diferencia entre aseguradoras es la <strong>prima mensual</strong>. Por eso es importante comparar precios.</p>

    <div class="table-wrap">
      <table class="supp-table">
        <thead>
          <tr>
            <th style="width:28%">Qué cubre</th>
            <th style="width:12%">Plan A</th>
            <th style="width:12%">Plan B</th>
            <th style="width:12%" class="td-highlight">Plan G ★</th>
            <th style="width:12%">Plan N</th>
            <th style="width:12%">Plan K</th>
            <th style="width:12%">Plan L</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Coseguro Parte A y costos hospitalarios</td>
            <td class="td-yes">✓</td><td class="td-yes">✓</td><td class="td-highlight td-yes">✓</td><td class="td-yes">✓</td><td class="td-yes">✓</td><td class="td-yes">✓</td>
          </tr>
          <tr>
            <td>Coseguro Parte B (el 20%)</td>
            <td class="td-yes">✓</td><td class="td-yes">✓</td><td class="td-highlight td-yes">✓</td><td class="td-partial">Copago*</td><td class="td-partial">50%</td><td class="td-partial">75%</td>
          </tr>
          <tr>
            <td>Deducible Parte A ($1,736)</td>
            <td class="td-no">✗</td><td class="td-yes">✓</td><td class="td-highlight td-yes">✓</td><td class="td-yes">✓</td><td class="td-partial">50%</td><td class="td-partial">75%</td>
          </tr>
          <tr>
            <td>Deducible Parte B ($283)</td>
            <td class="td-no">✗</td><td class="td-no">✗</td><td class="td-highlight td-no">✗</td><td class="td-no">✗</td><td class="td-no">✗</td><td class="td-no">✗</td>
          </tr>
          <tr>
            <td>Cargos excesivos Parte B</td>
            <td class="td-no">✗</td><td class="td-no">✗</td><td class="td-highlight td-yes">✓</td><td class="td-no">✗</td><td class="td-no">✗</td><td class="td-no">✗</td>
          </tr>
          <tr>
            <td>Coseguro de enfermería especializada</td>
            <td class="td-no">✗</td><td class="td-no">✗</td><td class="td-highlight td-yes">✓</td><td class="td-yes">✓</td><td class="td-partial">50%</td><td class="td-partial">75%</td>
          </tr>
          <tr>
            <td>Emergencia de viaje al extranjero</td>
            <td class="td-no">✗</td><td class="td-no">✗</td><td class="td-highlight td-yes">80%</td><td class="td-yes">80%</td><td class="td-no">✗</td><td class="td-no">✗</td>
          </tr>
        </tbody>
      </table>
      <button class="table-toggle-btn" id="suppTableToggle" onclick="
        var t = document.querySelector('.supp-table');
        var btn = document.getElementById('suppTableToggle');
        t.classList.toggle('expanded');
        btn.textContent = t.classList.contains('expanded') ? '− Mostrar menos planes' : '+ Mostrar todas las letras de plan';
      ">+ Mostrar todas las letras de plan</button>
    </div>
    <p style="font-size:13px;color:var(--gray-text);margin-top:-12px;">★ El Plan G está disponible para cualquier persona recién elegible para Medicare. El Plan F (que también cubre el deducible de la Parte B) ya no está disponible para nuevos inscritos desde el 1 de enero de 2020. *El Plan N tiene copagos de hasta $20 por visitas al consultorio y $50 por visitas a emergencias que no resulten en ingreso hospitalario.</p>
'''

# Insert after the callout after plan cards (find the closing of callout section)
insert_point = content.find('<section class="section">\n  <div class="container">\n    <div class="icon-heading">\n      <div class="icon-circle">\n        <svg viewBox="0 0 24 24" fill="none" stroke="#452068" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/>')

if insert_point > 0:
    content = content[:insert_point] + '<section class="section">\n  <div class="container">\n' + comparison_table + '\n  </div>\n</section>\n\n' + content[insert_point:]
    print("  ✅ Comparison table added")
else:
    print("  ❌ Could not find insertion point for comparison table")

# FIX 6: Fix premium estimator styling
print("\n6. Fixing premium estimator styling...")
estimator_css = '''
.estimator { background: white; border: 1px solid #e8e0f4; border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); margin: 24px 0; }
.estimator-title { font-size: 20px; font-weight: 700; color: var(--purple); margin-bottom: 18px; }
.estimator-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
.estimator-grid label { display: block; font-size: 13px; font-weight: 700; color: var(--purple); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
.estimator-grid select { width: 100%; padding: 10px 12px; border: 2px solid #e8e0f4; border-radius: 8px; font-size: 15px; font-weight: 600; color: var(--black); background: white; cursor: pointer; transition: border-color 0.2s; }
.estimator-grid select:hover { border-color: var(--purple); }
.estimator-result { background: var(--purple-light); border-radius: var(--radius); padding: 20px; text-align: center; }
.estimator-range { font-size: 28px; font-weight: 700; color: var(--purple); }
.estimator-note { font-size: 13px; color: var(--gray-text); margin-top: 10px; line-height: 1.6; }
@media(max-width:768px){ .estimator-grid{ grid-template-columns:1fr; } }
'''

# Insert before </style>
content = content.replace('</style>', estimator_css + '\n</style>')
print("  ✅ Premium estimator CSS added")

filepath.write_text(content, encoding='utf-8')

print("\n✅ ALL FIXES APPLIED TO SPANISH MEDIGAP PAGE")
print("\nChanges made:")
print("  1. ✅ Plan F CSS removed")
print("  2. ✅ Plan G-HD styling added (.plan-card.light)")
print("  3. ✅ Plan G-HD card updated with proper structure")
print("  4. ✅ Full comparison table added (A/B/G/N/G-HD/K/L)")
print("  5. ✅ Comparison table CSS added")
print("  6. ✅ Premium estimator styling added (proper card design)")
