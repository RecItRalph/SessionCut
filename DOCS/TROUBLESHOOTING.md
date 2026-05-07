# Troubleshooting

Common issues with SessionCut and how to resolve them. If your problem isn't
covered here, export your system log (Settings → "Export Log to .txt") and
contact Jonathan Hartwig with it attached.

## License and activation

### "Invalid Key"

The license key wasn't found in the licensing service. Check for typos. The
app uppercases keys automatically, so case shouldn't matter.

### "Already activated on another machine — contact admin to reset"

Each license key is bound to the first machine that activates it. If you've
moved to a new computer, contact Jonathan Hartwig to clear the binding from
the old machine, then activate again on the new one.

### "Key Revoked — contact admin"

The license has been deactivated by the admin. Contact Jonathan Hartwig.

### "Network Error — check your internet connection"

License activation requires internet. Verify connectivity. If you're behind
a corporate firewall, ensure outbound HTTPS to `script.google.com` is
allowed.

### "License needs an internet recheck (last verified N days ago)"

You've been offline longer than the 7-day grace period. Connect to the
internet and re-launch the app.

### App keeps showing the activation screen even after I activated

The license file may have been removed (e.g., from a system cleaner). Just
re-enter your key. The new activation will rebind to your current machine
fingerprint, which should match your previous one. If it doesn't (e.g., new
network adapter changed your MAC), the activation may fail with a "bound to
another machine" error — contact Jonathan Hartwig to reset.

## First-launch warnings

### macOS: "SessionCut cannot be opened because Apple cannot check it for malicious software"

This is Gatekeeper. SessionCut isn't signed with an Apple Developer ID. To
bypass once: right-click SessionCut in Applications → Open → Open.

If right-click doesn't show Open: System Settings → Privacy & Security →
scroll to bottom → "SessionCut was blocked" → Open Anyway.

### Windows: "Windows protected your PC"

This is SmartScreen. SessionCut isn't signed with a code-signing certificate.
To bypass once: in the warning, click **More info** → **Run anyway**.

## Transcription

### "Whisper executable not found"

The bundled whisper-cli binary is missing. This shouldn't happen on a
freshly-installed release — try reinstalling. If it persists, contact
Jonathan Hartwig with your log file.

### "Model ggml-X.bin not found" or "Model download failed"

The transcription model couldn't be downloaded. Check internet connectivity
to `huggingface.co`. If you're on a restricted network, models can be
manually placed in your user-data `models/` directory:

- macOS: `~/Library/Application Support/SessionCut/models/`
- Windows: `%APPDATA%\SessionCut\models\`

The exact filenames the app expects:

| Mode | Filename |
|---|---|
| Speed | `ggml-large-v3-turbo-q5_0.bin` |
| Quality | `ggml-large-v3.bin` |
| Diarization (overrides Mode) | `ggml-small.en-tdrz.bin` |

Models can be downloaded from
`https://huggingface.co/ggerganov/whisper.cpp` (and
`https://huggingface.co/akashmjn/tinydiarize-whisper.cpp` for the diarization
model).

### "Whisper produced no output"

Whisper exited cleanly but didn't write a transcript file — usually a sign
of an unsupported flag or corrupted audio. Check the log for the exact
whisper invocation that ran. If the audio is short and silent, this can also
happen because there's nothing to transcribe.

### Transcript contains "[BLANK_AUDIO]" markers

Expected behavior on sections of recording with no speech. Whisper is
explicitly marking those sections rather than hallucinating content. Strip
those lines from the output if needed.

### Transcript repeats the same phrase 50+ times

Should not happen since the `--max-context 0` fix. If you see it, you may
have an old version — check for updates or reinstall the latest release.

### Word-Level Timestamps toggle has no effect

Word-Level Timestamps only affects SRT and VTT output. For TXT or JSON, the
toggle is a no-op (the toggle is greyed out in the UI when format is TXT
or JSON to make this clear).

### Diarization labels are wrong / mixes speakers

Diarization is text-heuristic-based and is most accurate when speakers
introduce themselves or each other ("Thank you, Steve", "I'm Sarah",
"introduce John"). On unstructured back-and-forth conversations with no
verbal name cues, accuracy drops. Manually edit the labels in the output
if needed.

## Manual Batch / AutoPilot

### "No Speech Detected" on a file that clearly has speech

The VAD threshold may be too strict. Try lowering Sensitivity from
Aggressive (0.95) → Standard (0.5) → Loose (0.3). Also check Settings →
Speech Detection → Min Clip Duration; if it's set higher than the actual
speech length in your file, your speech is being filtered out as too short.

### Trim cuts off the end of speech

Increase the Cut Buffer setting in the Manual Batch tab. Default is 0.5s;
0.5-2.0s is reasonable for most content.

### Trim doesn't cut silence after speech

If your file has music after speech (walk-off music, outro), Silero VAD
sometimes mis-classifies sustained vocal-like sounds as speech. Try
increasing Min Clip Duration in Settings, which drops short false
positives.

### AutoPilot isn't picking up new files

Check that:
- The watch folder path is correct (and accessible — not on an unmounted
  network volume).
- The new files have a supported extension (`.mp4`, `.mov`, `.mkv`, `.mp3`,
  `.wav`).
- The files don't already contain the configured suffix (e.g.,
  `_trimmed`) — those are skipped to avoid re-processing.

### FTP upload fails

Verify Host, Username, Password, and Remote Path in Settings. Test the
connection by clicking **Browse** next to Remote Path — that should connect
and list folders. If the browse works but upload fails, the most common
causes are insufficient write permissions in the remote path or a
disconnect mid-transfer.

## Performance

### Transcription is very slow

Speed mode (large-v3-turbo, q5-quantized) is the fastest reliable model and
should run at 8-15x realtime on Apple Silicon and 2-5x realtime on a
modern Windows CPU. If it's slower:

- On Mac: confirm the binary was compiled with Metal. The first transcription
  log line should show GPU initialization. If it's running CPU-only, the
  installer was built without Metal — contact Jonathan Hartwig.
- On Windows: it's CPU-only by default. CUDA versions exist but aren't
  bundled — for very large workloads consider reaching out to discuss a
  CUDA-bundled build.

### Trim is slow

Trim should be near-instantaneous (stream-copy, no re-encoding). If it's
slow:

- Check that you don't have **Normalize Audio** enabled on a long file —
  audio normalization re-encodes the entire audio track, which takes
  proportional to file length.
- Check that the input file isn't on a slow network volume.

### App uses a lot of RAM

The transcription model loads into memory once activated; this can be
1-3GB depending on Speed/Quality mode. RAM is freed when the model is
unloaded between transcription batches. Manual Batch and AutoPilot don't
load the whisper model and use only the small Silero VAD model (~30MB).

## Updates

### Update doesn't appear

The app checks for updates on launch and every ~4 hours. If you don't see a
prompt:

- Click the version tag in the top-left of the app header → in the About
  dialog, click **Check for Updates** to force a check.
- Verify you can reach `github.com` from your network.

### Update fails to download

Auto-updates require internet access and write access to the app's update
location:

- On macOS: `~/Library/Caches/com.sessioncut.app/`
- On Windows: `%LOCALAPPDATA%\sessioncut-updater\`

If the cache directory is locked or full, delete its contents and try the
update again.

## Logs

Detailed event logs live at:

- macOS: `~/Library/Application Support/SessionCut/sessioncut_system.log`
- Windows: `%APPDATA%\SessionCut\sessioncut_system.log`

You can also export the in-app log (which is a subset of the on-disk log)
via Settings → "Export Log to .txt".

When reporting an issue to Jonathan Hartwig, attach the log file (or paste
the last 100-200 lines if it's large).
