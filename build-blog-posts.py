#!/usr/bin/env python3
"""
build-blog-posts.py — Convert .md blog posts to .html
Run before every deploy. This is the build step.

Usage:
  python3 build-blog-posts.py           # convert all .md with no .html
  python3 build-blog-posts.py --all     # force-rebuild all
  python3 build-blog-posts.py --check   # audit only, no writes

Installs automatically: markdown (pip3)
"""

import os
import re
import sys
import glob
import markdown as md_lib

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))

BLOG_DIRS = [
    (os.path.join(REPO_ROOT, "blog"), "en", "../"),
    (os.path.join(REPO_ROOT, "es", "blog"), "es", "../../"),
]

GA_TAG = "G-SJSGF3E9MD"

EN_NAV = """<header class="header">
  <a href="/">The Health Experts Insurance</a>
  <nav class="nav">
    <a href="/medicare-plans-miami.html">Medicare</a>
    <a href="/aca-plans-miami.html">ACA Plans</a>
    <a href="/private-health-insurance-miami.html">Private Insurance</a>
    <a href="/contact.html">Contact</a>
  </nav>
</header>"""

ES_NAV = """<header class="header">
  <a href="/es/">The Health Experts Insurance</a>
  <nav class="nav">
    <a href="/es/planes-medicare-miami.html">Medicare</a>
    <a href="/es/planes-aca-miami.html">Planes ACA</a>
    <a href="/es/seguro-medico-privado-miami.html">Seguro Privado</a>
    <a href="/es/contacto.html">Contacto</a>
  </nav>
</header>"""

FOOTER = """<footer class="footer">
  <div class="wrap">
    <p>© 2026 <a href="/">The Health Experts Insurance</a> · Licensed in Florida · <a href="/contact.html">Contact Us</a> · 1-800-380-6821</p>
  </div>
</footer>"""

ES_FOOTER = """<footer class="footer">
  <div class="wrap">
    <p>© 2026 <a href="/es/">The Health Experts Insurance</a> · Licenciado en Florida · <a href="/es/contacto.html">Contáctanos</a> · 1-800-380-6821</p>
  </div>
</footer>"""

CSS = """<style>
:root{--purple:#452068;--pink:#ff1090;--ink:#1a1325;--muted:#6b6477;}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:#fff;line-height:1.6}
a{text-decoration:none;color:inherit}
.wrap{max-width:760px;margin:0 auto;padding:0 24px;}
.header{background:var(--purple);padding:16px 24px;display:flex;justify-content:space-between;align-items:center;}
.header a{color:#fff;font-weight:600;font-size:15px;}
.header a:hover{opacity:0.9;}
.nav{display:flex;gap:24px;}
.article{padding:60px 0;}
.article-header{margin-bottom:40px;border-bottom:2px solid #f4eefa;padding-bottom:24px;}
.article-title{font-size:36px;font-weight:700;color:#1a1a1a;margin-bottom:12px;line-height:1.2;}
.article-meta{font-size:14px;color:var(--muted);}
.article-body{font-size:17px;line-height:1.8;color:#444;}
.article-body h1{font-size:36px;font-weight:700;color:#1a1a1a;margin:40px 0 16px;line-height:1.2;}
.article-body h2{font-size:28px;font-weight:700;color:var(--purple);margin:40px 0 16px;}
.article-body h3{font-size:22px;font-weight:700;color:var(--purple);margin:32px 0 12px;}
.article-body h4{font-size:18px;font-weight:700;color:var(--purple);margin:24px 0 10px;}
.article-body p{margin-bottom:20px;}
.article-body ul,.article-body ol{margin:20px 0 20px 32px;}
.article-body li{margin-bottom:12px;}
.article-body strong{color:var(--purple);font-weight:700;}
.article-body em{font-style:italic;}
.article-body a{color:var(--pink);font-weight:600;}
.article-body a:hover{text-decoration:underline;}
.article-body table{width:100%;border-collapse:collapse;margin:32px 0;}
.article-body th{background:var(--purple);color:#fff;padding:12px 16px;text-align:left;font-size:15px;}
.article-body td{padding:12px 16px;border-bottom:1px solid #eee;font-size:15px;}
.article-body tr:nth-child(even) td{background:#f9f6fd;}
.article-body blockquote{border-left:4px solid var(--purple);background:#f9f6fd;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;}
.article-body hr{border:none;border-top:2px solid #f4eefa;margin:32px 0;}
.footer{background:#f4eefa;padding:40px 24px;text-align:center;margin-top:60px;}
.footer a{color:var(--purple);font-weight:600;}
.back-link{color:#452068;font-weight:600;font-size:16px;text-decoration:none;display:inline-block;margin-bottom:40px;}
.back-link:hover{text-decoration:underline;}
.faq{background:#f4eefa;padding:32px;border-radius:12px;margin:40px 0;}
.cta-box{background:var(--purple);color:#fff;padding:40px;border-radius:12px;text-align:center;margin:48px 0;}
.cta-box h2{color:#fff;margin-bottom:16px;}
.cta-box p{font-size:18px;margin-bottom:24px;color:#fff;opacity:0.9;}
.cta-btn{display:inline-block;background:var(--pink);color:#fff;padding:16px 32px;border-radius:50px;font-weight:700;font-size:16px;transition:all 0.2s;text-decoration:none;}
.cta-btn:hover{background:#d4006d;transform:translateY(-2px);}
.inline-cta{border-left:3px solid var(--purple);background:#f7f7f7;border-radius:0 8px 8px 0;padding:20px 24px;margin:40px 0;display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;}
.inline-cta-text{flex:1;min-width:240px;}
.inline-cta-text strong{display:block;font-size:18px;color:var(--purple);margin-bottom:6px;}
.inline-cta-text span{font-size:15px;color:var(--muted);}
.inline-cta-btn{background:var(--purple);color:#fff;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;white-space:nowrap;}
#scrollToTop{position:fixed;bottom:24px;right:24px;width:48px;height:48px;border-radius:50%;background:#452068;color:#fff;border:none;font-size:22px;cursor:pointer;display:none;box-shadow:0 4px 16px rgba(69,32,104,0.3);transition:all 0.2s;z-index:99;}
#scrollToTop:hover{background:#ff1090;transform:translateY(-3px);}
</style>"""

SCHEMA_AGENCY = '{"@context":"https://schema.org","@type":"InsuranceAgency","name":"The Health Experts Insurance","url":"https://www.healthexps.com","telephone":"+18003806821","address":{"@type":"PostalAddress","streetAddress":"1695 NW 110 Ave, Suite 224","addressLocality":"Doral","addressRegion":"FL","postalCode":"33172","addressCountry":"US"},"areaServed":["Miami-Dade County","Broward County","Florida"],"priceRange":"Free","description":"Independent bilingual health insurance brokers in Doral, FL. We compare 14+ carriers for Medicare, ACA, and private health insurance at no cost."}'


def parse_frontmatter(text):
    """Extract YAML frontmatter and body."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("---", 3)
    if end == -1:
        return {}, text
    fm_raw = text[3:end].strip()
    body = text[end + 3:].strip()
    fm = {}
    for line in fm_raw.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip().strip('"')
    return fm, body


def md_to_html(md_text):
    """Convert markdown to HTML, stripping embedded <script> blocks first."""
    # Extract JSON-LD scripts (keep them, insert separately)
    scripts = re.findall(r'(<script type="application/ld\+json">[\s\S]*?</script>)', md_text)
    clean = re.sub(r'<script type="application/ld\+json">[\s\S]*?</script>', '', md_text)
    # Strip HTML comments
    clean = re.sub(r'<!--.*?-->', '', clean, flags=re.DOTALL)
    html = md_lib.markdown(
        clean,
        extensions=['tables', 'fenced_code', 'nl2br'],
        output_format='html'
    )
    return html, scripts


def format_date(date_str):
    """Format 2026-07-10 -> July 10, 2026"""
    try:
        from datetime import datetime
        d = datetime.strptime(str(date_str), "%Y-%m-%d")
        return d.strftime("%B %-d, %Y")
    except Exception:
        return str(date_str)


def build_html(fm, body_html, scripts, lang="en", css_prefix="../"):
    title = fm.get("title", "Health Experts Blog")
    description = fm.get("description", "")
    date_str = fm.get("date", "")
    category = fm.get("category", "Medicare")
    canonical = fm.get("permalink", "")
    if canonical and not canonical.startswith("http"):
        canonical = "https://www.healthexps.com" + canonical

    is_es = lang == "es"
    nav = ES_NAV if is_es else EN_NAV
    footer = ES_FOOTER if is_es else FOOTER
    back_href = "/es/blog" if is_es else "/blog"
    back_text = "← Volver al Blog" if is_es else "← Back to Blog"
    date_fmt = format_date(date_str)

    extra_schemas = "\n".join(scripts) if scripts else ""

    html = f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="{css_prefix}css/global.css">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} | Health Experts</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical}">
<script async src="https://www.googletagmanager.com/gtag/js?id={GA_TAG}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','{GA_TAG}');</script>
{CSS}
<script type="application/ld+json">{SCHEMA_AGENCY}</script>
{extra_schemas}
</head>
<body>

{nav}

<main class="wrap">
  <article class="article">
    <a href="{back_href}" class="back-link">{back_text}</a>

    <header class="article-header">
      <p class="article-meta">{category} · {date_fmt} · The Health Experts Insurance</p>
      <h1 class="article-title">{title}</h1>
    </header>

    <div class="article-body">
{body_html}
    </div>
  </article>
</main>

{footer}

<button id="scrollToTop" onclick="window.scrollTo({{top:0,behavior:'smooth'}})">↑</button>
<script>window.addEventListener('scroll',()=>{{document.getElementById('scrollToTop').style.display=window.scrollY>400?'block':'none'}});</script>

</body>
</html>"""
    return html


def process_dir(blog_dir, lang, css_prefix, force=False, check_only=False):
    md_files = glob.glob(os.path.join(blog_dir, "*.md"))
    built = []
    skipped = []
    errors = []

    for md_path in sorted(md_files):
        html_path = md_path[:-3] + ".html"
        if not force and os.path.exists(html_path):
            skipped.append(os.path.basename(md_path))
            continue

        try:
            with open(md_path, encoding="utf-8") as f:
                raw = f.read()
            fm, body = parse_frontmatter(raw)
            if not fm.get("title"):
                skipped.append(f"{os.path.basename(md_path)} (no frontmatter)")
                continue

            body_html, scripts = md_to_html(body)
            html_out = build_html(fm, body_html, scripts, lang=lang, css_prefix=css_prefix)

            if not check_only:
                with open(html_path, "w", encoding="utf-8") as f:
                    f.write(html_out)
                built.append(os.path.basename(html_path))
            else:
                built.append(f"{os.path.basename(md_path)} → NEEDS BUILD")

        except Exception as e:
            errors.append(f"{os.path.basename(md_path)}: {e}")

    return built, skipped, errors


if __name__ == "__main__":
    force = "--all" in sys.argv
    check_only = "--check" in sys.argv

    total_built = []
    total_errors = []

    for blog_dir, lang, css_prefix in BLOG_DIRS:
        if not os.path.isdir(blog_dir):
            continue
        built, skipped, errors = process_dir(blog_dir, lang, css_prefix, force=force, check_only=check_only)
        if built:
            for b in built:
                print(f"{'CHECK' if check_only else 'BUILT'} [{lang.upper()}]: {b}")
        for e in errors:
            print(f"ERROR [{lang.upper()}]: {e}")
        total_built.extend(built)
        total_errors.extend(errors)

    print(f"\nDone: {len(total_built)} {'pending' if check_only else 'built'}, {len(total_errors)} errors")
    if total_errors:
        sys.exit(1)
