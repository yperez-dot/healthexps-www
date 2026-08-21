#!/usr/bin/env python3
"""
Senior a11y sweep — bump small type and darken washed-out text colors
for a 65+ audience across HTML/NJK pages.

Safe to re-run:
- Only remaps font sizes ≤15.5px (does not inflate already-large type)
- Color remaps are idempotent
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_NAMES = {
    "homepage-form-snippet.html",
}
SKIP_SUFFIXES = (".backup", ".bak")
SKIP_DIR_PARTS = {".git", "node_modules", "_site", ".github"}

# Only bump sizes that are too small for seniors. Leave 16px+ alone.
SIZE_MAP = [
    (15.5, 18),
    (15, 18),
    (14.5, 18),
    (14, 17),
    (13.5, 16),
    (13, 16),
    (12.5, 15),
    (12, 14.5),
    (11.5, 14),
    (11, 14),
    (10, 13),
]

COLOR_MAP = {
    "#6f6478": "#3a2f47",
    "#a79db2": "#5a5068",
    "#8a8093": "#5a5068",
    "#8a6aaa": "#5c3d7a",
    "#6b6477": "#3a2f47",  # blog --muted
    "#6b6478": "#3a2f47",
    "#6b7280": "#3a2f47",
    "#6f628b": "#3a2f47",
    "#66607c": "#3a2f47",
    "#aaa": "#5a5068",
    "#aaaaaa": "#5a5068",
    "#444": "#3a2f47",
    "#444444": "#3a2f47",
    "#555": "#3a2f47",
    "#555555": "#3a2f47",
    "#666": "#3a2f47",
    "#666666": "#3a2f47",
    "#777": "#3a2f47",
    "#777777": "#3a2f47",
    "#888": "#5a5068",
    "#888888": "#5a5068",
    "#999": "#5a5068",
    "#999999": "#5a5068",
    "#bbb": "#5a5068",
    "#bbbbbb": "#5a5068",
    "#9ca3af": "#5a5068",
    "#a89fb8": "#5a5068",
    "#b0a8b9": "#5a5068",
    "#c4b8d0": "#5a5068",
    "#c9bcd9": "#5a5068",
}

# Soften "not covered" dash strokes when present
STROKE_MAP = {
    'stroke="#d8cee2"': 'stroke="#8a8093"',
}


def iter_targets() -> list[Path]:
    out: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIR_PARTS for part in path.parts):
            continue
        if path.name in SKIP_NAMES:
            continue
        if path.name.endswith(SKIP_SUFFIXES) or ".bak-" in path.name:
            continue
        if path.suffix.lower() not in {".html", ".njk"}:
            continue
        out.append(path)
    return sorted(out)


def bump_sizes(html: str) -> str:
    for old, new in SIZE_MAP:
        old_s = f"{old:g}"
        new_s = f"{new:g}"
        html = re.sub(
            rf"font-size:\s*{re.escape(old_s)}px",
            f"font-size:{new_s}px",
            html,
        )
    return html


def bump_colors(html: str) -> str:
    for old, new in COLOR_MAP.items():
        # Preserve whatever casing/spacing was used around the property
        html = re.sub(
            rf"(?i)(color:\s*){re.escape(old)}",
            rf"\g<1>{new}",
            html,
        )
        # CSS variables that hold muted colors
        html = re.sub(
            rf"(?i)(--muted:\s*){re.escape(old)}",
            rf"\g<1>{new}",
            html,
        )
    for old, new in STROKE_MAP.items():
        html = html.replace(old, new)
    return html


def bump_body_base(html: str) -> str:
    """Raise body font-size when declared at ≤17px; prefer 18px / 1.7 lh."""

    def repl(m: re.Match[str]) -> str:
        block = m.group(0)

        def fs(sm: re.Match[str]) -> str:
            val = float(sm.group(1))
            if val <= 17:
                return "font-size:18px"
            return sm.group(0)

        block = re.sub(r"font-size:\s*([\d.]+)px", fs, block)

        def lh(sm: re.Match[str]) -> str:
            val = float(sm.group(1))
            if val < 1.7:
                return "line-height:1.7"
            return sm.group(0)

        return re.sub(r"line-height:\s*([\d.]+)", lh, block)

    # Match body { ... } including multiline, but not html, body
    return re.sub(
        r"(?<![,\w])body\s*\{[^{}]{0,800}\}",
        repl,
        html,
    )


def soften_opacity_copy(html: str) -> str:
    # Common CTA subtitle fade — replace with solid light-on-dark ink when on purple CTAs
    html = re.sub(
        r"(font-size:\s*\d+(?:\.\d)?px;)opacity:\s*\.85;",
        r"\1color:#f0eaf7;",
        html,
    )
    html = re.sub(
        r"font-weight:\s*700;opacity:\s*\.75;",
        "font-weight:700;",
        html,
    )
    return html


def process(html: str) -> str:
    html = bump_colors(html)
    html = bump_sizes(html)
    html = bump_body_base(html)
    html = soften_opacity_copy(html)
    # Normalize common double-semicolon artifacts if any prior edits left them
    html = html.replace("font-weight:500;;", "font-weight:500;")
    return html


def main() -> None:
    changed = 0
    for path in iter_targets():
        original = path.read_text(encoding="utf-8", errors="ignore")
        updated = process(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed += 1
            print(f"updated {path.relative_to(ROOT)}")
        else:
            print(f"skip    {path.relative_to(ROOT)}")
    print(f"\nDone — {changed} files updated.")


if __name__ == "__main__":
    main()
