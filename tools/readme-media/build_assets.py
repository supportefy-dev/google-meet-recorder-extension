"""Build the README artwork that is derived from other sources.

Outputs (in assets/readme/):
  banner-dark-1280x480.png         dark variant of assets/media-pack/source/readme-banner.svg
  how-it-works-light.png           privacy flow diagram for GitHub's light theme
  how-it-works-dark.png            the same diagram for GitHub's dark theme

Usage: python tools/readme-media/build_assets.py [--chrome PATH]
Needs Google Chrome (or Edge) for SVG to PNG rendering; no Python packages.
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "readme"
ICONS = OUT / "icons"
BANNER_SOURCE = ROOT / "assets" / "media-pack" / "source" / "readme-banner.svg"

DEFAULT_BROWSERS = [
    Path(os.environ.get("ProgramFiles", "")) / "Google/Chrome/Application/chrome.exe",
    Path(os.environ.get("ProgramFiles(x86)", "")) / "Microsoft/Edge/Application/msedge.exe",
    Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    Path("/usr/bin/google-chrome"),
]

# Light banner color -> dark banner color. Chip text on the yellow chip keeps the dark ink.
BANNER_DARK = {
    "#FBFAF6": "#12161A",
    "#EFEDE5": "#1B2320",
    "#202724": "#EEF0EA",
    "#67736D": "#A7B0A9",
    "#A56E00": "#FFC745",
    "#E4E8E1": "#27302B",
}

THEMES = {
    "light": {"bg": "#FFFFFF", "card": "#F6F8FA", "line": "#D0D7DE", "ink": "#1F2328", "muted": "#59636E", "zone": "#2F7D5A"},
    "dark": {"bg": "#0D1117", "card": "#161B22", "line": "#30363D", "ink": "#E6EDF3", "muted": "#8B949E", "zone": "#4FB07E"},
}

FONT = "Segoe UI,Helvetica,Arial,sans-serif"


def find_browser(explicit):
    candidates = [Path(explicit)] if explicit else DEFAULT_BROWSERS
    for path in candidates:
        if path.is_file():
            return path
    sys.exit("Chrome or Edge not found; pass --chrome PATH")


def render(browser, svg_text, width, height, target, scale):
    with tempfile.TemporaryDirectory() as tmp:
        svg = Path(tmp) / "art.svg"
        svg.write_text(svg_text, encoding="utf-8")
        subprocess.run([
            str(browser), "--headless=new", "--disable-gpu", "--hide-scrollbars",
            f"--user-data-dir={Path(tmp) / 'profile'}", f"--force-device-scale-factor={scale}",
            f"--window-size={width},{height}", f"--screenshot={target}", svg.as_uri(),
        ], check=True, capture_output=True, timeout=60)
    print(f"wrote {target.relative_to(ROOT)}")


def dark_banner():
    svg = BANNER_SOURCE.read_text(encoding="utf-8")
    chip_text = 'fill="#202724" font-family="Segoe UI,Arial,sans-serif" font-size="16" font-weight="700" letter-spacing="0.5" text-anchor="middle">MP3 AUDIO'
    svg = svg.replace(chip_text, chip_text.replace("#202724", "@CHIP@"))
    for light, dark in BANNER_DARK.items():
        svg = svg.replace(light, dark)
    return svg.replace("@CHIP@", "#202724")


def icon(name, x, y, size):
    body = (ICONS / f"{name}.svg").read_text(encoding="utf-8")
    inner = re.sub(r"^<svg[^>]*>|</svg>$", "", body.strip())
    return f'<svg x="{x}" y="{y}" width="{size}" height="{size}" viewBox="0 0 48 48">{inner}</svg>'


def diagram(theme):
    t = THEMES[theme]
    steps = [
        ("video", "Google Meet tab", "The meeting you choose"),
        ("levels", "Meet Recorder", "Captures and encodes in Chrome"),
        ("download", "Your Downloads", "MP3, WAV, WEBM or MP4"),
    ]
    card_w, card_h, gap, top = 300, 150, 70, 70
    left = (1280 - (3 * card_w + 2 * gap)) // 2
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="360" viewBox="0 0 1280 360">',
        f'<rect width="1280" height="360" fill="{t["bg"]}"/>',
        f'<rect x="{left - 30}" y="{top - 38}" width="{3 * card_w + 2 * gap + 60}" height="{card_h + 76}" rx="22" fill="none" stroke="{t["zone"]}" stroke-width="2" stroke-dasharray="8 7"/>',
        f'<text x="{left - 8}" y="{top - 14}" fill="{t["zone"]}" font-family="{FONT}" font-size="15" font-weight="700" letter-spacing="1.5">YOUR COMPUTER</text>',
    ]
    for index, (name, title, sub) in enumerate(steps):
        x = left + index * (card_w + gap)
        parts.append(f'<rect x="{x}" y="{top}" width="{card_w}" height="{card_h}" rx="16" fill="{t["card"]}" stroke="{t["line"]}" stroke-width="1.5"/>')
        parts.append(icon(name, x + 26, top + 26, 48))
        parts.append(f'<text x="{x + 26}" y="{top + 106}" fill="{t["ink"]}" font-family="{FONT}" font-size="22" font-weight="700">{title}</text>')
        parts.append(f'<text x="{x + 26}" y="{top + 132}" fill="{t["muted"]}" font-family="{FONT}" font-size="16">{sub}</text>')
        if index < len(steps) - 1:
            ax = x + card_w + 14
            ay = top + card_h // 2
            parts.append(f'<path d="M{ax} {ay}H{ax + gap - 28}M{ax + gap - 38} {ay - 9}l10 9-10 9" fill="none" stroke="{t["muted"]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>')
    parts.append(icon("privacy", left - 30, top + card_h + 60, 34))
    parts.append(f'<text x="{left + 14}" y="{top + card_h + 83}" fill="{t["ink"]}" font-family="{FONT}" font-size="17" font-weight="600">Nothing is uploaded. No account, no server, no tracking.</text>')
    parts.append("</svg>")
    return "".join(parts)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--chrome", help="path to Chrome or Edge")
    browser = find_browser(parser.parse_args().chrome)
    OUT.mkdir(parents=True, exist_ok=True)
    render(browser, dark_banner(), 1280, 480, OUT / "banner-dark-1280x480.png", 1)
    for theme in THEMES:
        render(browser, diagram(theme), 1280, 360, OUT / f"how-it-works-{theme}.png", 2)


if __name__ == "__main__":
    main()
