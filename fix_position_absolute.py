#!/usr/bin/env python3
"""
Remove any lingering old mobile nav CSS with position:absolute
"""
import glob, re

files = [
    'es/agente-de-medicare-miami.html',
    'es/medicare-advantage-en-espanol.html',
    'es/medicare/que-es-medicare.html',
    'es/privacidad.html',
    'medicare-advantage-miami.html',
    'medicare-plan-finder.html',
    'medicare-plans-miami.html',
    'medicare-savings-program.html',
    'medicare/medicare-advantage-plans.html',
    'medicare/medicare-costs.html',
    'medicare/medicare-supplement-plans.html',
    'medicare/new-to-medicare.html',
    'medicare/what-is-medicare.html',
]

for fpath in files:
    with open(fpath) as f:
        h = f.read()
    
    # Find and remove old @media blocks with position:absolute in #nav-links.open
    # Pattern: @media(...){ ... #nav-links.open { ... position: absolute ... } ... }
    
    # Find all @media blocks
    def remove_old_mobile_nav(content):
        lines = content.split('\n')
        result = []
        skip_until = None
        brace_depth = 0
        in_bad_media = False
        
        for i, line in enumerate(lines):
            # Check if this line starts a @media block with old mobile nav
            if '@media' in line and '768px' in line:
                # Check next ~20 lines for position:absolute in #nav-links.open
                preview = '\n'.join(lines[i:min(i+30, len(lines))])
                if '#nav-links.open' in preview and 'position: absolute' in preview and 'width: 290px' in preview:
                    in_bad_media = True
                    brace_depth = 0
            
            if in_bad_media:
                # Count braces to know when media block ends
                brace_depth += line.count('{')
                brace_depth -= line.count('}')
                if brace_depth <= 0:
                    in_bad_media = False
                continue  # Skip this line
            
            result.append(line)
        
        return '\n'.join(result)
    
    h_cleaned = remove_old_mobile_nav(h)
    
    if h != h_cleaned:
        with open(fpath, 'w') as f:
            f.write(h_cleaned)
        print(f"  Cleaned: {fpath} (removed {len(h) - len(h_cleaned)} chars)")
    else:
        print(f"  No change: {fpath}")

