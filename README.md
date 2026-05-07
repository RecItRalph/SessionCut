# SessionCut

Desktop app that auto-trims silence from conference and meeting recordings, with optional offline transcription and speaker diarization.

Built for media teams who need to turn raw multi-hour recordings into clean, distribution-ready clips without the manual scrub-and-cut work.

## What it does

- **Silence trimming** — drop in a video or audio file; voice-activity detection finds the actual speech, trims surrounding silence and walk-on/walk-off music, and outputs a tightly-cut media file in the same format you put in. Stream-copy fast (no re-encoding).
- **AutoPilot** — point it at a folder; new recordings are automatically processed as they land.
- **Transcription** — local-only speech-to-text using whisper.cpp. Speed mode (English-specialized turbo model) or Quality mode (full multilingual large-v3). Outputs SRT, VTT, TXT, or JSON.
- **Speaker diarization** — auto-labels speakers with names extracted from contextual cues like "Thank you, Steve", "I'm Sarah", or "introduce John".
- **FTP upload** — optional auto-upload of processed clips when a job completes.
- **Cross-platform** — runs on macOS (Apple Silicon) and Windows (x64).
- **Offline** — no files ever leave your machine. The only outbound network calls are license activation/recheck and (one-time, on first transcription use) downloading the whisper model.

## Supported file types

| Queue | Extensions |
|---|---|
| Manual Batch / AutoPilot | `.mp4`, `.mov`, `.mkv`, `.mp3`, `.wav` |
| Transcription | `.mp4`, `.mov`, `.mkv`, `.mp3`, `.wav`, `.m4a` |

## Installation

See [DOCS/INSTALL.md](DOCS/INSTALL.md) for first-launch steps including macOS Gatekeeper and Windows SmartScreen handling.

## License

Proprietary. See [LICENSE](LICENSE).

This software is distributed for use by authorized teammates only. Each license key is bound to one machine on first activation. Contact the author to issue, revoke, or transfer keys.

## Privacy

Files are processed entirely locally. No audio, video, or transcripts are uploaded anywhere. See [DOCS/PRIVACY.md](DOCS/PRIVACY.md) for the full data-handling rundown.

## Third-party software

SessionCut bundles or depends on whisper.cpp, Silero VAD, ffmpeg, Electron, and several other open-source libraries. Full attributions and their licenses in [DOCS/NOTICE.md](DOCS/NOTICE.md).

## Documentation

| Doc | What's in it |
|---|---|
| [DOCS/EXECUTIVE_SUMMARY.md](DOCS/EXECUTIVE_SUMMARY.md) | Plain-language overview for non-technical stakeholders |
| [DOCS/INSTALL.md](DOCS/INSTALL.md) | First-time install and license activation |
| [DOCS/PRIVACY.md](DOCS/PRIVACY.md) | What data the app handles |
| [DOCS/NOTICE.md](DOCS/NOTICE.md) | Open-source attributions |
| [DOCS/TROUBLESHOOTING.md](DOCS/TROUBLESHOOTING.md) | Common issues + fixes |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

## Support

For issues or license requests, contact sessioncutapp@gmail.com.
