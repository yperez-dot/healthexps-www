#!/usr/bin/env python3
"""
Fix Medicare Supplement pages:
1. Remove Plan F from Spanish page, replace with Plan G-HD
2. Add premium estimator to Spanish page
"""

from pathlib import Path
import re

# Plan G-HD card for Spanish (replacing Plan F)
PLAN_HD_SPANISH = """      <div class="plan-card">
        <div class="plan-header plan-hd">
          <div class="plan-tag">Opción de alto deducible</div>
          <h3>Plan G-HD</h3>
          <div class="plan-note">Prima más baja, deducible más alto</div>
        </div>
        <div class="plan-body">
          <div class="plan-feature"><span class="check">✓</span> Misma cobertura que Plan G</div>
          <div class="plan-feature"><span class="cross">✗</span> Debe pagar deducible de $2,950 primero (2026)</div>
          <div class="plan-feature"><span class="check">✓</span> Después del deducible — paga como Plan G</div>
          <div class="plan-feature"><span class="check">✓</span> Ideal para personas sanas con poco uso médico</div>
          <div class="plan-feature"><span class="check">✓</span> El costo mensual más bajo posible</div>
          <div class="plan-feature"><span class="cross">✗</span> Más riesgo financiero si se enferma gravemente</div>
          <div style="margin-top:16px;background:var(--purple-light);padding:12px;border-radius:8px;font-size:15px;"><strong>Prima típica en Miami:</strong> $60–$100/mes</div>
        </div>
      </div>"""

# Premium estimator for Spanish
ESTIMATOR_SPANISH = """
    <div class="icon-heading">
      <div class="icon-circle">
        <svg viewBox="0 0 24 24" fill="none" stroke="#452068" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      </div>
      <h2>Estime su prima de Medigap</h2>
    </div>
    <p>Las primas de Medigap varían según la edad, el uso de tabaco y la aseguradora. Use este estimador para obtener un rango aproximado para Florida:</p>

    <div class="estimator">
      <div class="estimator-title">Estimador de Primas Medigap — Florida 2026</div>
      <p style="font-size:14px;color:#555;margin-bottom:18px;line-height:1.6;">📌 <strong>Nota:</strong> Las personas con ingresos altos pagan recargos IRMAA además de estas primas. Ingresos superiores a $106,000 (individual) o $212,000 (pareja) resultan en costos más altos. <a href="/es/medicare/costos-de-medicare" style="color:#452068;font-weight:600;">Aprenda sobre IRMAA →</a></p>
      <div class="estimator-grid">
        <div>
          <label for="est-age-es">Edad</label>
          <select id="est-age-es" onchange="updateEstimateES()">
            <option value="65">65</option>
            <option value="67">67–69</option>
            <option value="70">70–74</option>
            <option value="75">75–79</option>
            <option value="80">80+</option>
          </select>
        </div>
        <div>
          <label for="est-plan-es">Plan</label>
          <select id="est-plan-es" onchange="updateEstimateES()">
            <option value="G">Plan G</option>
            <option value="N">Plan N</option>
            <option value="HD">Plan G Alto Deducible</option>
          </select>
        </div>
        <div>
          <label for="est-tobacco-es">¿Usa tabaco?</label>
          <select id="est-tobacco-es" onchange="updateEstimateES()">
            <option value="no">No</option>
            <option value="yes">Sí</option>
          </select>
        </div>
      </div>
      <div class="estimator-result">
        <div>
          <div style="font-size:12px;color:var(--gray-text);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Rango estimado de prima mensual</div>
          <div class="estimator-range" id="est-result-es">$300 – $375 / mes</div>
        </div>
        <div class="estimator-note">Las tarifas reales varían según la aseguradora. Nuestros corredores comparan todas las compañías en Florida para encontrar su tarifa más baja por cobertura idéntica.</div>
      </div>
      <p style="font-size:13px;color:#888;margin-top:12px;">
        ⚠️ Estimaciones solamente. Las tarifas reales varían según la aseguradora, código postal e historial de salud.
        <a href="/es/contacto" style="color:#452068;font-weight:600;">Llámenos para su cotización real →</a>
      </p>
    </div>

    <div class="info-box">
      <div class="info-box-title">Misma cobertura, precios muy diferentes</div>
      <p>Como todas las pólizas de Medigap con la misma letra cubren exactamente lo mismo, la única razón para pagar más es si no compara. Las primas para cobertura idéntica pueden variar entre $50–$100/mes entre aseguradoras en el mismo código postal de Florida. Nuestros corredores hacen esta comparación por usted sin costo.</p>
    </div>
"""

# JavaScript for Spanish estimator
JS_ESTIMATOR_ES = """
const estimatesES = {
  G: { 65: [300,375], 67: [330,410], 70: [360,455], 75: [420,530], 80: [480,600] },
  N: { 65: [200,320], 67: [220,350], 70: [240,385], 75: [280,445], 80: [320,505] },
  HD: { 65: [60,100], 67: [68,110], 70: [77,125], 75: [90,145], 80: [105,165] }
};
function updateEstimateES() {
  const age = document.getElementById('est-age-es').value;
  const plan = document.getElementById('est-plan-es').value;
  const tobacco = document.getElementById('est-tobacco-es').value;
  const base = estimatesES[plan][age];
  const low = tobacco === 'yes' ? Math.round(base[0] * 1.15) : base[0];
  const high = tobacco === 'yes' ? Math.round(base[1] * 1.15) : base[1];
  document.getElementById('est-result-es').textContent = '$' + low + ' – $' + high + ' / mes';
}
"""

print("=== FIXING MEDICARE SUPPLEMENT PAGES ===\n")

# Fix Spanish page
print("1. Fixing Spanish page (es/medicare-suplementario-miami.html)...")
filepath_es = Path('es/medicare-suplementario-miami.html')
content_es = filepath_es.read_text(encoding='utf-8')

# Remove Plan F card and replace with Plan G-HD
pattern_f = r'      <div class="plan-card">\s*<div class="plan-header plan-f">.*?</div>\s*</div>'
match = re.search(pattern_f, content_es, re.DOTALL)

if match:
    content_es = content_es.replace(match.group(0), PLAN_HD_SPANISH)
    print("  ✅ Replaced Plan F with Plan G-HD")
else:
    print("  ❌ Could not find Plan F card")

# Add premium estimator after the comparison section (before Medigap vs Medicare Advantage)
insert_point = content_es.find('<section class="section">\n  <div class="container">\n    <div class="icon-heading">\n      <div class="icon-circle">\n        <svg viewBox="0 0 24 24" fill="none" stroke="#452068" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/>')

if insert_point > 0:
    content_es = content_es[:insert_point] + '<section class="section">\n  <div class="container">\n' + ESTIMATOR_SPANISH + '\n  </div>\n</section>\n\n' + content_es[insert_point:]
    print("  ✅ Added premium estimator")
else:
    print("  ❌ Could not find insertion point for estimator")

# Add JavaScript for estimator before </script> tag
script_end = content_es.rfind('</script>')
if script_end > 0:
    content_es = content_es[:script_end] + '\n' + JS_ESTIMATOR_ES + content_es[script_end:]
    print("  ✅ Added estimator JavaScript")
else:
    print("  ❌ Could not find </script> tag")

filepath_es.write_text(content_es, encoding='utf-8')
print("\n✅ Spanish page updated\n")

print("=== COMPLETE ===")
print("Changes made:")
print("  1. Spanish page: Plan F removed, Plan G-HD added")
print("  2. Spanish page: Premium estimator added with JavaScript")
print("  3. English page: Already has Plan G-HD, no changes needed")

