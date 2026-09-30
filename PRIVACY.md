# Privacy policy

Recorder for Google Meet™ is a Chrome extension that records Google Meet audio or video on your own computer. This policy explains what the extension handles and where it goes. Google Meet is a trademark of Google LLC. This extension is not affiliated with or endorsed by Google.

Effective date: 2026-09-30

## What the extension collects

Nothing is collected by the developer. The extension has no account, server, analytics, telemetry, or advertising, and it makes no network requests of its own.

## What the extension handles on your device

- **Meeting audio and video.** When you click **Start recording**, the extension captures the active Google Meet tab using Chrome's tab capture. Recording and encoding happen inside Chrome, and the finished MP3, WAV, WEBM, or MP4 file is saved to your computer through Chrome's download manager. Recordings are never uploaded or sent anywhere.
- **Microphone audio.** Only if you enable the recording microphone, the extension captures the input you select and mixes it into the recording. Microphone access is requested through Chrome's standard permission prompt, and you can revoke it at any time.
- **Settings.** The extension stores the selected microphone ID, whether microphone permission was granted, the current recorder status, your recording preferences, and, if you activate Pro, your license key text in `chrome.storage.local` on your device. This data never leaves your browser and is removed when you uninstall the extension.
- **License key.** A Pro license key is checked entirely offline, on your device, using public-key cryptography built into Chrome. Activating a key never contacts a server; the extension only reads the key text you paste in.

## Sharing and sale of data

No data is sold, shared with, or transferred to any third party. No data is used for purposes unrelated to recording, or to determine creditworthiness or for lending.

The use of information handled by this extension will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Buying Pro

Recorder Pro is bought on PayPal's website through a payment link. The extension never sees or stores payment details. After payment, Supportefy LLC uses the email address PayPal shares with the seller to send your license key, and keeps a record of the key issued to that address. The same applies when you email to claim an early-bird key.

## Links

The popup and the Settings page contain links to the project's GitHub repository, the PayPal payment and donation pages, and an email link for early-bird keys. They open only when you click them, and those sites and services have their own privacy policies.

## Your responsibility when recording

Always obtain consent from meeting participants and follow the recording laws and workplace policies that apply to you.

## Contact

Questions about this policy can be raised through the repository's issue tracker: https://github.com/supportefy-dev/meet-recorder/issues
