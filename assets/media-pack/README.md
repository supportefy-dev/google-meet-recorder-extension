# Meet Recorder media pack

Editable SVG artwork and exported PNGs for the extension, Chrome Web Store listing, README, and GitHub social preview. The design uses the existing yellow play mark, warm paper, dark ink, and green accent. No Google logo or endorsement claim appears in the artwork.

## Use these files

| Placement | File | Size |
| --- | --- | --- |
| Chrome Web Store icon | `chrome-web-store/store-icon-128.png` | 128 × 128 PNG, with 16 px transparent padding |
| Chrome Web Store small promo | `chrome-web-store/promo-small-440x280.png` | 440 × 280 PNG |
| Chrome Web Store marquee | `chrome-web-store/promo-marquee-1400x560.png` | 1400 × 560 PNG |
| Store screenshot 1 | `chrome-web-store/screenshot-01-recording-setup-1280x800.png` | 1280 × 800 PNG |
| Store screenshot 2 | `chrome-web-store/screenshot-02-live-recording-1280x800.png` | 1280 × 800 PNG |
| Store screenshot 3 | `chrome-web-store/screenshot-03-microphone-selection-1280x800.png` | 1280 × 800 PNG |
| README banner | `repository/readme-banner-1280x480.png` | 1280 × 480 PNG |
| GitHub social preview | `repository/social-preview-1280x640.png` | 1280 × 640 PNG |

The manifest icons live in the repository's `icons/` folder.

`source/` holds the editable SVGs. Each store screenshot SVG embeds its original repository popup capture, so the source file can be opened on its own. The screenshots present real saved popup images inside full-bleed layouts; no meeting content or user data was invented.

## Submission checks

1. Confirm the released extension version and recapture screenshots if its interface changed.
2. Upload the icon, small promo tile, and at least one screenshot. The marquee is optional. Three screenshots are supplied in the intended display order.
3. Use `repository/social-preview-1280x640.png` in GitHub **Settings > Social preview**; committing it does not activate the preview.

## Suggested store screenshot captions

1. Choose MP3 audio or WEBM video from the active Google Meet tab.
2. Watch Meet, mic, and final recording levels while capture runs.
3. Choose or change a recording microphone independently of Meet.

## Optional video outline

A 30-second walkthrough can show, in order: open a Meet tab, choose Audio or Video, start recording, optionally enable the recording mic, monitor levels, stop and save, and open the downloaded file. Capture it from a test meeting with consent. Do not show participant names or meeting links.

## Design references

- [Chrome Web Store image guidance](https://developer.chrome.com/docs/webstore/best-listing)
- [Chrome Web Store image requirements](https://developer.chrome.com/docs/webstore/images)
- [GitHub social preview guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)
