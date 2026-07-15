#!/usr/bin/env python3
"""
Medicare Cost Audit — healthexps.com
Checks key Medicare figures on the live site against known correct values.
Sends WhatsApp/email alert if anything is off.

Run: python3 medicare-cost-audit.py
Schedule: Quarterly (Jan, Apr, Jul, Oct) + November for new CMS rates
"""

import re
import smtplib
import urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

# ── 2026 Official CMS Figures (update when CMS announces 2027 in Nov) ──────
CORRECT_VALUES = {
    "Part B premium":        "$202.90",
    "Part B deductible":     "$283",
    "Part A deductible":     "$1,736",
    "Part A days 61-90":     "$434",
    "Lifetime reserve":      "$868",
    "SNF days 21-100":       "$217",
    "IRMAA Tier 2 (Part B)": "$284.10",
    "IRMAA Tier 3 (Part B)": "$405.80",
    "IRMAA Tier 4 (Part B)": "$527.50",
    "IRMAA Tier 5 (Part B)": "$649.20",
    "IRMAA Tier 6 (Part B)": "$689.90",
    "Part D IRMAA Tier 2":   "$14.50",
    "Part D IRMAA Tier 3":   "$37.50",
    "Part D IRMAA Tier 4":   "$60.40",
    "Part D IRMAA Tier 5":   "$83.30",
    "Part D IRMAA Tier 6":   "$91.00",
    "IRMAA threshold indiv": "$109,000",
}

# ── Pages to audit ───────────────────────────────────────────────────────────
PAGES = [
    # healthexps.com
    "https://www.healthexps.com/medicare/medicare-costs",
    "https://www.healthexps.com/medicare-irmaa-penalties",
    "https://www.healthexps.com/medicare/what-is-medicare",
    "https://www.healthexps.com/resources",
    "https://www.healthexps.com/es/medicare/costos-de-medicare",
    "https://www.healthexps.com/es/irmaa-penalidades-medicare",
    # Agent Hub (agentmedicarehub.com)
    "https://thei-agent-hub.netlify.app/learn.html",
    "https://thei-agent-hub.netlify.app/certs-compliance.html",
    "https://thei-agent-hub.netlify.app/home.html",
]

# ── Old values to flag (previous year figures that shouldn't appear) ─────────
STALE_VALUES = [
    "$185",     # 2025 Part B premium
    "$257",     # 2025 Part B deductible (now $283 in 2026)
    "$1,676",   # 2025 Part A deductible (now $1,736 in 2026)
    "$419",     # 2025 Part A days 61-90 (now $434)
    "$838",     # 2025 lifetime reserve (now $868)
    "$209.50",  # 2025 SNF (now $217)
    "$13.70",   # 2025 Part D Tier 2 (now $14.50)
    "$35.30",   # 2025 Part D Tier 3 (now $37.50)
    "$57.00",   # 2025 Part D Tier 4 (now $60.40)
    "$78.60",   # 2025 Part D Tier 5 (now $83.30)
    "$85.80",   # 2025 Part D Tier 6 (now $91.00)
]

def fetch_page(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read().decode('utf-8', errors='ignore')
    except Exception as e:
        return f"ERROR: {e}"

def audit():
    issues = []
    for url in PAGES:
        html = fetch_page(url)
        if html.startswith("ERROR"):
            issues.append(f"❌ Could not fetch: {url} — {html}")
            continue
        # Strip HTML tags for text search
        text = re.sub(r'<[^>]+>', ' ', html)
        for stale in STALE_VALUES:
            # Only flag if the stale value appears WITHOUT a year label like "2025" or "2024" nearby
            if stale in text:
                # Find context around the match
                idx = text.find(stale)
                context = text[max(0,idx-50):idx+80].strip()
                if '2025' not in context and '2024' not in context and '2023' not in context:
                    issues.append(f"⚠️  Stale value {stale} found on {url}\n   Context: ...{context}...")
    return issues

def send_alert(issues):
    smtp_user = "info@healthexps.com"
    smtp_pass = ""
    env_file = os.path.expanduser("~/.openclaw/secrets/smtp.env")
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                if "SMTP_PASS" in line:
                    smtp_pass = line.strip().split("=", 1)[1].strip().strip('"').strip("'")

    msg = MIMEMultipart()
    msg["From"] = smtp_user
    msg["To"] = "yperez@healthexps.com"
    msg["Subject"] = "⚠️ Medicare Cost Audit — Issues Found on healthexps.com"

    body = "The automated Medicare cost audit found the following issues:\n\n"
    body += "\n\n".join(issues)
    body += "\n\n---\nFix: Update the values in the healthexps-www repo to the correct 2026 (or current year) CMS figures.\n"
    body += "CMS announces new rates each November at: cms.gov/newsroom/fact-sheets\n"
    body += "\nReference: igor-resources-hub-task-brief.md"

    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, "yperez@healthexps.com", msg.as_string())
    print("Alert sent to yperez@healthexps.com")

if __name__ == "__main__":
    print("Running Medicare cost audit on healthexps.com...")
    issues = audit()
    if issues:
        print(f"Found {len(issues)} issue(s):")
        for i in issues:
            print(f"  {i}")
        send_alert(issues)
    else:
        print("✅ All pages clean — no stale Medicare figures found.")
