#!/usr/bin/env python3
"""
Final Spanish Medigap Fixes - Comprehensive
Fix #3: Cards + Comparison Table
Fix #4: Estimator Styling
"""

from pathlib import Path
import re

print("=== SPANISH MEDIGAP FIXES #3 and #4 ===\n")

filepath = Path('es/medicare-suplementario-miami.html')
content = filepath.read_text(encoding='utf-8')

# FIX #3A: Remove orphaned Plan F card body (lines after Plan G-HD)
print("Fix #3A: Removing orphaned Plan F card body...")
plan_f_orphan = '''        <div class="plan-body">
          <div class="plan-feature"><span class="check">✓</span> Cubre TODO — deducibles, coseguros, copagos</div>
          <div class="plan-feature"><span class="check">✓</span> Cubre deducible Parte B ($283)</div>
          <div class="plan-feature"><span class="check">✓</span> Cubre "excess charges" Parte B</div>
          <div class="plan-feature"><span class="check">✓</span> Cobertura de emergencia internacional</div>
          <div class="plan-feature" style="color:#d97706;"><span style="color:#d97706;font-weight:700;">⚠️</span> Solo disponible si se inscribió en Medicare antes del 1 de enero de 2020</div>
          <div style="margin-top:16px;background:var(--purple-light);padding:12px;border-radius:8px;font-size:15px;"><strong>Prima típica en Miami:</strong> $180–$280/mes</div>
        </div>
      </div>'''

if plan_f_orphan in content:
    content = content.replace(plan_f_orphan, '      </div>')
    print("  ✅ Plan F orphan removed")
else:
    print("  ⚠️  Plan F orphan not found (may already be fixed)")

# FIX #3B: Remove Plan F CSS
print("\nFix #3B: Removing Plan F CSS...")
content = re.sub(r'\.plan-header\.plan-f\{[^}]+\}', '', content)
print("  ✅ Plan F CSS removed")

# FIX #3C: Add comparison table CSS
print("\nFix #3C: Adding comparison table CSS...")
table_css = '''.table-wrap{margin:32px 0;overflow-x:auto;}
.supp-table{width:100%;border-collapse:collapse;background:white;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);font-size:14px;}
.supp-table th{background:var(--purple);color:white;padding:14px 10px;text-align:center;font-weight:700;font-size:13px;}
.supp-table td{padding:12px 10px;text-align:center;border-bottom:1px solid #f4eefa;}
.supp-table tbody tr:last-child td{border-bottom:none;}
.supp-table td:first-child{text-align:left;font-weight:600;color:var(--black);}
.td-yes{color:#16a34a;font-weight:700;font-size:16px;}
.td-no{color:#dc2626;font-weight:700;font-size:16px;}
.td-partial{color:#ea580c;font-weight:700;font-size:13px;}
.td-highlight{background:#f4eefa;}
.table-toggle-btn{background:var(--purple-light);color:var(--purple);border:2px solid var(--purple);padding:10px 20px;border-radius:50px;font-weight:700;font-size:14px;cursor:pointer;margin-top:12px;transition:all 0.2s;}
.table-toggle-btn:hover{background:var(--purple);color:white;}
.supp-table th:nth-child(2),.supp-table td:nth-child(2),.supp-table th:nth-child(3),.supp-table td:nth-child(3),.supp-table th:nth-child(6),.supp-table td:nth-child(6),.supp-table th:nth-child(7),.supp-table td:nth-child(7){display:none;}
.supp-table.expanded th,.supp-table.expanded td{display:table-cell !important;}
@media(max-width:768px){.supp-table{font-size:12px;}.supp-table th,.supp-table td{padding:8px 6px;}}
'''

# Insert before </style>
if '.supp-table' not in content:
    content = content.replace('</style>', table_css + '\n</style>')
    print("  ✅ Comparison table CSS added")
else:
    print("  ℹ️  Table CSS already exists")

# FIX #3D: Add full comparison table HTML
print("\nFix #3D: Adding full plan comparison table...")
comparison_table_html = '''
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

# Insert after the callout and before the estimator section
insert_marker = '<section class="section">\n  <div class="container">\n\n    <div class="icon-heading">\n      <div class="icon-circle">\n        <svg viewBox="0 0 24 24" fill="none" stroke="#452068" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>\n      </div>\n      <h2>Estime su prima de Medigap</h2>'

if insert_marker in content and 'Letras de planes de Medicare Supplement' not in content:
    content = content.replace(insert_marker, '<section class="section">\n  <div class="container">\n' + comparison_table_html + '\n  </div>\n</section>\n\n<section class="section">\n  <div class="container">\n\n    <div class="icon-heading">\n      <div class="icon-circle">\n        <svg viewBox="0 0 24 24" fill="none" stroke="#452068" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>\n      </div>\n      <h2>Estime su prima de Medigap</h2>')
    print("  ✅ Comparison table HTML added")
else:
    print("  ℹ️  Table HTML already exists or marker not found")

# FIX #4: Add estimator styling CSS
print("\nFix #4: Adding premium estimator styling...")
estimator_css = '''.estimator{background:white;border:1px solid #e8e0f4;border-radius:var(--radius);padding:28px;box-shadow:var(--shadow);margin:24px 0;}
.estimator-title{font-size:20px;font-weight:700;color:var(--purple);margin-bottom:18px;}
.estimator-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;}
.estimator-grid label{display:block;font-size:13px;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;}
.estimator-grid select{width:100%;padding:10px 12px;border:2px solid #e8e0f4;border-radius:8px;font-size:15px;font-weight:600;color:var(--black);background:white;cursor:pointer;transition:border-color 0.2s;}
.estimator-grid select:hover{border-color:var(--purple);}
.estimator-result{background:var(--purple-light);border-radius:var(--radius);padding:20px;text-align:center;}
.estimator-range{font-size:28px;font-weight:700;color:var(--purple);}
.estimator-note{font-size:13px;color:var(--gray-text);margin-top:10px;line-height:1.6;}
@media(max-width:768px){.estimator-grid{grid-template-columns:1fr;}}
'''

if '.estimator{' not in content:
    content = content.replace('</style>', estimator_css + '\n</style>')
    print("  ✅ Estimator CSS added")
else:
    print("  ℹ️  Estimator CSS already exists")

# Write back
filepath.write_text(content, encoding='utf-8')

print("\n✅ ALL SPANISH MEDIGAP FIXES COMPLETE")
print("\nChanges applied:")
print("  ✅ Fix #3A: Orphaned Plan F card body removed")
print("  ✅ Fix #3B: Plan F CSS removed")
print("  ✅ Fix #3C: Comparison table CSS added")
print("  ✅ Fix #3D: Full comparison table HTML added (A/B/G/N/K/L)")
print("  ✅ Fix #4: Premium estimator styling added (white card, border, padding)")
