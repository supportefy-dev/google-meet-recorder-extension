<p align="center">
  <img src="assets/media-pack/repository/readme-banner-1280x480.png" alt="Meet Recorder: record locally and keep the file" width="100%">
</p>

<h1 align="center">Meet Recorder</h1>

<p align="center">
  Record audio or video from your active Google Meet tab and save it directly to your computer.<br>
  Audio downloads as MP3, video as WEBM. Add your microphone only when you choose to.
</p>

<p align="center">
  <img alt="Version 4.5.0" src="https://img.shields.io/badge/version-4.5.0-FFC745?style=flat-square&labelColor=202724">
  <img alt="Chrome 116+" src="https://img.shields.io/badge/Chrome-116%2B-202724?style=flat-square&logo=googlechrome&logoColor=white">
  <img alt="Local processing" src="https://img.shields.io/badge/processing-100%25%20local-2F7D5A?style=flat-square">
  <a href="https://paypal.me/BashOM"><img alt="Donate with PayPal" src="https://img.shields.io/badge/donate-PayPal-0070BA?style=flat-square&logo=paypal&logoColor=white"></a>
</p>

<p align="center">
  <a href="https://github.com/supportefy-dev/meet-recorder/releases/latest"><strong>Download the current release</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="PRIVACY.md">Privacy policy</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/supportefy-dev/meet-recorder/issues">Report an issue</a>
</p>

## Quick start

1. Download `meet-recorder-4.4.7.zip` from the [latest release](https://github.com/supportefy-dev/meet-recorder/releases/latest) and extract it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the extracted folder.
3. Open a Google Meet tab, click the extension icon, choose **Audio** or **Video**, and click **Start recording**.
4. Click **Stop and save** when you are done. Chrome downloads the file automatically.

Requires Google Chrome 116 or newer.

## Free vs Pro

Every 4.4.x feature stays free forever. Pro is a one-time $4.99 purchase, paid through PayPal, with the license key emailed to your PayPal address.

**Early bird: Pro is free forever for the first 100 users.** Email bash@supportefy.com to claim your key.

| Feature | Free | Pro |
| --- | --- | --- |
| MP3 64 kbps audio, WEBM video, recording mic, live meters | Yes | Yes |
| MP4 video (falls back to WEBM when Chrome cannot encode it) | | Yes |
| MP3 128/192 kbps and lossless WAV audio | | Yes |
| Separate Meet-only and mic-only files alongside the main recording | | Yes |
| Pause and resume, with the timer excluding paused time | | Yes |
| Custom file name template and a Downloads subfolder | | Yes |
| Keyboard shortcut to start or stop (default Alt+Shift+R) | | Yes |

To activate: open the extension's **Settings**, buy Pro or claim an early-bird key by email, then paste the key and click **Activate**.

## What it records

- **Audio:** the sound you hear in the active Meet tab, saved as a compact 64 kbps MP3.
- **Video:** the Meet tab's picture and mixed audio, saved as WEBM.
- **Your microphone, optionally:** enable, mute, or switch a recording mic from the extension, independent of Meet's own mute button.

Live meters show the Meet, microphone, and final recording levels while you record. Nothing is uploaded: recording and encoding happen inside Chrome.

## See it in action

<table>
  <tr>
    <td align="center" width="33%">
      <img src="assets/media-pack/chrome-web-store/screenshot-01-recording-setup-1280x800.png" alt="Choose audio or video, starting from the active Google Meet tab" width="100%"><br>
      <sub><strong>Choose audio or video</strong></sub>
    </td>
    <td align="center" width="33%">
      <img src="assets/media-pack/chrome-web-store/screenshot-02-live-recording-1280x800.png" alt="Live levels for Meet, mic, and the final recording" width="100%"><br>
      <sub><strong>See levels while recording</strong></sub>
    </td>
    <td align="center" width="33%">
      <img src="assets/media-pack/chrome-web-store/screenshot-03-microphone-selection-1280x800.png" alt="Choosing a recording microphone without losing Meet audio" width="100%"><br>
      <sub><strong>Choose your microphone</strong></sub>
    </td>
  </tr>
</table>

## Install

### From a release ZIP

1. Download the ZIP from the [latest GitHub release](https://github.com/supportefy-dev/meet-recorder/releases/latest), then extract it.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted folder that directly contains `manifest.json`.
6. Reload your Google Meet tab, then pin **Meet Recorder** from Chrome's Extensions menu.

From 4.4.7 on, the extension keeps the same ID in every version, so loading a newer folder keeps your settings. Remove the older unpacked copy first to avoid duplicate cards.

### From source

```powershell
git clone https://github.com/supportefy-dev/meet-recorder.git
```

Then use **Load unpacked** and select the cloned repository folder.

> If another tab recorder or a Tampermonkey recorder is installed, disable it first to avoid capture conflicts.

## How recording works

1. Open the Google Meet tab you want to capture and click the extension icon.
2. Select **Audio** or **Video**, then click **Start recording**. Meet audio starts immediately.
3. Optionally click **Enable recording mic** and approve Chrome's one-time microphone prompt.
4. Reopen the popup at any time to check the timer and live meters.
5. Click **Stop and save**. Chrome downloads the completed file automatically.

| Mode | File | Encoding |
| --- | --- | --- |
| Audio | `.mp3` | Stereo MP3, 64 kbps |
| Video | `.webm` | Chrome-supported VP9/VP8 video with Opus audio |

Files are named with a timestamp, for example `google-meet-audio-2026-08-10T12-30-00-000Z.mp3`.

The recording microphone is deliberately independent of Google Meet's microphone button. Meet can be muted while the extension records your mic, the extension can mute its own mic without changing Meet, and switching devices does not interrupt Meet audio. Microphone permission is requested only when you enable the recording mic.

### Known limitations

- Capture starts from the active Meet tab, so start recording while that tab is in front.
- Another extension that is already capturing the tab can block or silence the recording.
- Recordings are saved through Chrome Downloads, in Chrome's download folder.

## Privacy and permissions

Recording and encoding happen inside Chrome. The extension creates a local file and hands it to Chrome's download manager; it never uploads recordings or sends them to any server. It stores only the selected microphone and recorder status in `chrome.storage.local`. Read the full [privacy policy](PRIVACY.md).

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Confirms and accesses the Meet tab you selected. |
| `tabCapture` | Captures the active Meet tab's audio and optional video. |
| `offscreen` | Keeps recording and encoding alive after the popup closes. |
| `downloads` | Saves the completed MP3 or WEBM file locally. |
| `storage` | Remembers recorder status and the selected microphone. |

Always obtain consent from meeting participants and follow the recording laws and workplace policies that apply to you.

## Troubleshooting

### Meet audio is silent

- Start the recording while the Google Meet tab is active.
- Confirm the Meet tab itself is producing sound.
- Stop other tab-recording extensions that may already own the capture stream.

### Microphone is unavailable

- Click **Enable recording mic** and allow access on the permission page.
- Check Chrome's microphone permission for the extension.
- Choose another device from the extension's microphone list.

### Chrome still shows an old icon or interface

Open `chrome://extensions`, click **Reload** on the extension card, then reload the Meet tab.

Still stuck? [Open an issue](https://github.com/supportefy-dev/meet-recorder/issues) with your Chrome version and the steps that fail.

## Development

The project uses plain HTML, CSS, and JavaScript with no build step.

| Path | Holds |
| --- | --- |
| `manifest.json` | Manifest V3 extension definition |
| `popup.*` | Recorder interface and controls |
| `mic-permission.*` | One-time microphone permission screen |
| `offscreen.*` | Capture, mixing, metering, and encoding engine |
| `service-worker.js` | Recorder lifecycle, state, and downloads |
| `icons/`, `vendor/` | Extension icons; bundled MP3 encoder and its license |
| `assets/media-pack/` | Store screenshots, promo tiles, README banner, social preview, and their editable SVGs |

Before loading or submitting a change, validate the scripts and manifest:

```powershell
node --check popup.js
node --check mic-permission.js
node --check offscreen.js
node --check service-worker.js
Get-Content -Raw manifest.json | ConvertFrom-Json | Out-Null
```

After changing capture behavior, test Audio and Video on a real Meet tab, including mic enable, mute, device switching, popup reopen, and playback of the downloaded file. Issues and focused pull requests are welcome; read [`CONTRIBUTING.md`](CONTRIBUTING.md) first.

## License

Copyright (c) 2026 Supportefy. All rights reserved. The source is public so you can see exactly what the extension does; it is not licensed for reuse or redistribution.

MP3 encoding uses the bundled [`@breezystack/lamejs`](https://www.npmjs.com/package/@breezystack/lamejs) encoder under its own LGPL-3.0 license, included at [`vendor/lamejs.LICENSE`](vendor/lamejs.LICENSE).

## Support development

Meet Recorder is free to use. If it is useful to you, you can [make a one-time donation on PayPal](https://paypal.me/BashOM). Donations are optional and do not unlock features.

You can also help by [reporting a bug](https://github.com/supportefy-dev/meet-recorder/issues) or sharing the project.
