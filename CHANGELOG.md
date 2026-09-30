# Changelog

All notable changes to Recorder for Google Meet™ are listed here. Versions follow the extension's `manifest.json`. Download any version from [Releases](https://github.com/supportefy-dev/meet-recorder/releases).

## [4.5.0] - Unreleased

### Added

- Recorder Pro, a one-time $4.99 upgrade: unlimited recording length, video as WEBM or MP4, MP3 at 128 or 192 kbps and lossless WAV, muting or switching the recording mic mid-recording, separate Meet-only and mic-only files, pause and resume, a file name template with a Downloads subfolder, and a start/stop keyboard shortcut (Alt+Shift+R).
- A Settings page for recording options and the Pro license. Keys are checked offline on your computer; nothing is sent anywhere.
- Early bird: the first 100 people who claim get a free Pro key by email; keys never expire.
- A one-time recording notice in the popup, before the first recording, covering what is captured and that everyone's consent is your responsibility.

### Changed

- The free tier records audio (MP3, 64 kbps) up to 40 minutes per recording; a recording that reaches the limit is saved automatically, with warnings at 35 and 39 minutes. The recording mic can still be enabled for free.
- The popup footer now links to Settings and GitHub; the donation link moved to the Settings page.
- Renamed from Meet Recorder to Recorder for Google Meet™, with a non-affiliation notice and seller identification, to comply with Chrome Web Store trademark and disclosure policy.

## [4.4.7] - 2026-09-30

### Changed

- Renamed from Google Meet Recorder to Meet Recorder.
- The extension now keeps the same ID in every future version, so loading a newer folder keeps your saved settings. Coming from 4.4.6 or earlier, the ID changes once and the saved microphone choice does not carry over.
- Rewrote the README with a quick start, features, screenshots, browser support, known limitations, and permissions.

### Added

- The popup footer is visible again, with **Donate** and **GitHub** links.
- [Privacy policy](PRIVACY.md): nothing is collected, and recordings never leave your computer.

## [4.4.6] - 2026-08-09

### Added

- A compact **GitHub** link in the popup privacy footer, opened in a new tab with safe external-link attributes.

## [4.4.5] - 2026-08-09

First public release.

- Record Meet audio directly to compact 64 kbps MP3 files.
- Record Meet video with mixed tab audio to WEBM.
- Enable, mute, unmute, and switch the recording microphone independently of Google Meet.
- Monitor Meet, microphone, and final recording levels live.
- Keep recording when the extension popup is closed.
- Process and save everything locally, with no account or cloud upload.

[4.4.7]: https://github.com/supportefy-dev/meet-recorder/releases/tag/v4.4.7
[4.4.6]: https://github.com/supportefy-dev/meet-recorder/releases/tag/v4.4.6
[4.4.5]: https://github.com/supportefy-dev/meet-recorder/releases/tag/v4.4.5
