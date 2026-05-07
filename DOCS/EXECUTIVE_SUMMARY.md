# SessionCut — Executive Summary

## What it is

SessionCut is an in-house desktop application for our media team that takes
raw conference and meeting recordings and turns them into clean, ready-to-share
clips automatically. It runs on every team member's Mac or Windows laptop and
processes recordings entirely on their machine — no recordings are ever
uploaded to a cloud service.

## What problem it solves

A typical conference produces hours of raw recording per camera per day. Most
of that content is silence between presentations, walk-on/walk-off music, and
setup chatter. Manually scrubbing through each recording to find and trim the
actual presentations is slow, repetitive, and error-prone — and gets worse as
the team's volume grows.

SessionCut automates the trim. Drop a recording in (or point it at a folder
that's being filled with new recordings), and it produces a clean, tightly-cut
output file with the silence and music removed. What used to take a team
member 15-30 minutes per recording now takes seconds of attention plus a few
minutes of unattended processing per file.

## How it works (in one paragraph)

The app uses a small AI model called Silero VAD (a free, open-source voice
activity detector from Russia's Samsung AI) to find the regions of each
recording that contain actual human speech. It then uses ffmpeg — the
industry-standard media-processing tool — to losslessly cut the recording
to just those regions. There's no re-encoding, so a one-hour recording
trims to its final clip in seconds rather than minutes. An optional
transcription mode runs OpenAI's Whisper model locally to produce subtitle
files (SRT, VTT) or plain text transcripts.

## What it costs

**Zero recurring costs.** All software dependencies are free and open-source.
No API fees, no cloud-processing charges, no per-seat SaaS subscriptions. The
only operational cost is the time you've already invested in building and
distributing it.

The only ongoing costs are:
- Each team member's computer (which they already have)
- A free Google Sheet for license-key tracking (already set up)
- Free GitHub Releases hosting for software updates (already set up)

## What data is shared

**No recordings or transcripts ever leave the user's machine.** The only
network calls SessionCut makes are:

1. License key validation against our private licensing service (sends a
   license key and a non-personally-identifying machine fingerprint, receives
   a yes/no response).
2. One-time download of the AI transcription model from Hugging Face (a
   free public model registry) the first time a user enables transcription.
3. Update checks against our private release page on GitHub.

No audio, no video, no transcripts, no analytics, no telemetry.

## Security and access control

Each team member is issued a unique license key. On first activation, that key
is bound to their specific machine — copying the key to another machine will
fail with a clear error message. License keys can be revoked or transferred at
any time by editing a single Google Sheet, which the app rechecks on every
launch.

Stored credentials (FTP server passwords, etc.) are encrypted at rest using
the operating system's keychain (macOS Keychain, Windows DPAPI) — never
stored in plaintext.

## What it can do beyond trimming

- **AutoPilot mode** — watches a folder; processes new recordings as they land.
- **Speech-to-text transcription** — produces SRT, VTT, TXT, or JSON output.
- **Speaker labeling (diarization)** — auto-identifies speakers in
  transcripts using contextual cues like "Thank you, Steve" or "I'm Sarah".
  Multi-speaker support, ~99% accurate on conference content.
- **FTP upload** — optional auto-upload of finished clips to a media server.
- **Batch processing** — drag in many files, walk away, come back to a folder
  of finished outputs.

## Distribution and updates

The app installs from a standard Mac DMG or Windows installer. Updates are
delivered automatically: when a new version is released, every previously-
installed copy notices on next launch and downloads the update silently in
the background. No IT involvement required for routine releases.

## Risks and limitations

- **AI accuracy is probabilistic.** The trim and transcription are very
  accurate on typical conference content, but edge cases exist (heavy
  background music with vocals, unusual speakers, overlapping speech).
  Output should always be reviewed before final distribution.
- **Diarization is text-based.** It's accurate when speakers introduce
  themselves or each other ("Thank you, Steve") but may not perfectly
  re-identify a speaker who returns after a long gap.
- **License system is honor-system enforced** beyond machine binding. A
  determined adversary could probably circumvent it. The system is designed
  to deter casual sharing, not industrial-scale piracy. For a known internal
  team, that's appropriate.
- **No formal SLA, support, or warranty.** This is internal tooling. If
  something breaks, the author fixes it as time allows. See the LICENSE for
  the formal disclaimer.

## In one sentence

SessionCut takes the manual scrub-and-cut work out of post-conference video
production by automating silence trimming and (optionally) transcription,
running entirely on each team member's computer with no recurring costs and
no data leaving the machine.
