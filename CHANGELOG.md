# Changelog

All notable changes to SessionCut are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

The accumulated work from the v1.0.0-prep development cycle. This will become
v1.0.0 on the first published release.

### Added

- **ONNX-based voice activity detection.** Replaced the Python+PyTorch VAD
  pipeline with an in-process Silero VAD ONNX model running through
  `onnxruntime-node`. ~2.4-3.4x faster on real workloads, no more Python
  cold-start, and the installer dropped a ~300MB Python interpreter.
- **Cross-platform GitHub Actions release workflow** (`.github/workflows/release.yml`).
  Tag a version, get both a Mac DMG and a Windows NSIS installer published to
  the GitHub Releases page automatically. Mac whisper-cli is compiled from
  source with Metal acceleration; Windows whisper-cli is downloaded prebuilt.
- **Machine-fingerprint license binding.** Each license key is now bound to
  the first machine that activates it. Online recheck on every launch with a
  7-day offline grace period. Admin can revoke or release bindings via the
  license sheet.
- **OS keychain for secrets.** FTP password is encrypted at rest via Electron's
  `safeStorage` API (Mac Keychain, Windows DPAPI). One-shot migration from the
  prior plaintext-localStorage layout runs on first launch.
- **mp3 and wav support** across Manual Batch, AutoPilot, and Transcription
  queues, including drag-drop, file picker, and OS file associations.
- **Auto-download of whisper models** on first transcription use, with progress
  in the file row. Models cache to `userData/models` and persist forever after.
- **Speech Detection (Advanced)** card in Settings with tunable Speech Merge Gap
  and Min Clip Duration thresholds.
- **Word-Level Timestamps** toggle for caption-style one-word-per-cue SRT/VTT
  output. Disabled UI when format is TXT or JSON (no effect there).
- **File-overwrite protection** on every save site (trims, profanity-filtered
  videos, transcripts) — appends `_1`, `_2` etc. when collision detected.
- **Drag-drop file type validation** with a user-facing toast listing rejected
  files and supported extensions per queue.
- **Speaker Diarization rewrite.** N-speaker support (no 2-speaker state machine
  cap), with names auto-extracted from contextual cues like "Thank you, Steve",
  "I'm Sarah", "introduce John". Forward-propagates names through tdrz
  over-segmentation and breaks correctly when a different speaker addresses the
  named one.
- **README, LICENSE, CHANGELOG**, and a `DOCS/` folder containing executive
  summary, third-party attributions, privacy doc, install guide, and
  troubleshooting reference.

### Changed

- **Default whisper models.** Speed mode uses `large-v3-turbo-q5_0` (~547MB)
  forcing English; Quality mode uses full multilingual `large-v3` (~3GB).
  Replaced the prior base/small/large size dropdown.
- **Trim output extension matches input.** Was previously hardcoded to `.mp4`,
  silently rewriting `.mov` and `.mkv` inputs into MP4 containers; now `.mov`
  in produces `.mov` out, etc.
- **System notifications** consolidated through Electron's main-process
  `Notification` API (was firing both `node-notifier` and Chromium HTML5
  notifications in parallel — duplicates, especially on Manual Batch
  completion). Click on notification now brings the app forward.
- **Settings tab** is scrollable; Speech Detection card surfaces tunables that
  were previously hardcoded.
- **Music false-positive rejection.** New 30s post-merge minimum clip duration
  drops Silero's false positives on intro/outro music. Configurable via the
  new Settings card.
- **Split feature unit fix.** UI dropdown values were in milliseconds but the
  prior pipeline treated them as seconds, making Split mode silently a no-op.
  Now correctly interpreted.
- **`-mc 0` (max context = 0)** added to whisper invocations to break the
  hallucination-loop failure mode where the model regenerates the same phrase
  during silence after speech.

### Removed

- **Python VAD path** (`vad.py`, `silero_vad.jit`, `vad.spec`, the PyInstaller
  artifact, and the runtime fallback in `main.js`). All VAD now runs in-process
  via ONNX.
- **`node-notifier`** dependency. Replaced by Electron's native Notification API.
- **Auto-Translate** and **Remove Filler Words** transcription toggles. Both
  had implementation issues and weren't core to transcription. Profanity Censor
  was retained but moved behind an Advanced toggle.
- **HuggingFace Integration Settings** card (was holding the HF token field for
  the abandoned pyannote diarization path). The new diarization is purely
  text-based.
- **Hardcoded Mac Python path** that broke any non-author dev environment.
- **Diarize.py** (incomplete pyannote-based diarization stub) and
  **silero_vad.jit** (replaced by ONNX export).

### Fixed

- 2-speaker state machine in diarization that incorrectly toggled between two
  speakers regardless of how many actually appeared.
- Doubled "Transcription Complete" notification (caused by an extra
  `trans-batch-update` IPC after the loop).
- Empty transcript output when whisper silently exits 0 (e.g., on an
  unrecognized flag — surfaced as `Whisper produced no <format> output` now).
- `transFormat` and `transMode` not persisting across launches.
- Settings tab being clipped instead of scrollable when the new card overflowed
  the viewport.
