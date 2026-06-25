#!/bin/bash

# Add scroll-to-top button to pages missing it

SCROLL_CODE='
<button id="scrollToTop" aria-label="Back to top">↑</button>
<script>
(function(){
  const btn=document.getElementById('\''scrollToTop'\'');
  if(!btn)return;
  window.addEventListener('\''scroll'\'',function(){btn.style.display=window.pageYOffset>300?'\''block'\'':'\''none'\'';});
  btn.addEventListener('\''click'\'',function(){window.scrollTo({top:0,behavior:'\''smooth'\''});});
  btn.addEventListener('\''mouseenter'\'',function(){btn.style.background='\''#ff1090'\'';btn.style.transform='\''translateY(-3px)'\'';});
  btn.addEventListener('\''mouseleave'\'',function(){btn.style.background='\''#452068'\'';btn.style.transform='\''translateY(0)'\'';});
})();
</script>'

PAGES=(
  "enrollment-calculator.html"
  "es/corredor-de-seguros-de-salud-miami.html"
  "es/medicare-medicaid-miami.html"
  "healthcare-insurance-for-seniors.html"
  "independent-health-insurance-broker.html"
  "irmaa-calculator.html"
  "medical-insurance-broker.html"
  "medicare-advantage-vs-supplement-calculator.html"
  "medicare-myths.html"
  "medigap-plan-calculator.html"
)

for page in "${PAGES[@]}"; do
  if [ -f "$page" ]; then
    # Check if already has scroll-to-top
    if grep -q 'id="scrollToTop"' "$page"; then
      echo "✅ $page already has scroll-to-top"
    else
      echo "Adding scroll-to-top to $page..."
      # Find line number of </body>
      LINE=$(grep -n '</body>' "$page" | tail -1 | cut -d: -f1)
      if [ -n "$LINE" ]; then
        # Insert before </body>
        sed -i "${LINE}i\\$SCROLL_CODE" "$page"
        echo "✅ $page updated"
      else
        echo "❌ $page: Could not find </body>"
      fi
    fi
  else
    echo "❌ $page not found"
  fi
done

echo ""
echo "Done!"
