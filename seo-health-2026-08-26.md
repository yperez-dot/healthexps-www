# healthexps.com SEO + Analytics Health Check
**Date:** August 26, 2026  
**Asked:** “Run quality diagnoses on SEO reports, analytics — see how we’re doing.”  
**Method:** Re-scored the July 5, 2026 audit against the current repo + live SERP samples. GA4/Search Console accounts were not connected in this environment, so traffic/click numbers below are **not** from GSC/GA4 — they are on-page, sitemap, redirect, and public Google result checks.

**Overall: 6 / 10.**  
The site is in much better technical shape than it was in July. Titles, redirects, bilingual toggles, 2026 cost figures, and lead-form tracking all moved. You are **not yet winning the money keywords**. National affiliates still own “Medicare Advantage Miami 2026.” Annual Enrollment starts **October 15** — about seven weeks from this check.

---

## Scorecard

| Area | Score | One-line read |
|---|---|---|
| Technical SEO (indexability, redirects, i18n) | 7/10 | July P0s mostly shipped. Cannibalization and sitemap rot remain. |
| On-page (titles, metas, schema) | 7/10 | Aug 12–24 CTR rewrites landed in code. Google snippets still lag. |
| Analytics instrumentation | 7/10 | GA4 is on essentially every page. Form + calculator events exist. No live numbers here. |
| Rankings / SERP share | 4/10 | Core pages are indexed. Money SERPs are still affiliates. Old Wix URLs still surface. |
| Content vs. Miami opportunity | 4/10 | Life-situation blog posts started. Neighborhood + hospital-network cluster not built. |
| YMYL / E-E-A-T accuracy | 7/10 | 2026 CMS figures are largely correct. One Spanish calculator still uses $185. |
| **Overall** | **6/10** | Ready to compete. Not competing yet on the queries that pay. |

---

## What improved since July 5 (this is real progress)

July P0s that **did** get done:

1. **Legacy Wix 301s** — `/medicare-insurance-agents`, `/medicare-insurance-agents-miami`, `/insurance/medicareplans`, `/healthcare-insurance-for-seniors`, and a large `/post/*` → `/blog/*` map are in `netlify.toml` (added July 12–15, plus duplicate-content consolidation Aug 3).
2. **EN→ES toggle** — homepage now goes to `/es/`. Advantage, Supplement, ACA, FAQ, Contact, Agent, and COBRA point at the matching Spanish page. July’s sitewide “everything-to-planes-de-medicare” bug is gone.
3. **2026 cost sweep** — Part B **$202.90**, Part B deductible **$283**, Part A deductible **$1,736**, MOOP **$9,250**, Part D cap **$2,100** appear correctly on FAQ, IRMAA, supplement, MSP, and myths pages.
4. **COBRA + AEP + Dual Eligible** are in nav/footer across the site. AEP 2027 is highlighted in the homepage footer in pink.
5. **Titles/metas** — homepage is now `Medicare & Health Insurance Miami | Compare Plans Free`. ACA includes “Obamacare.” Money-page titles were rewritten Aug 12, with follow-up CTR passes Aug 17 and Aug 24.
6. **Analytics** — GA4 `G-SJSGF3E9MD` is on production HTML. Form submits, WhatsApp clicks, and calculator funnel events were added in August. Meta Pixel `3257807051192879` is on key conversion pages.
7. **Content that did ship** from the competitor list: lost-Medicaid, green-card/Medicare, dual-eligible (EN+ES), UHealth network change, life-insurance cluster, AEP 2027 page.

---

## P0 — fix before AEP (Oct 15)

### 1. Apex domain `healthexps.com` has no A/AAAA record
`www.healthexps.com` resolves through Cloudflare (`104.21.73.182` / `172.67.165.62`). The bare domain has NS + Google MX only — **no A or AAAA**. Typed-in `healthexps.com` (no www) does not resolve from this environment.

Anyone who omits `www`, and any backlink that points at the apex, is a dead end. In Cloudflare DNS, add an orange-clouded A/AAAA (or CNAME flattening) for `@` → the same target as `www`, then 301 apex → `https://www.healthexps.com/`.

### 2. Google is still showing old Wix `/post/` URLs
Public search still returns pages such as:

- `https://www.healthexps.com/post/the-vital-need-for-timely-medicare-enrollment-sidestepping-penalties` — **this slug is not in the redirect map**
- `https://www.healthexps.com/post/mastering-the-medicare-enrollment-process-your-guide-to-a-stress-free-experience` — redirect exists, Google has not fully recrawled
- `https://www.healthexps.com/es/post/avmed-medicare-termino-florida-que-hacer-2026` — redirect exists

Action: add a 301 for every remaining `/post/` slug that 404s or still ranks, then in Search Console use **Removals** + **Inspect URL → Request indexing** on the new `/blog/` targets.

### 3. Broker-page cannibalization is still live
These are **indexed as separate pages** and still listed in `sitemap.xml`:

| URL | Competing for |
|---|---|
| `/medicare-agent-miami` | “Medicare agent Miami” (keep this one) |
| `/medical-insurance-broker` | “health insurance broker Miami” — still 200, own canonical |
| `/independent-health-insurance-broker` | same intent |
| `/healthcare-insurance-for-seniors` | 301s to `/medicare-plans-miami` but **still in the sitemap** |

July said to 301 `/medical-insurance-broker` into `/` or `/medicare-agent-miami`. That never happened. Google is still choosing among three “about/broker” URLs.

### 4. Confirm Cloudflare is not challenging real Googlebot
From this datacenter, HTML and `sitemap.xml` return **HTTP 403** with `cf-mitigated: challenge` (including a spoofed Googlebot UA — that part is expected). Real Googlebot from Google IPs is usually allowlisted, and Google **is** indexing pages, so this is not proven as a ranking killer.

Still verify in GSC: **Settings → Crawling → Crawl stats** and “Page indexing” for a spike in “Crawled – currently not indexed” or robots blocked. Keep Bot Fight Mode from challenging `Googlebot`, `Googlebot-Image`, `AdsBot-Google`, and `bingbot`. `robots.txt` currently allows search (`Content-Signal: search=yes`) and disallows `Google-Extended` (Gemini training) — that is fine.

---

## P1 — this week

### Sitemap is lying to Google
Problems in `sitemap.xml`:

- Lists **redirected** URLs: `/healthcare-insurance-for-seniors`, `/find-my-plan` (→ quiz), `/enrollment-calculator` (→ `/medicare-enrollment-calculator/`), `/medigap-calculator` (→ MA vs Supplement calculator).
- Lists **cannibal pages**: `/medical-insurance-broker`.
- **Missing** published posts: `/blog/medicare-green-card-holders-florida/`, `/blog/what-is-life-insurance-florida/`, `/blog/term-vs-whole-vs-final-expense-life-insurance/`, `/blog/how-to-pick-aca-marketplace-plan-florida/`, `/blog/private-health-insurance-miami-guide/`, plus `/health-insurance-quiz/` and `/medicare-enrollment-calculator/`.
- Most `<lastmod>` dates are still **2026-06-22**.
- `/faq` is listed twice. `/es/faq` and `/es/preguntas-frecuentes` both listed (pick one canonical).
- Trailing-slash mix: AEP URLs have a slash; most others do not. Canonicals on many pages **do** use a trailing slash. Pick one pattern.

Sitemap is a passthrough file (`eleventy.js` copies `sitemap.xml` as-is). It does not auto-update when Eleventy publishes new `.md` posts.

### Google snippets still show pre-rewrite titles
Repo titles are newer than what Google is displaying, e.g.:

| Page | In code now | Still in Google |
|---|---|---|
| `/faq` | `Medicare FAQ 2026 — Enrollment, Costs & Plans \| Answered` | `Medicare FAQ & Insurance Questions \| Health Experts` |
| `/medicare-advantage-miami` | `Medicare Advantage Miami 2026 \| Compare Plans Free` | `Medicare Advantage Plans in Miami 2026 \| The Health Experts Insurance` |

Request indexing on the 10 money pages after the sitemap cleanup. CTR rewrites only pay off once Google recrawls.

### Schema gaps the July audit already named
- **FAQPage** is still missing on English money pages that have visible FAQs: `/medicare-advantage-miami`, `/aca-plans-miami`, `/cobra-alternatives-miami`, `/medicare-supplement-miami`, `/medicare-plans-miami`. Spanish Advantage **has** FAQPage; English does not.
- Homepage, `/es/`, `/es/agente-de-medicare-miami`, and `/final-expense-insurance` still emit **`aggregateRating`**. Google treats self-served LocalBusiness review stars as spam. Keep the reviews as visible content; drop the markup.
- No `hreflang="x-default"` anywhere.
- No Person schema for Yahoska/Katy.

### Preview / draft URLs are indexable
Almost every `*-preview.html` is missing `noindex`. Only life + final-expense ES previews have it. If those URLs are reachable, Google can index drafts. Add `noindex,nofollow` sitewide on `*preview*` and remove them from any internal links.

### Invalid HTML on the homepage
`index.html` (and `life-insurance-calculator.html`) start with **two** `<!DOCTYPE html><html>` tags. That can confuse parsers and rich-result extraction. Delete the duplicate.

### Spanish Part B penalty calculator still uses $185
In `es/medicare/nuevo-en-medicare.html`:

```javascript
const prima=185;
```

The result copy correctly says $202.90. The **math** still uses the 2025 premium. Same class of YMYL error as July, just in one widget.

---

## P2 — content (this is why you are not on page one)

Live SERP for **“medicare plans miami 2026” / “medicare advantage miami 2026”** is still medicare.org, medicareplans.com, Connie-style affiliates — **not** a local broker. That matches July. Title tags will not beat a data page you never published.

**Still missing from the July 5 competitor list (the ones that matter for AEP):**

| Cluster | Suggested URL | Status |
|---|---|---|
| Best MA Miami 2027 (enrollment data) | `/best-medicare-advantage-plans-miami` | Not built |
| Part D Miami | `/medicare-part-d-miami` | Not built |
| Turning 65 Miami | `/turning-65-medicare-miami` | Not built (`/medicare/new-to-medicare` is generic) |
| Leon / Baptist / Jackson networks | `/medicare-plans-leon-medical-centers` etc. | Not built |
| Hialeah / Kendall neighborhood | `/medicare-plans-hialeah` | Not built |
| Give-back / Flex card | `/medicare-give-back-miami` | Not built |
| Spanish hub (“seguros médicos / aseguranza”) | `/es/seguros-medicos-miami` | Not built |
| How much Medicare costs in Florida | `/medicare-costs-florida` | Partial via IRMAA page only |

**Did ship as blog posts (good, but they are posts, not landing pages):** lost Medicaid, green card, dual eligible, UHealth, COBRA vs Marketplace.

AEP sequencing from July still holds: publish the 2027 “most popular by CMS enrollment” page the day 2027 plan data is marketable; get network pages live **before** October so they have time to index.

---

## Analytics (what we can and cannot see)

**Instrumented (in code):**
- GA4 property `G-SJSGF3E9MD` on essentially all HTML pages.
- Events: `form_submit`, `whatsapp_click`, calculator funnel events (Aug 18).
- Lead forms now require “looking for” and pass the source page (Aug 24) — that will make GA4/GHL attribution readable.
- Meta CAPI function + Pixel on homepage, MA, agent, plans, dual-eligible, MSP, quiz.

**Not verified here:**
- Sessions, organic clicks, CTR, conversions, Search Console coverage, or week-over-week trend.
- Gmail / Drive MCPs were not connected, so Monday `seo-weekly.js` emails could not be read.
- `audit-site.sh` reports “95 pages missing footer” — **false positive**. Footers are `<div id="site-footer">`, not `<footer>`. The script needs that selector or it will keep crying wolf.

Connect Gmail (and ideally a GSC/GA4 export) if you want the next pass to include real traffic, not just crawl health.

---

## July 5 deploy list — done vs not

| July deploy | Status |
|---|---|
| A — legacy 301s + MSP URL unify | **Mostly done.** `/medical-insurance-broker` and leftover `/post/` slugs remain. |
| B — i18n toggles + hreflang | **Toggles done.** Reciprocal hreflang present on core pairs. `x-default` still missing. |
| C — 2026 cost figures | **Mostly done.** ES penalty widget still uses $185. FAQ still calls the $2,100 Part D cap “first in history” (the cap started in 2025 at $2,000). |
| D — title/meta rewrites | **Shipped in code** (Aug 12–24). Google snippets lag. |
| E — nav/footer (COBRA, AEP, dual, Blog) | **Done.** |
| F — FAQPage + supplement FAQ | **Not done** on English money pages. |
| Content-gap pages | **Partial** (blogs). Landing pages for AEP/networks/neighborhoods not started. |

---

## Do this next (ordered)

1. **Cloudflare DNS:** apex `healthexps.com` → same as www, then 301 to https://www.
2. **Redirect leftovers:** `/medical-insurance-broker` and `/independent-health-insurance-broker` → `/medicare-agent-miami` (or a single `/about`); add 301s for every remaining indexed `/post/` slug.
3. **Sitemap:** only 200 canonical URLs; add the missing Aug blog posts; drop redirected and preview URLs; bump `lastmod`; submit in GSC.
4. **GSC:** request indexing on `/`, `/medicare-plans-miami`, `/medicare-advantage-miami`, `/medicare-agent-miami`, `/aca-plans-miami`, `/medicare-annual-enrollment-2027`, `/es/`, `/es/planes-de-medicare-miami`.
5. **Code hygiene:** remove duplicate doctype; `noindex` all previews; drop `aggregateRating`; add FAQPage on English FAQ sections; fix `prima=185`.
6. **AEP content (start now, not Oct 1):** Turning 65 Miami + Spanish hub + one hospital-network page. The “best MA Miami 2027” data page goes live when 2027 rates are marketable.

---

## Limits of this check

- No GA4 or Search Console API, so no click/impression/position tables.
- Cloudflare challenged non-browser crawlers from this VM; live HTML was sampled via a browser-class fetch on the homepage and via public Google results.
- PageSpeed / Core Web Vitals not measured (blocked on the same challenge).
- `HOMEPAGE-RULES.md` still says the H1 must be “Health Insurance Experts…” — the live H1 is “Medicare in Miami, explained clearly…”, which is the better SEO choice. The rules file is stale.

If you connect Gmail (Monday SEO emails) or paste a GSC screenshot, the next pass can attach real 28-day clicks, CTR, and query tables to this scorecard.
