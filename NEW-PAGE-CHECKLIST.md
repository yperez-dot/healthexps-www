# NEW PAGE CREATION CHECKLIST

**MANDATORY: Verify BEFORE any content work, BEFORE going live.**

## ❌ CRITICAL FAILURE (June 25, 2026)
**DSNP page** (`/medicare-dual-eligible-miami`) was deployed WITHOUT header/footer and lived in production as a dead-end page until June 25, 2026. This checklist prevents recurrence.

---

## ✅ THE FIRST FIVE (Non-Negotiable)

When creating ANY new page, verify these **FIRST** — before writing content, before testing, before deployment:

### 1. ✅ **Full Header**
- Logo (links to homepage)
- Full navigation with dropdowns:
  - Insurance dropdown (Medicare Plans, Private Health, ACA, Dental/Vision)
  - Guides dropdown (What is Medicare, New to Medicare, Costs, Advantage, Supplement, MSP)
  - FAQ, Resources, Blog, About Us, Contact
- Mobile hamburger menu + responsive behavior
- Utility bar (Schedule Free Consultation + language switcher if applicable)

**Test:** Click every nav link, test dropdowns, test mobile menu

### 2. ✅ **Full Footer**
- Logo
- Contact info: Phone (1-800-380-6821), WhatsApp, email, address (Doral, FL)
- Four link columns:
  - Medicare
  - Other Insurance
  - Company
  - Legal (Privacy Policy, Medicare disclaimer)

**Test:** Click every footer link, verify all phone/email/address present

### 3. ✅ **Scroll-to-Top Button**
- Fixed position bottom-right
- Purple circle (#452068), white ↑ arrow
- Appears after 300px scroll
- Smooth scroll to top on click
- Pink hover (#ff1090)

**Code location:** Copy from `medicare-plans-miami.html` (before `</body>`)

### 4. ✅ **GA4 Tag**
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-SJSGF3E9MD"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-SJSGF3E9MD');
</script>
```

**Location:** In `<head>`, after meta tags, before closing `</head>`

### 5. ✅ **Canonical Tag**
```html
<link rel="canonical" href="https://www.healthexps.com/[page-url]">
```

**Location:** In `<head>`, with other `<link>` tags  
**Format:** Use full HTTPS URL, no trailing slash (unless homepage)

---

## 🔍 Pre-Deploy Verification Script

Run this BEFORE every deploy that includes new pages:

```bash
cd ~/.openclaw/workspace/healthexps-www
./audit-site.sh
```

**Zero tolerance:** If audit shows ANY page missing ANY of the 5 elements, fix immediately. Do not deploy.

---

## 📋 Extended Checklist (After The First Five)

Once the 5 non-negotiables are verified, complete these:

### 6. Meta Tags
- `<title>` (55-60 chars, includes location/year if relevant)
- `<meta name="description">` (150-160 chars, compelling CTA)
- Open Graph tags (og:title, og:description, og:image, og:url)
- Twitter Card tags

### 7. Structured Data (Schema.org)
- BreadcrumbList (if applicable)
- FAQPage (if FAQ section present)
- Service or Product schema (if service page)
- LocalBusiness (if contact/about page)

### 8. Hreflang Tags (if bilingual page exists)
```html
<link rel="alternate" hreflang="en" href="https://www.healthexps.com/[page-url]">
<link rel="alternate" hreflang="es" href="https://www.healthexps.com/es/[page-url-es]">
<link rel="alternate" hreflang="x-default" href="https://www.healthexps.com/[page-url]">
```

### 9. Internal Linking
- At least 2-3 relevant internal links in body content
- Link from at least 1 high-authority page (homepage, main service pages)
- Add to sitemap.xml (if using)

### 10. Mobile Responsiveness
- Test on mobile viewport (375px width minimum)
- Verify hamburger menu works
- Check images scale properly
- Verify buttons/CTAs are thumb-friendly (min 44px height)

### 11. Accessibility
- `aria-label` on icon-only buttons
- Alt text on all images (descriptive, not keyword-stuffed)
- Proper heading hierarchy (H1 → H2 → H3, no skips)
- Color contrast passes WCAG AA (4.5:1 for text)

### 12. Performance
- Images < 200KB each (use WebP when possible)
- Width/height attributes on images (prevent CLS)
- Defer non-critical scripts
- No render-blocking CSS (inline critical CSS if needed)

---

## 🚨 The Rule

**"Header and footer FIRST. Content SECOND. No exceptions."**

Every new page creation starts with:
1. Copy header from working page
2. Copy footer from working page  
3. Add scroll-to-top button
4. Add GA4 tag
5. Add canonical tag

**Then** write content.

---

## 📝 Incident Log

| Date | Page | Issue | Impact | Remediation |
|------|------|-------|--------|-------------|
| 2026-06-25 | `/medicare-dual-eligible-miami` | Missing scroll-to-top (header/footer were fixed earlier but scroll button was never added) | Degraded UX for organic traffic | Added scroll-to-top, created this checklist |

---

**Last updated:** June 25, 2026  
**Owner:** Igor (The Health Experts Insurance)  
**Enforcement:** Mandatory pre-deploy audit (`audit-site.sh`)
