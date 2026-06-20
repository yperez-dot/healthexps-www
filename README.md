# healthexps-www

**The Health Experts Insurance** - Unified bilingual website

## Structure

```
healthexps-www/
├── src/               # English site (root)
│   ├── index.html
│   ├── medicare-plans-miami.html
│   ├── medigap-calculator.html
│   ├── irmaa-calculator.html
│   └── ... (all EN pages)
│
├── es/                # Spanish site (subfolder)
│   ├── index.html
│   ├── planes-de-medicare-miami.html
│   ├── agente-de-medicare-miami.html
│   └── ... (all ES pages)
│
└── netlify.toml       # Netlify configuration
```

## URLs

- **English:** `https://healthexps.com/` → serves from `src/`
- **Spanish:** `https://healthexps.com/es/` → serves from `es/`

## Deployment

This repo consolidates:
- `healthexps-en` (English content) → root
- `healthexps-es` (Spanish content) → `es/` subfolder

Deploy to Netlify with:
- Build command: (none - static site)
- Publish directory: `/` (root, since `src/` and `es/` are at root level)

## Migration Notes

1. Created: 2026-06-20
2. Source repos:
   - https://github.com/yperez-dot/healthexps-en
   - https://github.com/yperez-dot/healthexps-es
3. All files merged into single repo structure
