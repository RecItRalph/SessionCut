# Third-Party Software Notices

SessionCut incorporates or depends on the following third-party open-source
software components. Each is provided under its own license, the terms of
which apply to that component and govern over the SessionCut LICENSE to the
extent of any conflict with respect to that component.

This file is required to be distributed with the Software. It is included in
the application bundle and in the published release artifacts.

---

## Bundled binaries

### FFmpeg

**Project:** https://ffmpeg.org/
**Source:** Distributed via the [`ffmpeg-static`](https://github.com/eugeneware/ffmpeg-static) and
[`ffprobe-static`](https://github.com/joshwnj/node-ffprobe-static) npm packages, which fetch prebuilt
binaries from the [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) project.

**License:** GNU General Public License v3 (GPL-3.0). Some FFmpeg components
may also be licensed under LGPL.

**Notice:** SessionCut bundles unmodified FFmpeg binaries and invokes them
as separate processes via the `fluent-ffmpeg` library. Source code for the
FFmpeg binaries used is available from BtbN/FFmpeg-Builds and from the FFmpeg
project at https://ffmpeg.org/download.html. The FFmpeg license text is
available at https://www.ffmpeg.org/legal.html.

> Important: GPL-licensed FFmpeg builds carry obligations on whoever
> distributes them. If SessionCut is distributed beyond a small known
> internal team, the author should review FFmpeg licensing obligations with
> qualified counsel and consider switching to LGPL-only FFmpeg builds.

### whisper.cpp (whisper-cli)

**Project:** https://github.com/ggerganov/whisper.cpp
**License:** MIT
**Copyright:** Copyright (c) 2023-2026 Georgi Gerganov

The whisper-cli binary is compiled from source on macOS (with Metal
acceleration) and downloaded from official whisper.cpp releases on Windows.

```
MIT License

Copyright (c) 2023-2026 Georgi Gerganov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Whisper models (downloaded on first transcription use)

**Project:** https://github.com/openai/whisper / https://huggingface.co/ggerganov/whisper.cpp
**License:** MIT (model weights released under MIT by OpenAI; ggml conversions hosted by Georgi Gerganov)

Whisper models are downloaded on first transcription use from
`huggingface.co/ggerganov/whisper.cpp` and cached locally in the user's
application data directory. They are not bundled with the installer.

### Silero VAD

**Project:** https://github.com/snakers4/silero-vad
**License:** MIT
**Copyright:** Copyright (c) 2024-2026 Silero Team

The Silero VAD ONNX model (`silero_vad.onnx`, ~2.3MB) is bundled with
SessionCut and used in-process via `onnxruntime-node`.

---

## npm dependencies

The following packages are bundled in the SessionCut application via npm.
All are MIT-licensed unless otherwise noted.

| Package | Version | License | Project |
|---|---|---|---|
| `electron` | ^29.0.0 | MIT | https://www.electronjs.org/ |
| `electron-builder` | ^24.13.3 | MIT | https://www.electron.build/ |
| `electron-updater` | ^6.1.8 | MIT | https://github.com/electron-userland/electron-builder |
| `electron-window-state` | ^5.0.3 | MIT | https://github.com/mawie81/electron-window-state |
| `onnxruntime-node` | ^1.25.1 | MIT | https://onnxruntime.ai/ |
| `fluent-ffmpeg` | ^2.1.2 | MIT | https://github.com/fluent-ffmpeg/node-fluent-ffmpeg |
| `ffmpeg-static` | ^5.3.0 | GPL-3.0+ for binary, MIT for wrapper | https://github.com/eugeneware/ffmpeg-static |
| `ffprobe-static` | ^3.1.0 | LGPL-2.1+ for binary, MIT for wrapper | https://github.com/joshwnj/node-ffprobe-static |
| `chokidar` | ^3.6.0 | MIT | https://github.com/paulmillr/chokidar |
| `basic-ftp` | ^5.2.0 | MIT | https://github.com/patrickjuchli/basic-ftp |

Each package's full license text is available in `node_modules/<package>/`
within the source distribution and is bundled in the installed application.

Electron itself bundles Chromium (BSD-3-Clause + others) and Node.js (MIT).
The full set of licenses for Electron's bundled components is shipped with
the Electron framework binary inside the SessionCut application.

---

## Acknowledgments

SessionCut would not exist without the work of the maintainers and
contributors of the projects listed above. We are grateful for their
contributions to the open-source ecosystem.
