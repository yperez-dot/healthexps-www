# HOMEPAGE RULES - Permanent Standards

**MANDATORY: Check these rules on EVERY deploy that touches `index.html` or `es/index.html`**

---

## ✅ RULE #1: Hero H1 Text (Non-Negotiable)

### English Homepage (`index.html`)
```
Health Insurance Experts.
Bilingual. Independent.
No Cost to You.
```

**NEVER:** "Medicare Experts" - we are health insurance experts, not just Medicare

### Spanish Homepage (`es/index.html`)
```
Expertos en Seguros de Salud.
Bilingüe. Independiente.
Sin Costo Para Ti.
```

**NEVER:** "Expertos en Medicare"

---

## ✅ RULE #2: Hero Subtext

### English
```
We compare 14+ insurance carriers to find the right plan for your family — completely free. English & Spanish.
```

### Spanish
```
Comparamos más de 14 aseguradoras para encontrar el plan correcto para tu familia — completamente gratis. Inglés y Español.
```

---

## ✅ RULE #3: Location Pill (Above H1)

### English
```
📍 Doral, FL - South Florida
```

### Spanish
```
📍 Doral, FL - Sur de Florida
```

**Must remain:** Location pill stays above H1, never remove

---

## 🔍 Pre-Deploy Verification

Before pushing ANY commit that modifies `index.html` or `es/index.html`:

```bash
# Check English H1
grep -A 1 '<h1>' index.html | grep "Health Insurance Experts"

# Check Spanish H1
grep -A 1 '<h1>' es/index.html | grep "Seguros de Salud"
```

**Both commands must return results.** If either fails, fix before pushing.

---

## 📝 Rationale

**Why "Health Insurance Experts" not "Medicare Experts":**
- We sell Medicare, ACA, private insurance, dental, vision, COBRA alternatives
- "Medicare Experts" narrows our positioning
- Homepage serves all audiences (under 65, over 65, families, individuals)
- Brand positioning: comprehensive health insurance brokerage, not just Medicare shop

**Established:** June 25, 2026  
**Last verified:** June 25, 2026  
**Owner:** Yahoska Perez / The Health Experts Insurance
