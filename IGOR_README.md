# IGOR — Master Site Reference

**Last updated:** June 2026  
**Repo:** yperez-dot/healthexps-en  
**Live preview:** healthexps-en.netlify.app (EN) · healthexps-es.netlify.app (ES)  
**Production:** www.healthexps.com (DNS cutover pending)

---

## RULE #1 — BEFORE DOING ANYTHING

Run `ls src/` and `ls src/medicare/` first. Compare against the master inventory below. **Never assume a page is missing without checking the repo first.**

---

## SITE STRUCTURE

```
src/
├── index.html → /
├── medicare-plans-miami.html → /medicare-plans-miami
├── medicare-advantage-miami.html → /medicare-advantage-miami
├── medicare-supplement-miami.html → /medicare-supplement-miami
├── aca-plans-miami.html → /aca-plans-miami
├── private-health-insurance-miami.html → /private-health-insurance-miami
├── dental-vision-miami.html → /dental-vision-miami
├── compare-medicare-plans.html → /compare-medicare-plans
├── medicare-plan-finder.html → /medicare-plan-finder
├── find-my-plan.html → /find-my-plan
├── avmed-medicare-florida.html → /avmed-medicare-florida
├── medicare-enrollment-periods.html → /medicare-enrollment-periods
├── medicare-irmaa-penalties.html → /medicare-irmaa-penalties
├── medicare-agent-miami.html → /medicare-agent-miami
├── contact.html → /contact
├── faq.html → /faq
├── privacy.html → /privacy
│
├── medicare/
│   ├── what-is-medicare.html → /medicare/what-is-medicare
│   ├── new-to-medicare.html → /medicare/new-to-medicare
│   ├── medicare-costs.html → /medicare/medicare-costs
│   ├── medicare-advantage-plans.html → /medicare/medicare-advantage-plans
│   ├── medicare-supplement-plans.html → /medicare/medicare-supplement-plans
│   └── medicare-savings-program.html → /medicare/medicare-savings-program
│
└── faq/
    └── medicarefaq.html → /faq/medicarefaq
```

---

## COMPLETE PAGE INVENTORY — ENGLISH (24 pages)

| File | Deploy URL | Status |
|------|------------|--------|
| `index.html` | `/` | ✅ Live |
| `medicare/what-is-medicare.html` | `/medicare/what-is-medicare` | ✅ Live |
| `medicare/new-to-medicare.html` | `/medicare/new-to-medicare` | ✅ Live |
| `medicare/medicare-costs.html` | `/medicare/medicare-costs` | ✅ Live |
| `medicare/medicare-advantage-plans.html` | `/medicare/medicare-advantage-plans` | ✅ Live |
| `medicare/medicare-supplement-plans.html` | `/medicare/medicare-supplement-plans` | ✅ Live |
| `medicare/medicare-savings-program.html` | `/medicare/medicare-savings-program` | ✅ Live |
| `medicare-plans-miami.html` | `/medicare-plans-miami` | ✅ Live |
| `medicare-advantage-miami.html` | `/medicare-advantage-miami` | ✅ Live |
| `medicare-supplement-miami.html` | `/medicare-supplement-miami` | ✅ Live |
| `aca-plans-miami.html` | `/aca-plans-miami` | ✅ Live |
| `private-health-insurance-miami.html` | `/private-health-insurance-miami` | ✅ Live |
| `dental-vision-miami.html` | `/dental-vision-miami` | ✅ Live |
| `compare-medicare-plans.html` | `/compare-medicare-plans` | ✅ Live |
| `medicare-plan-finder.html` | `/medicare-plan-finder` | ✅ Live |
| `avmed-medicare-florida.html` | `/avmed-medicare-florida` | ✅ Live |
| `medicare-enrollment-periods.html` | `/medicare-enrollment-periods` | ✅ Live |
| `medicare-irmaa-penalties.html` | `/medicare-irmaa-penalties` | ✅ Live |
| `find-my-plan.html` | `/find-my-plan` | ✅ Live |
| `medicare-agent-miami.html` | `/medicare-agent-miami` | ✅ Live |
| `contact.html` | `/contact` | ✅ Live |
| `faq.html` | `/faq` | ✅ Live |
| `faq/medicarefaq.html` | `/faq/medicarefaq` | ✅ Live |
| `privacy.html` | `/privacy` | ✅ Live |

---

## DEPLOYMENT

**Netlify auto-deploys on push to `main`:**
- English: https://healthexps-en.netlify.app
- Spanish: https://healthexps-es.netlify.app

**Production domain (pending DNS cutover):**
- www.healthexps.com

---

## FILE STRUCTURE RULES

1. **Root-level pages** = `src/page-name.html` → `/page-name`
2. **Medicare education cluster** = `src/medicare/page-name.html` → `/medicare/page-name`
3. **FAQ subfolder** = `src/faq/medicarefaq.html` → `/faq/medicarefaq`
4. **NO `index.html` folder structure** — Netlify handles clean URLs automatically from `.html` files
5. **Exception:** `src/index.html` for home page (`/`)

---

## SPANISH SITE (healthexps-es) — 24 Pages

**New Medicare Education Cluster (6 pages)** — June 2026:

```
src/es/medicare/
├── que-es-medicare/index.html → /es/medicare/que-es-medicare
├── nuevo-en-medicare/index.html → /es/medicare/nuevo-en-medicare
├── costos-de-medicare/index.html → /es/medicare/costos-de-medicare
├── planes-medicare-advantage/index.html → /es/medicare/planes-medicare-advantage
├── medicare-suplementario/index.html → /es/medicare/medicare-suplementario
└── programa-ahorros-medicare/index.html → /es/medicare/programa-ahorros-medicare
```

**Existing Spanish Pages (18 pages):**

| Page | URL | Type |
|------|-----|------|
| Home | `/es/` | Landing |
| Agente de Medicare Miami | `/es/agente-de-medicare-miami` | About (Medicare-focused) |
| Corredor de Seguros Médicos | `/es/corredor-de-seguros-medicos-miami` | About (Broader positioning) |
| Planes de Medicare Miami | `/es/planes-de-medicare-miami` | Service |
| Medicare Advantage | `/es/medicare-advantage-en-espanol` | Service |
| Medicare Suplementario Miami | `/es/medicare-suplementario-miami` | Service |
| Planes ACA Miami | `/es/planes-aca-miami` | Service |
| Seguro Médico Privado | `/es/seguro-medico-privado-miami` | Service |
| Dental y Visión | `/es/dental-vision-miami` | Service |
| Comparar Planes | `/es/comparar-planes-de-medicare` | Tool |
| Recursos | `/es/recursos` | Hub page (links to guides/FAQs) |
| AvMed Medicare Florida | `/es/avmed-medicare-florida-espanol` | Resource |
| Períodos de Inscripción | `/es/periodos-inscripcion-medicare` | Resource |
| IRMAA Penalidades | `/es/irmaa-penalidades-medicare` | Resource |
| Contacto | `/es/contacto` | Contact |
| FAQ General | `/es/faq` | FAQ |
| FAQ Medicare | `/es/faq-medicare` | FAQ |
| FAQ ACA | `/es/faq-aca` | FAQ |

**Redirect:**
- `/es/programa-ahorros-medicare` → `/es/medicare/programa-ahorros-medicare` (301)

---

## BRANDING

- **Purple:** `#452068`
- **Pink:** `#ff1090`
- **WhatsApp:** `#25D366`
- **Phone:** 1-800-380-6821
- **WhatsApp:** 305-464-6888
- **Google Analytics:** G-SJSGF3E9MD

---

## LINKS

- **Calendly:** https://calendly.com/healthexps-info/
- **Typeform:** https://form.typeform.com/to/HAWpOxNm
- **HealthSherpa:** https://www.healthsherpa.com/?_agent_id=sabri-perez
- **WhatsApp:** https://wa.me/13054646888

---

## PENDING TASKS

1. Update design on 10 existing Spanish pages (not the new education cluster)
2. DNS cutover to www.healthexps.com
3. Add Spanish translations for service pages (Miami-specific)

---

## CONTENT DECISIONS

**Golden Years** — NO mention anywhere on the site. Decision final.

---

**Last verified:** June 16, 2026  
**Total pages:** 24 English + 24 Spanish = **48 pages live**
