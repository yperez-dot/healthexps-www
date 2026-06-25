#!/bin/bash

echo "=== COMPREHENSIVE SITE AUDIT ==="
echo ""
echo "Checking all HTML pages for required elements:"
echo "1. Full header (utility bar + logo + nav)"
echo "2. Full footer (logo, links, address, phone)"
echo "3. Scroll-to-top arrow"
echo "4. GA4 tag (G-SJSGF3E9MD)"
echo "5. Canonical tag"
echo ""

MISSING_REPORT=""
TOTAL=0
ISSUES=0

for file in $(find . -name "*.html" -not -path "./node_modules/*" -not -path "./.git/*" | sort); do
    TOTAL=$((TOTAL + 1))
    HAS_ISSUE=0
    ISSUES_LIST=""
    
    # 1. Check for header elements
    if ! grep -q '<nav' "$file" 2>/dev/null; then
        ISSUES_LIST="${ISSUES_LIST}❌ Header "
        HAS_ISSUE=1
    fi
    
    # 2. Check for footer
    if ! grep -q '<footer' "$file" 2>/dev/null; then
        ISSUES_LIST="${ISSUES_LIST}❌ Footer "
        HAS_ISSUE=1
    fi
    
    # 3. Check for scroll-to-top
    if ! grep -q 'id="scrollToTop"' "$file" 2>/dev/null; then
        ISSUES_LIST="${ISSUES_LIST}❌ Scroll-to-top "
        HAS_ISSUE=1
    fi
    
    # 4. Check for GA4
    if ! grep -q 'G-SJSGF3E9MD' "$file" 2>/dev/null; then
        ISSUES_LIST="${ISSUES_LIST}❌ GA4 "
        HAS_ISSUE=1
    fi
    
    # 5. Check for canonical
    if ! grep -q 'rel="canonical"' "$file" 2>/dev/null; then
        ISSUES_LIST="${ISSUES_LIST}❌ Canonical "
        HAS_ISSUE=1
    fi
    
    if [ $HAS_ISSUE -eq 1 ]; then
        ISSUES=$((ISSUES + 1))
        MISSING_REPORT="${MISSING_REPORT}\n${file}: ${ISSUES_LIST}"
    fi
done

echo "Total pages scanned: $TOTAL"
echo "Pages with issues: $ISSUES"
echo ""

if [ $ISSUES -gt 0 ]; then
    echo "=== PAGES WITH MISSING ELEMENTS ==="
    echo -e "$MISSING_REPORT"
fi
