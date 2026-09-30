# README media tools

Scripts that rebuild the README artwork in `assets/readme/`. Run them after the popup or the brand changes, then commit the regenerated files.

| Script | Builds | Needs |
| --- | --- | --- |
| `build_assets.py` | `banner-dark-1280x480.png` (from `assets/media-pack/source/readme-banner.svg`) and `how-it-works-light.png` / `how-it-works-dark.png` (using the icons in `assets/readme/icons/`) | Python 3, Chrome or Edge |
| `demo-gif.mjs` | `popup-demo.gif`, recorded from the real popup with this repository loaded as an unpacked extension | Node 20+, Chrome or Edge, `ffmpeg` on `PATH` |

```powershell
python tools/readme-media/build_assets.py
node tools/readme-media/demo-gif.mjs "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

The feature icons in `assets/readme/icons/` are hand-written SVGs; edit them directly.
