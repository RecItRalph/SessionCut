# Privacy and Data Handling

This document describes exactly what data SessionCut handles, where it goes,
and what stays on your machine.

**Bottom line up front:** No audio, video, or transcript content ever leaves
your computer. The only outbound network calls are license validation,
update checks, and a one-time download of the AI transcription model on
first use. Everything else is local.

## What SessionCut sends over the network

### License activation and recheck

When you first activate your license key, and on every subsequent app launch
when an internet connection is available, SessionCut sends:

- Your license key
- A non-personally-identifying machine fingerprint (a SHA-256 hash of your
  hostname + first non-internal MAC address + operating system platform/arch,
  truncated to 32 hex characters)
- The action requested (`activate` or `recheck`)

These are sent via HTTPS to a private Google Apps Script endpoint operated by
Jonathan Hartwig (the SessionCut author). The endpoint returns a JSON
response indicating whether the license is valid.

If the recheck cannot reach the endpoint (e.g., you're offline), SessionCut
continues to operate using the most recent successful recheck for up to 7
days. After that grace period, the app prompts for an internet connection
to validate.

**No audio, video, transcript, or recording content is ever transmitted as
part of license validation.**

### Whisper model download (first transcription use only)

The first time you run a transcription, SessionCut downloads a whisper.cpp
model file from `huggingface.co` (a public model registry) over HTTPS:

- Speed mode: `ggml-large-v3-turbo-q5_0.bin` (~547MB)
- Quality mode: `ggml-large-v3.bin` (~3GB)
- Diarization (if enabled): `ggml-small.en-tdrz.bin` (~487MB)

The download URL and progress are visible in the file row during download.
Models are cached in your user data directory and never re-downloaded.

Hugging Face may log the IP address that requests the file, as is typical
for any web download. The request itself is anonymous — your license key,
machine fingerprint, and identity are not transmitted.

### Update checks

On each app launch (and roughly every 4 hours afterward if the app is
running), SessionCut checks for updates against a private GitHub Releases
page. This sends only the standard request-for-latest-release HTTP call;
no identifying information beyond your IP address is transmitted to GitHub.

### What is NOT sent

- The contents of any audio or video file you process
- Any transcript text or output
- Any error logs or diagnostic data (unless you manually export and share them)
- Telemetry, usage statistics, or analytics of any kind
- Information about which files you process, how often, or in what order
- Any clipboard, browser, or other system content

## What SessionCut stores on your machine

### In your user data directory

(`~/Library/Application Support/SessionCut/` on macOS,
`%APPDATA%\SessionCut\` on Windows)

- `license.key` — your license key, the bound machine fingerprint, the
  activation timestamp, and the most recent recheck timestamp. Plain JSON.
- `secrets/ftpPassword.bin` — your FTP server password, if you've configured
  one. Encrypted at rest using your operating system's keychain (macOS
  Keychain via Apple's Data Protection API; Windows DPAPI). The encryption
  key is owned by your user account and not extractable to other users on
  the same machine.
- `models/<model>.bin` — downloaded whisper transcription models.
- `sessioncut_system.log` — a chronological log of operations the app has
  performed, for debugging. Not transmitted anywhere unless you manually
  export it via Settings → "Export Log to .txt".

### In your renderer-process localStorage

- All non-secret settings (output paths, sensitivity values, mode
  preferences, FTP host/user/path — but never the password). Plain JSON.

### In the app's window state file

- Window position, size, and zoom level (managed by `electron-window-state`
  for convenience).

## What about FTP uploads?

If you enable the optional FTP upload feature, your finished output files
(post-trim videos or post-transcription audio) are uploaded to the FTP
server **you configure**. SessionCut connects to that server with your
credentials and uploads exactly the file you've configured to upload —
nothing more.

The FTP destination is not associated with SessionCut, the author, or any
third party — it's whatever server address you typed into Settings.

## Operating system permissions

SessionCut may request these permissions from your OS the first time it
needs them:

- **Notifications** (macOS, Windows) — for batch-complete notifications.
  Decline freely; the app works without it.
- **File system access** — to read input files and write output files in
  the folders you select. Standard permissions; declined or restricted on
  macOS via System Settings → Privacy & Security → Files and Folders.
- **Network access** — for license activation, model download, update check,
  and FTP upload (if configured).

SessionCut does not request access to your microphone, camera, contacts,
calendar, screen recording, or any other sensitive system feature.

## Logs and debug data

If you encounter an issue and want to share a log:

1. Settings → "Export Log to .txt"
2. Review the exported file before sharing — it contains paths to files
   you've processed, license activation events, and ffmpeg/whisper output.
   Edit anything you don't want to share before sending.

The log is never transmitted unless you actively export and share it.

## Children's data, sensitive content

SessionCut is intended for use with content you own or are authorized to
process. If you process recordings that contain children's voices or
sensitive personal data, you are responsible for compliance with applicable
privacy laws (COPPA, GDPR, state privacy acts, etc.). SessionCut does not
transmit such data and does not retain it beyond what's needed for the
processing job.

## Questions

For privacy questions, contact sessioncutapp@gmail.com.

## Effective date

This document is current as of the release date noted in `CHANGELOG.md`.
Material changes to data handling will be reflected in an updated version
of this document and noted in the changelog.
