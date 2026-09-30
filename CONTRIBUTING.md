# Contributing

Thanks for helping improve Meet Recorder.

## Before you start

- Search existing issues before opening a new one.
- Keep proposals focused on local recording, reliability, accessibility, privacy, or maintainability.
- Do not introduce telemetry, external recording uploads, remote code, or unnecessary permissions.

## Development

The extension uses plain HTML, CSS, and JavaScript with no build step. Load the repository folder directly from `chrome://extensions` using **Load unpacked**.

Run the static checks before submitting a change:

```powershell
node --check popup.js
node --check mic-permission.js
node --check offscreen.js
node --check service-worker.js
Get-Content -Raw manifest.json | ConvertFrom-Json | Out-Null
```

For capture changes, manually verify:

1. Audio-only MP3 recording and playback.
2. Video WEBM recording and playback.
3. Meet audio while the recording microphone is disabled.
4. Microphone enable, mute, unmute, and device switching.
5. Signal meters and session state after reopening the popup.
6. Stop, download, and a second recording in the same Meet tab.

## Pull requests

- Use a short imperative title.
- Explain the problem and the chosen solution.
- List the checks and manual scenarios you ran.
- Include screenshots for visible interface changes.
- Keep unrelated refactors out of the same pull request.

