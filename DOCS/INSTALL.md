# Installing SessionCut

This document walks you through installing SessionCut for the first time on
macOS or Windows, including handling the operating system's "unverified app"
warnings, and activating your license.

## Before you start

You need:

1. A SessionCut license key, issued by Jonathan Hartwig. Format looks like
   `XXXX-XXXX-XXXX` or similar.
2. An internet connection (just for the first launch — license activation
   and the optional one-time AI model download).
3. A Mac running macOS 13 (Ventura) or later on Apple Silicon, **or** a
   Windows 10/11 PC (x64).

## macOS (Apple Silicon)

### 1. Download

Go to the SessionCut Releases page on GitHub and download the latest
`SessionCut-x.y.z-arm64.dmg` file.

### 2. Install

Open the DMG. Drag the **SessionCut** icon into your Applications folder.

### 3. First launch — Gatekeeper workaround

SessionCut is not signed with an Apple Developer ID (because we'd rather
charge zero per teammate per year). The first time you launch it,
macOS will refuse to open it and show a warning that the app "cannot be
opened because Apple cannot check it for malicious software."

**To bypass this once:**

1. Open Finder, go to your Applications folder.
2. **Right-click** (or Control-click) on the SessionCut app.
3. Choose **Open** from the context menu.
4. macOS will now show a different dialog with an **Open** button. Click it.

After this one-time exception, SessionCut launches normally for all future
runs. macOS remembers the exception per app per machine.

> If you see a more aggressive Gatekeeper warning that doesn't even offer
> the Open button on right-click, open System Settings → Privacy & Security,
> scroll to the bottom, and there will be a "SessionCut was blocked" entry
> with an "Open Anyway" button. Click it, then re-launch.

### 4. Activate your license

On first launch, SessionCut will show the activation overlay. Type your
license key (case-insensitive — the app uppercases it) and click
**Activate License**. If the key is valid, the overlay disappears and the
app is ready to use.

### 5. (Optional) Test transcription

If you'll be using the Transcription tab: switch to that tab, drop a small
test recording in, pick "Speed (English, fast)" mode and TXT format, then
click **Start AI Processing**. The app will download the whisper model
(~547MB) on the first run with a progress bar — give it a few minutes on
a typical broadband connection. Subsequent transcriptions reuse the cached
model.

## Windows (x64)

### 1. Download

Go to the SessionCut Releases page on GitHub and download the latest
`SessionCut-Setup-x.y.z.exe` file.

### 2. Install — SmartScreen workaround

Double-click the installer. Windows SmartScreen will warn that "Windows
protected your PC" because the installer isn't signed by an established
publisher.

**To bypass this once:**

1. In the SmartScreen warning, click **More info**.
2. A new button appears: **Run anyway**. Click it.
3. The installer proceeds normally — choose installation directory and
   whether to create desktop / Start menu shortcuts.

After installation, normal launches don't trigger SmartScreen.

### 3. First launch and activation

Same as macOS — SessionCut shows the activation overlay; enter your license
key and click **Activate License**.

### 4. (Optional) Test transcription

Same as macOS section 5.

## After installation

### Auto-update

SessionCut checks for updates on launch and roughly every 4 hours while
running. When a new version is available, the app downloads it silently in
the background and prompts you to restart to install.

To check for updates manually: click the version tag in the top-left of
the app header, or the **Check for Updates** button in the About dialog.

### Where files live

| Item | macOS | Windows |
|---|---|---|
| App | `/Applications/SessionCut.app` | `C:\Program Files\SessionCut\` (or chosen install dir) |
| User data (license, log, models) | `~/Library/Application Support/SessionCut/` | `%APPDATA%\SessionCut\` |
| Settings | (in renderer-process localStorage, inside user data) | (same) |

### Uninstalling

- **macOS**: drag SessionCut from Applications to the Trash. Optionally also
  delete `~/Library/Application Support/SessionCut/` to remove your license,
  cached models, and settings.
- **Windows**: use Settings → Apps → SessionCut → Uninstall, or the
  installer's uninstall shortcut. Optionally also delete
  `%APPDATA%\SessionCut\` for a full clean.

## License management

Each license key is bound to one machine on first activation. If you need
to move a license to a different computer (e.g., new laptop), contact
Jonathan Hartwig to release the binding from the old machine.

## Troubleshooting first-launch issues

If the install or first-launch doesn't go as described above, see
[TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.
