# 👁 Eyes - Accessibility Chrome Extension

Powerful, sharp, minimal accessibility toolkit for comfortable browsing.
![Eyes Demo](/demo.gif)  

## Features 
- **5 Visual Modes**: Dark (smart native detection for Wikipedia Vector `skin-theme-clientpref-night` + many others; auto-falls back to premium Dark Reader-style filter if native styles don't activate after toggle). Grayscale, Sepia, Blue Light, High Contrast with instant live preview. Preserves site's original color design, hue relationships, and fidelity where possible.
- **Readability Controls**: Line Height (1.0–2.2) and Letter Spacing (-1px to +3px) — dramatically improves long-form reading comfort
- **Live Adjustments**: Brightness, Contrast, Font Scale, Line Height, Letter Spacing
- **Per-Site + Global Settings**: Changes can be site-specific or applied globally (popup manages intelligently)
- **Custom Colors**: Override text, background, and link colors per mode
- **"Apply Globally" Button**: Force-save current settings for all future sites
- **Improved Layout**: Wider popup (no scrolling needed), consistent mode card sizes, increased section padding for better readability, all controls visible at once
- **Toast Feedback**: Clear visual confirmation for all actions
- **Sharp Design**: Zero border-radius, bold red accents, clean Inter + JetBrains Mono typography, excellent spacing and hierarchy, professional minimalism


## Installation (Development)

1. Download or clone this folder.
2. Open Chrome → go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `eyes-extension` folder
6. Pin the extension and click the icon on any webpage


## How It Works

- `manifest.json` — Chrome Extension v3 manifest
- `popup.html` + `popup.js` — Control panel (Tailwind + Font Awesome via CDN, fully themeable)
- `content.js` — Injected on every page. Applies CSS filters or native theme activation, manages styles, handles shortcuts & readability, syncs with storage
- `icons/` — Custom sharp eye logo (red accent on dark)

## Design Philosophy Applied

- **Sharp & Decisive** — Every element uses `border-radius: 0` via `.sharp` class
- **Powerful Red Accent** — `#dc2626` used sparingly on active states, accents, focus rings, status
- **Minimal & Professional** — Strong visual hierarchy, generous but tight spacing, high contrast
- **Dark Mode First-Class** — Full CSS variable + Tailwind dark class support with localStorage persistence
- **Modern Production-Ready** — Tailwind runtime config, clean component patterns, accessible controls

## Notes

- Works on almost all sites (some heavily scripted pages may need a refresh after applying)
- Dark mode intelligently activates native site theme when detected for best visual fidelity and performance; falls back to filter otherwise.

