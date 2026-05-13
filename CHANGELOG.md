# Changelog

All notable changes to SessionCut are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/).

## [1.0.3] — 2026-05-11

Field-report fix: a teammate on a corporate-managed laptop was hitting "Network
Error — check your internet connection" on every license-activation attempt
across four different public WiFi networks (airport, hotel, convention center)
even though the same license-server URL loaded fine in his browser on those
same networks.

### Fixed

- **License activation/recheck on machines with TLS inspection or silent
  corporate proxies.** Switched `callLicenseApi` from Node's `https` module to
  Electron's `net` module. The `net` module uses Chromium's networking stack —
  the same one the embedded browser uses — which honors the OS certificate
  store, system proxy settings, PAC scripts, and silent corporate VPNs. Node's
  `https` has its own bundled CA list and ignores OS-level network config, so
  on machines where AV / endpoint protection MITMs HTTPS with an injected root
  CA, the TLS handshake fails before any request is sent. This was the root
  cause of the field report.
- **Additional diagnostic logging.** When license API calls fail, the
  underlying Chromium error (e.g. `CERT_AUTHORITY_INVALID`, `PROXY_AUTH_REQUIRED`)
  is written to the system log, so future debugging on a teammate's machine
  doesn't require swapping in a debug build.

## [1.0.2] — 2026-05-11

Quick follow-up to v1.0.1 to fix the missing Windows menu and split the Intel
Mac build out of the routine release flow.

### Added

- **About SessionCut** menu item — visible in the SessionCut app menu on macOS
  and in the Help menu on Windows. Opens the same About dialog the version tag
  in the app header already opens, on both platforms (replaces the Mac-only
  `role: 'about'` panel for consistency).

### Fixed

- **Windows menu bar (File / View / Window / Help) was hidden by default on
  certain Win 11 configurations.** Explicitly set `autoHideMenuBar: false` on
  the BrowserWindow and call `setMenuBarVisibility(true)` on Win launch so the
  bar surfaces without requiring Alt.

### Changed

- **Intel Mac build moved off the tag-push trigger.** GitHub's `macos-13`
  runner is heavily capacity-constrained in 2026 and routinely queues for
  hours, blocking the rest of the release flow. Tag pushes now build only
  arm64 + Win (fast — typically < 10 minutes total). The Intel DMG is now
  built via a manual **Run workflow** action from the GitHub Actions tab, with
  the tag as an input; it uploads to the existing release when it eventually
  completes. See the comments at the top of `.github/workflows/release.yml`
  for the exact steps.

## [1.0.1] — 2026-05-08

First post-launch update. Round of bug fixes from v1.0.0 testing plus the Intel
Mac build that was missing from the initial release.

### Added

- **macOS Intel (x64) build.** The release workflow now produces a separate
  `SessionCut-1.0.1-x64.dmg` for Intel Macs alongside the existing arm64 DMG.
  Auto-update on Apple Silicon continues to consume the arm64 manifest as before.
- **Check for Updates...** menu entry. On macOS it lives in the SessionCut app
  menu, on Windows/Linux in the Help menu. Equivalent to the existing button
  inside the About dialog.
- **Window-close confirmation when processing is active.** Closing the main
  window while a batch is in progress now prompts whether to keep processing in
  the background, cancel and quit, or stay open. Idle close behavior unchanged
  (silent hide-to-tray, with a one-time first-launch reminder).

### Fixed

- **Transcription file removal didn't actually stop whisper.** The whisper
  process and the audio-extraction ffmpeg process weren't tracked anywhere, so
  clicking the X on a file mid-transcription marked the row aborted but left
  the underlying process running. Both are now registered with the active-jobs
  map; remove-item kills them immediately.
- **"Batch Complete" notification firing on cancel.** When the user cancelled
  a Manual Batch (or all files were removed mid-batch), a trailing batch-update
  IPC was arriving after the abort and tripping the renderer's
  `total === completed` complete-message branch. The renderer now tracks an
  abort flag and suppresses the false completion. Replaced with "Batch
  Cancelled" / "Queue cleared — batch cancelled" toasts.
- **Transcription tab stuck in processing state after queue emptied mid-batch.**
  Removing all files mid-batch left the Start button hidden and the progress
  card visible. Now resets the tab to its idle state immediately when the
  visible queue empties during processing.
- **Windows window icon was the default Electron icon.** `BrowserWindow.icon`
  was pointing to `assets/logo.png`, a file that doesn't exist. Fixed to use
  `assets/SessionCutLogoSquare.png` for the running window, and added
  `build/icon.png` (1024x1024) so electron-builder generates a proper Windows
  installer + taskbar icon.

### Changed

- **Mac DMG file naming** now always includes the architecture suffix —
  `SessionCut-1.0.1-arm64.dmg` and `SessionCut-1.0.1-x64.dmg` — so teammates
  don't have to guess which file is for their machine.
- **Clear Queue button on the Transcription tab** is now disabled during a
  running batch (matching Manual Batch's behavior).

## [1.0.0] — 2026-05-07

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
