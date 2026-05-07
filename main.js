const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const chokidar = require('chokidar');
const https = require('https');
const ftp = require('basic-ftp'); // Dependency for FTP
const fsPromises = require('fs/promises');
const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, Notification, shell, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const windowStateKeeper = require('electron-window-state');
const vadOnnx = require('./vad-onnx');

// --- CONFIGURATION ---
const GOOG_URL = "https://script.google.com/macros/s/AKfycbxda09plG0WwAa3uMzqDUQuvkJe_BLzB3zLTFhu756BRu_phV-W2beSspIYX5g73W32aw/exec";

// Windows Notifications need an App ID
if (process.platform === 'win32') {
  app.setAppUserModelId('com.sessioncut.app');
}

ipcMain.handle('get-app-version', () => app.getVersion());

// --- LICENSE CONFIG ---
const licensePath = path.join(app.getPath('userData'), 'license.key');

// --- GLOBAL STATE ---
let win;
let tray = null;
let isQuitting = false; // Flag to handle Tray vs Quit
let isAborted = false;
let watcher = null;
let reviewResolver = null;



// --- QUEUES & TRACKING ---
const autoQueue = [];
let isAutoProcessing = false;
const manualSkippedIds = new Set();
const activeVadJobs = new Map();
const activeFfmpegs = new Map();

// --- PATH CONFIGURATION (Platform Aware) ---
const isDev = !app.isPackaged;
const isWin = process.platform === 'win32';
const binExt = isWin ? '.exe' : '';

// Single source of truth for what file types the Manual Batch + AutoPilot pipelines
// accept. Mirror this list when extending — the drag-drop allow-lists in renderer.js,
// the file-picker dialog filter, and the fileAssociations in package.json all need
// to stay in sync, but the AutoPilot watcher and argv handlers below source from here.
const SUPPORTED_INPUT_EXTS = ['mp4', 'mov', 'mkv', 'mp3', 'wav'];
const supportedInputRe = new RegExp(`\\.(${SUPPORTED_INPUT_EXTS.join('|')})$`, 'i');

const ffmpegPath = isDev
  ? require('ffmpeg-static')
  : path.join(process.resourcesPath, `ffmpeg${binExt}`);

const ffprobePath = isDev
  ? require('ffprobe-static').path
  : path.join(process.resourcesPath, `ffprobe${binExt}`);

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// --- SINGLE INSTANCE LOCK (For File Associations) ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      const file = commandLine.find(arg => supportedInputRe.test(arg));
      if (file) win.webContents.send('add-external-file', file);
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
    createAppMenu();
    initUpdater();
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000);
  });
}

function createWindow() {
  let mainWindowState = windowStateKeeper({
    defaultWidth: 1000,
    defaultHeight: 900
  });

  win = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 800, minHeight: 600,
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, 'assets/logo.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });

  mainWindowState.manage(win);

  win.loadFile('index.html');

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
      return false;
    }
  });

  if (process.platform === 'win32' && process.argv.length >= 2) {
    const file = process.argv.find(arg => supportedInputRe.test(arg));
    if (file) {
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('add-external-file', file);
      });
    }
  }
}

// --- 1. SYSTEM TRAY ---
function createTray() {
  const iconPath = path.join(__dirname, 'assets/SessionCutLogoSquare.png');
  if (!fs.existsSync(iconPath)) return;

  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('SessionCut');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show SessionCut', click: () => win.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => win.show());
}

// --- 2. NATIVE MENU BAR ---
function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Files...',
          accelerator: 'CmdOrCtrl+O',
          click: () => win.webContents.send('menu-add-files')
        },
        { type: 'separator' },
        {
          label: 'Start Batch',
          accelerator: 'CmdOrCtrl+Enter',
          click: () => win.webContents.send('menu-start-batch')
        },
        {
          label: 'Clear Queue',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => win.webContents.send('menu-clear-queue')
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => win.webContents.send('menu-preferences'),
          visible: process.platform !== 'darwin'
        },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { label: 'Close to Tray', accelerator: 'CmdOrCtrl+W', click: () => win.hide() }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => win.webContents.send('menu-preferences')
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit SessionCut', accelerator: 'Command+Q', click: () => { isQuitting = true; app.quit(); } }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on('open-file', (event, path) => {
  event.preventDefault();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.webContents.send('add-external-file', path);
  }
});

// --- HELPER: SEND LOG & AUTO-SAVE ---
const logFilePath = path.join(app.getPath('userData'), 'sessioncut_system.log');

function sendLog(msg, type = 'info') {
  // Auto-write to disk
  const logLine = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${msg}\n`;
  fs.appendFileSync(logFilePath, logLine);

  // Send to UI
  if (win) win.webContents.send('log-entry', { msg, type });
}

// --- HELPER: SYSTEM NOTIFICATIONS ---
// Single source for all system-level notifications (batch complete, errors, etc.).
// Uses Electron's main-process Notification API which routes to NotificationCenter on
// Mac and Windows toast on Win — no node-notifier dep, no Chromium permission dance.
//
// Skips firing when the window has focus, since the user is already watching the app
// and an in-app toast is sufficient. (showToast in renderer.js handles in-app feedback.)
function showSystemNotification(title, body, opts = {}) {
  if (!Notification.isSupported()) return;
  if (win && win.isFocused() && !opts.force) return;
  try {
    const n = new Notification({
      title,
      body,
      icon: path.join(__dirname, 'assets', 'SessionCutLogoSquare.png'),
      silent: false,
    });
    n.on('click', () => {
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    });
    n.show();
  } catch (_e) { /* Notification failures shouldn't break the app */ }
}

// --- THUMBNAIL GENERATOR ---
const thumbQueue = [];
let isThumbProcessing = false;

ipcMain.on('generate-thumbnail', (event, { filePath, id }) => {
  thumbQueue.push({ filePath, id });
  processThumbQueue();
});

async function processThumbQueue() {
  if (isThumbProcessing || thumbQueue.length === 0) return;
  isThumbProcessing = true;
  const { filePath, id } = thumbQueue.shift();
  try {
    const base64 = await generateWaveformBase64(filePath);
    if (base64 && win) {
      win.webContents.send('thumbnail-generated', { id, base64 });
    }
  } catch (e) {
    console.log("Thumb error:", e);
  }
  isThumbProcessing = false;
  setTimeout(processThumbQueue, 50);
}

// --- IPC HANDLERS ---
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'Media', extensions: SUPPORTED_INPUT_EXTS }] });
  return result.filePaths;
});
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('ftp-list', async (event, { host, user, pass, path }) => {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await client.access({
      host: host,
      user: user,
      password: pass,
      secure: false
    });
    const list = await client.list(path);
    const items = list.map(item => ({
      name: item.name,
      isDir: item.isDirectory,
      size: item.size
    })).sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    client.close();
    return { success: true, items: items };
  } catch (err) {
    client.close();
    return { success: false, error: err.message };
  }
});

ipcMain.on('abort-processing', () => {
  isAborted = true;
  for (const proc of activeVadJobs.values()) proc.kill();
  for (const cmd of activeFfmpegs.values()) {
    if (typeof cmd.kill === 'function') cmd.kill();
  }
  activeVadJobs.clear();
  activeFfmpegs.clear();
  win.setProgressBar(-1);
  win.webContents.send('batch-aborted');
  sendLog("Batch Aborted by User", "error");
});

ipcMain.on('review-response', (event, approved) => {
  if (reviewResolver) {
    reviewResolver(approved);
    reviewResolver = null;
  }
});

// --- CONTEXT MENU HANDLER ---
ipcMain.on('show-context-menu', (event, { id, filePath }) => {
  const template = [
    {
      label: 'Play Source File',
      click: () => { shell.openPath(filePath); }
    },
    {
      label: 'Reveal in File Explorer',
      click: () => { shell.showItemInFolder(filePath); }
    },
    { type: 'separator' },
    {
      label: 'Clear Status (Retry)',
      click: () => { event.sender.send('reset-file-status', id); }
    },
    { type: 'separator' },
    {
      label: 'Remove',
      click: () => { event.sender.send('context-remove-item', id); }
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup(win);
});

// --- LICENSE HANDLERS ---
// Defense model: each license key is bound to a specific machine fingerprint on first
// activation. Subsequent rechecks (every launch when online) verify the binding is intact;
// admin revocation propagates the next time the app sees the network. Offline use is
// allowed for LICENSE_GRACE_DAYS since the last successful recheck — covers air travel
// without making the app unusable on a flaky connection.
const LICENSE_GRACE_DAYS = 7;
const LICENSE_FILE_VERSION = 2;
const LICENSE_RECHECK_TIMEOUT_MS = 8000;

// Stable-ish per-machine identifier. SHA-256 of hostname + first non-internal MAC + os/arch.
// MAC can change (new network adapter), in which case the user re-activates and the admin
// clears the binding in the sheet. For ~dozen internal users that's an acceptable trade.
function getMachineFingerprint() {
  const interfaces = os.networkInterfaces();
  let mac = '';
  for (const name of Object.keys(interfaces).sort()) {
    for (const iface of interfaces[name] || []) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        mac = iface.mac;
        break;
      }
    }
    if (mac) break;
  }
  const input = `${os.hostname()}|${mac}|${os.platform()}|${os.arch()}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
}

function callLicenseApi(params) {
  // GET with query params + manual redirect handling. Apps Script web apps return a 302
  // to script.googleusercontent.com on first hit; the redirect target preserves the params.
  const qs = new URLSearchParams(params).toString();
  const targetUrl = `${GOOG_URL}?${qs}`;
  const fetchWithRedirects = (url, hops = 0) =>
    new Promise((resolve) => {
      if (hops > 5) return resolve({ ok: false, error: 'Too many redirects' });
      const req = https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(fetchWithRedirects(res.headers.location, hops + 1));
        }
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ ok: true, json: JSON.parse(body) });
          } catch (_e) {
            resolve({ ok: false, error: 'Invalid response from license server' });
          }
        });
      });
      req.on('error', () => resolve({ ok: false, error: 'Network unreachable' }));
      req.setTimeout(LICENSE_RECHECK_TIMEOUT_MS, () => {
        req.destroy();
        resolve({ ok: false, error: 'License server timeout' });
      });
    });
  return fetchWithRedirects(targetUrl);
}

function readLicenseFile() {
  try {
    if (!fs.existsSync(licensePath)) return null;
    const raw = fs.readFileSync(licensePath, 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

function writeLicenseFile(record) {
  fs.writeFileSync(licensePath, JSON.stringify(record));
}

ipcMain.handle('validate-license', async (_event, inputKey) => {
  const key = String(inputKey || '').trim().toUpperCase();
  if (!key) return { success: false, error: 'Empty key' };
  const fingerprint = getMachineFingerprint();
  const result = await callLicenseApi({ key, fingerprint, action: 'activate' });
  if (!result.ok) return { success: false, error: result.error };
  const json = result.json;
  if (!json.valid) return { success: false, error: json.reason || 'Activation failed' };
  writeLicenseFile({
    version: LICENSE_FILE_VERSION,
    key,
    fingerprint,
    activatedAt: Date.now(),
    lastCheckAt: Date.now(),
  });
  return { success: true };
});

// Returns one of:
//   { state: 'active' }              — license is valid and recent (or recently rechecked)
//   { state: 'active', offline: true } — couldn't reach server but within grace period
//   { state: 'unactivated' }         — no license file
//   { state: 'invalid', reason }     — server says no (revoked, machine mismatch, etc.)
//   { state: 'expired', reason }     — offline + grace period exceeded
ipcMain.handle('check-license', async () => {
  const record = readLicenseFile();
  if (!record || !record.key) return { state: 'unactivated' };

  const fingerprint = getMachineFingerprint();
  const result = await callLicenseApi({
    key: record.key,
    fingerprint,
    action: 'recheck',
  });

  if (result.ok && result.json) {
    if (result.json.valid) {
      writeLicenseFile({
        version: LICENSE_FILE_VERSION,
        key: record.key,
        fingerprint,
        activatedAt: record.activatedAt || Date.now(),
        lastCheckAt: Date.now(),
      });
      return { state: 'active' };
    }
    // Server explicitly rejected — clear local record so the next launch goes to activation.
    try { fs.unlinkSync(licensePath); } catch (_e) { /* ignore */ }
    return { state: 'invalid', reason: result.json.reason || 'License rejected' };
  }

  // Network/server unreachable — fall back to grace-period check.
  const lastCheckAt = record.lastCheckAt || record.date || 0;
  const ageDays = (Date.now() - lastCheckAt) / (1000 * 60 * 60 * 24);
  if (ageDays < LICENSE_GRACE_DAYS) {
    return { state: 'active', offline: true };
  }
  return {
    state: 'expired',
    reason: `License needs an internet recheck (last verified ${Math.floor(ageDays)} days ago).`,
  };
});

// --- SECRET HANDLERS (OS keychain via Electron safeStorage) ---
// Secret values (FTP password) live here instead of in renderer localStorage.
// Storage layout: <userData>/secrets/<name>.bin (encrypted bytes).
const secretsDir = path.join(app.getPath('userData'), 'secrets');

function secretPath(name) {
  // Allow only letters/digits/underscore in names — defends against path traversal.
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('Invalid secret name');
  return path.join(secretsDir, `${name}.bin`);
}

ipcMain.handle('secret-set', async (_event, name, plaintext) => {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'OS encryption unavailable' };
  }
  try {
    const filePath = secretPath(name);
    if (plaintext == null || plaintext === '') {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return { ok: true };
    }
    fs.mkdirSync(secretsDir, { recursive: true });
    const buf = safeStorage.encryptString(String(plaintext));
    fs.writeFileSync(filePath, buf);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('secret-get', async (_event, name) => {
  try {
    const filePath = secretPath(name);
    if (!fs.existsSync(filePath)) return { ok: true, value: '' };
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: 'OS encryption unavailable' };
    }
    const value = safeStorage.decryptString(fs.readFileSync(filePath));
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
// --- EXPORT LOG HANDLER ---
ipcMain.handle('export-log', async (event, logText) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export System Log',
    defaultPath: 'SessionCut_Log.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  if (filePath) {
    fs.writeFileSync(filePath, logText);
    return true;
  }
  return false;
});

// --- DISK SPACE PRE-CHECK ---
ipcMain.handle('check-disk-space', async (event, targetPath) => {
  try {
    // If the specific output folder doesn't exist yet, check the parent drive
    let dirToCheck = targetPath;
    while (!fs.existsSync(dirToCheck)) {
      dirToCheck = path.dirname(dirToCheck);
      if (dirToCheck === path.dirname(dirToCheck)) break;
    }

    // Use Node's native statfs to get drive bytes
    const stats = await fsPromises.statfs(dirToCheck);
    const availableGB = (stats.bavail * stats.bsize) / (1024 ** 3);
    return { success: true, availableGB };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Helper to calculate total input file size
ipcMain.handle('get-total-size', (event, filePaths) => {
  let totalBytes = 0;
  filePaths.forEach(p => {
    try { totalBytes += fs.statSync(p).size; } catch (e) { }
  });
  return totalBytes;
});

// --- REMOVE ITEM HANDLER ---
ipcMain.on('remove-item', (event, id) => {
  manualSkippedIds.add(id);
  const queueIndex = autoQueue.findIndex(item => item.id === id);
  if (queueIndex !== -1) {
    autoQueue.splice(queueIndex, 1);
    sendLog(`Removed from queue: ${id}`, "info");
    return;
  }
  if (activeVadJobs.has(id)) activeVadJobs.get(id).kill();
  if (activeFfmpegs.has(id)) {
    const cmd = activeFfmpegs.get(id);
    if (typeof cmd.kill === 'function') cmd.kill();
  }
});

// --- AUTO PILOT ---
ipcMain.on('start-auto-pilot', (event, config) => {
  if (watcher) watcher.close();
  isAborted = false;
  autoQueue.length = 0;
  isAutoProcessing = false;
  sendLog(`Auto-Pilot Started. Watching: ${config.watchDir}`, "success");

  watcher = chokidar.watch(config.watchDir, {
    ignored: /(^|[\/\\])\../, persistent: true, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 }
  });

  let autoIdCounter = 10000;
  watcher.on('add', async (filePath) => {
    if (!supportedInputRe.test(filePath)) return;
    const filename = path.basename(filePath);
    if (filename.includes(config.suffix)) return;
    const id = `auto-${autoIdCounter++}`;
    win.webContents.send('update-row', { index: id, filename: filename, status: 'Queued', cssClass: 'status-pending' });
    sendLog(`Auto-Pilot detected: ${filename} (Queued)`);
    autoQueue.push({ filePath, id, config });
    processAutoQueue();
  });
});

ipcMain.on('stop-auto-pilot', () => {
  if (watcher) { watcher.close(); watcher = null; autoQueue.length = 0; sendLog("Auto-Pilot Stopped.", "warn"); }
});

async function processAutoQueue() {
  if (isAutoProcessing || autoQueue.length === 0) return;
  isAutoProcessing = true;
  const { filePath, id, config } = autoQueue.shift();
  try {
    if (!isAborted) { await processSingleFile(filePath, id, config); }
  } catch (error) { console.error("AutoPilot Error:", error); }
  finally { isAutoProcessing = false; setTimeout(processAutoQueue, 500); }
}

// --- MANUAL BATCH ---
ipcMain.on('start-processing', async (event, config) => {
  const { files } = config;
  const concurrency = config.concurrency || 1;
  isAborted = false;
  manualSkippedIds.clear();
  sendLog(`Starting Manual Batch (${files.length} files, concurrent: ${concurrency})`, "info");
  win.webContents.send('batch-update', { completed: 0, total: files.length, etc: "Calculating..." });

  const batchStartTime = Date.now();
  let completedCount = 0;
  const queue = [...files];

  const worker = async () => {
    while (queue.length > 0) {
      if (isAborted) break;
      const file = queue.shift();
      const filePath = file.path || file;
      const uiId = file.id || file.path;

      if (manualSkippedIds.has(uiId)) {
        completedCount++;
        win.webContents.send('batch-update', { completed: completedCount, total: files.length, etc: "Skipping..." });
        continue;
      }

      await processSingleFile(filePath, uiId, config);

      completedCount++;
      win.setProgressBar(completedCount / files.length);

      const remaining = files.length - completedCount;
      const elapsedMs = Date.now() - batchStartTime;
      const avgMsPerFile = elapsedMs / completedCount;
      const estimatedRemainingMs = avgMsPerFile * remaining;
      const estimatedSecs = Math.round(estimatedRemainingMs / 1000);
      const etaText = remaining > 0 ? formatDuration(estimatedSecs) : "Finishing...";

      win.webContents.send('batch-update', { completed: completedCount, total: files.length, etc: etaText });
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => worker());
  await Promise.all(workers);

  win.setProgressBar(-1);
  if (!isAborted) {
    sendLog("Batch Processing Complete", "success");
    showSystemNotification('SessionCut', 'Batch Processing Complete!');
  }
});

// --- TRANSCRIPTION BATCH ---
ipcMain.on('start-transcription', async (event, config) => {
  const { files } = config;
  isAborted = false;
  manualSkippedIds.clear();
  sendLog(`Starting Transcription Batch (${files.length} files)`, "info");
  win.webContents.send('trans-batch-update', { completed: 0, total: files.length, etc: "Calculating..." });

  const batchStartTime = Date.now();
  let completedCount = 0;

  for (let i = 0; i < files.length; i++) {
    if (isAborted) break;
    const file = files[i];
    const filePath = file.path;
    const uiId = file.id;

    if (manualSkippedIds.has(uiId)) {
      completedCount++;
      win.webContents.send('trans-batch-update', { completed: completedCount, total: files.length, etc: "Skipping..." });
      continue;
    }

    await processTranscriptionSingle(filePath, uiId, config);

    completedCount++;

    const remaining = files.length - completedCount;
    const elapsedMs = Date.now() - batchStartTime;
    const avgMsPerFile = elapsedMs / completedCount;
    const estimatedRemainingMs = avgMsPerFile * remaining;
    const estimatedSecs = Math.round(estimatedRemainingMs / 1000);
    const etaText = remaining > 0 ? formatDuration(estimatedSecs) : "Finishing...";

    win.webContents.send('trans-batch-update', { completed: completedCount, total: files.length, etc: etaText });
  }

  if (!isAborted) {
    sendLog("Transcription Processing Complete", "success");
    showSystemNotification('SessionCut', 'Transcription Complete');
  }
});

// --- PROCESSOR ---
async function processSingleFile(filePath, uiIndex, config) {
  const filename = path.basename(filePath);
  updateRow(uiIndex, 'Starting...', 'status-scanning');
  win.webContents.send('file-progress', { id: uiIndex, mode: 'scanning', percent: 0, text: 'Starting...' });

  try {
    updateRow(uiIndex, 'Listening...', 'status-scanning');
    win.webContents.send('file-progress', { id: uiIndex, mode: 'scanning', percent: 1, text: 'Listening...' });

    const segments = await runOnnxVAD(filePath, ffmpegPath, config.threshold, config.splitMode, config.splitGap, uiIndex, {
      speechMergeGap: config.speechMergeGap,
      minClipDuration: config.minClipDuration,
    });

    if (isAborted) return;

    updateRow(uiIndex, 'Calculating...', 'status-scanning');
    win.webContents.send('file-progress', { id: uiIndex, mode: 'scanning', percent: 100, text: 'Calculating...' });

    if (segments.length > 0) {
      if (config.reviewMode) {
        const originalSec = await getDuration(filePath);
        let newSec = 0;
        segments.forEach(s => newSec += (s.end - s.start));
        const stats = {
          original: formatDuration(originalSec),
          new: formatDuration(newSec),
          originalRaw: originalSec,
          newRaw: newSec,
          percent: Math.round((newSec / originalSec) * 100)
        };
        const waveformImage = await generateWaveformBase64(filePath, uiIndex);
        if (isAborted) return;

        updateRow(uiIndex, 'Reviewing...', 'status-review');
        sendLog(`Waiting for review: ${filename}`);
        if (isWin) win.flashFrame(true);

        const approved = await new Promise(resolve => {
          reviewResolver = resolve;
          win.webContents.send('review-request', { index: uiIndex, filename: filename, segments, stats, waveform: waveformImage });
        });
        if (isWin) win.flashFrame(false);

        if (!approved) {
          updateRow(uiIndex, 'Skipped', 'status-pending');
          sendLog(`Skipped by user: ${filename}`, "warn");
          return;
        }
      }

      updateRow(uiIndex, 'Saving...', 'status-saving');
      const createdFiles = [];

      for (let j = 0; j < segments.length; j++) {
        if (isAborted) break;
        let suffix = config.suffix;
        if (segments.length > 1) suffix += `_part_${j + 1}`;
        const finalPath = await trimVideo(filePath, segments[j].start, segments[j].end, config.outputDir, suffix, config, uiIndex);
        if (finalPath) createdFiles.push(finalPath);
      }

      if (config.ftp && createdFiles.length > 0 && !isAborted) {
        updateRow(uiIndex, 'Preparing FTP...', 'status-uploading');
        win.webContents.send('file-progress', { id: uiIndex, mode: 'uploading', percent: 0, text: 'Preparing...' });
        await uploadToFtp(createdFiles, config.ftp, uiIndex);
      }

      if (!isAborted) {
        updateRow(uiIndex, 'Done', 'status-done');
        win.webContents.send('file-progress', { id: uiIndex, mode: 'saving', percent: 100, text: 'Done' });
        sendLog(`Processed: ${filename}`, "success");
      }

    } else {
      updateRow(uiIndex, 'No Speech Detected', 'status-no-speech');
      sendLog(`No speech found in: ${filename}`, "warn");
    }

  } catch (err) {
    if (manualSkippedIds.has(uiIndex)) { sendLog(`Run cancelled by user: ${filename}`, "warn"); return; }
    if (!isAborted) {
      console.error(err);
      updateRow(uiIndex, 'Error', 'status-error');
      sendLog(`Error: ${err.message}`, "error");
    } else {
      updateRow(uiIndex, 'Aborted', 'status-error');
    }
  }
}

async function uploadToFtp(filePaths, ftpConfig, uiIndex) {
  const client = new ftp.Client();
  try {
    await client.access({ host: ftpConfig.host, user: ftpConfig.user, password: ftpConfig.pass, secure: false });
    if (ftpConfig.path && ftpConfig.path !== '/') await client.ensureDir(ftpConfig.path);
    for (let i = 0; i < filePaths.length; i++) {
      const file = filePaths[i];
      const remoteName = path.basename(file);

      client.trackProgress(); // clear native tracker to avoid OS TCP buffer jumps

      const fileSize = fs.statSync(file).size;
      const assumedSpeedBpS = 1 * 1024 * 1024; // Start conservative 1 MB/s
      const estimatedMs = Math.max(2000, (fileSize / assumedSpeedBpS) * 1000);
      const intervalMs = 250;
      const stepPercent = 100 / (estimatedMs / intervalMs);

      client.trackProgress(); // clear native tracker 

      let simulatedPct = 1.0;
      const simInterval = setInterval(() => {
        if (simulatedPct < 99) {
          let actualStep = stepPercent;
          if (simulatedPct > 80) {
            const remain = 99 - simulatedPct;
            actualStep = Math.max(0.01, remain * 0.05); // Smooth decay
          }
          simulatedPct += actualStep;
          const displayPct = Math.floor(simulatedPct);
          win.webContents.send('file-progress', { id: uiIndex, mode: 'uploading', percent: displayPct, text: `Uploading ${i + 1}/${filePaths.length} (${displayPct}%)` });
        }
      }, intervalMs);

      await client.uploadFrom(file, remoteName);
      clearInterval(simInterval);
      win.webContents.send('file-progress', { id: uiIndex, mode: 'uploading', percent: 100, text: `Uploading ${i + 1}/${filePaths.length} (100%)` });
    }
    sendLog(`Uploaded ${filePaths.length} files to FTP.`, "success");
  } catch (err) {
    sendLog(`FTP Error: ${err.message}`, "error");
    throw err;
  }
  finally { client.close(); }
}

// Resolves the Silero VAD ONNX model path. Production = bundled in resources;
// dev = checked-in copy under assets/.
function getOnnxModelPath() {
  const prod = path.join(process.resourcesPath, 'silero_vad.onnx');
  if (fs.existsSync(prod)) return prod;
  return path.join(__dirname, 'assets', 'silero_vad.onnx');
}

// Inner merge gap: bridges natural pauses within continuous speech but not long
// silences/music. 30s is comfortably wider than any real inter-syllable gap and
// narrower than the typical silence-and-music interval between conference talks.
const SPEECH_MERGE_GAP_SECONDS = 30;
// Min surviving clip duration: drops orphan short bursts that Silero misclassifies
// as speech (sustained vocal-like sounds in music, brief applause, taps). Real
// conference speech is virtually always longer than this.
const MIN_CLIP_DURATION_SECONDS = 30;

// Re-merges already-filtered segments by a user-supplied gap (Split=ON behavior).
function mergeAdjacentSegments(segments, gapSeconds) {
  if (segments.length === 0) return [];
  const out = [{ start: segments[0].start, end: segments[0].end }];
  for (let i = 1; i < segments.length; i++) {
    const last = out[out.length - 1];
    if (segments[i].start - last.end < gapSeconds) {
      last.end = segments[i].end;
    } else {
      out.push({ start: segments[i].start, end: segments[i].end });
    }
  }
  return out;
}

function runOnnxVAD(filePath, ffmpegBin, threshold, isSplit, splitGap, uiIndex, opts = {}) {
  const vadThreshold = threshold ? parseFloat(threshold) : 0.5;
  // splitGap comes from the UI dropdown in milliseconds (`15000` = 15 sec).
  // The pre-ONNX code path treated that number as seconds, which silently broke
  // Split mode for everyone. Convert correctly here.
  const userSplitGapSec = isSplit ? parseFloat(splitGap || '300000') / 1000 : null;

  // User-tunable from the Settings UI; fall back to module defaults if missing or invalid.
  const speechMergeGap = Number.isFinite(opts.speechMergeGap) && opts.speechMergeGap > 0
    ? opts.speechMergeGap : SPEECH_MERGE_GAP_SECONDS;
  const minClipDuration = Number.isFinite(opts.minClipDuration) && opts.minClipDuration >= 0
    ? opts.minClipDuration : MIN_CLIP_DURATION_SECONDS;

  // Sentinel in activeVadJobs so abort/remove-item can find this run.
  // ONNX runs in-process; cancellation is via the isAborted callback below.
  const sentinel = { kill: () => {} };
  activeVadJobs.set(uiIndex, sentinel);

  return vadOnnx
    .getSpeechSegments({
      videoPath: filePath,
      ffmpegBin,
      modelPath: getOnnxModelPath(),
      threshold: vadThreshold,
      minGapSeconds: speechMergeGap,
      minClipDurationSeconds: minClipDuration,
      onProgress: (pct) => {
        if (!win) return;
        win.webContents.send('file-progress', {
          id: uiIndex,
          mode: 'scanning',
          percent: pct,
          text: 'Listening...',
        });
      },
      isAborted: () => isAborted || manualSkippedIds.has(uiIndex),
    })
    .then((segments) => {
      if (segments.length === 0) return segments;
      if (!isSplit) {
        // Split=OFF: one output spanning the first real speech to the last real speech.
        // Music false positives outside this range are already dropped by the inner filter.
        return [{ start: segments[0].start, end: segments[segments.length - 1].end }];
      }
      // Split=ON: consolidate surviving segments by the user's chosen gap. Anything
      // farther apart than that becomes a separate _part_N output.
      return mergeAdjacentSegments(segments, userSplitGapSec);
    })
    .finally(() => {
      activeVadJobs.delete(uiIndex);
    });
}


function updateRow(index, status, cssClass) { win.webContents.send('update-row', { index, status, cssClass }); }

// --- TRIM MEDIA WITH SAFE SAVE ---
// Renderless contract: the video stream MUST be stream-copied (`-c:v copy` or `-c copy`).
// Re-encoding video is what turns a 30-second trim into a 30-minute trim. If a future change
// adds video filters, gate it behind an explicit "Precise Cut" opt-in — never make it default.
//
// Audio-only inputs (mp3, wav) are also handled — output extension matches input,
// and the normalize codec is picked per-container (the MP3 muxer can't ingest AAC,
// the WAV muxer can't ingest a compressed codec, etc.).
function trimVideo(file, start, end, outputDir, suffix, config, uiIndex) {
  return new Promise((resolve, reject) => {
    const dir = outputDir || path.dirname(file);

    // Output extension matches input. Previously hardcoded to .mp4 which silently
    // rewrote .mov/.mkv inputs into .mp4 containers — fixed alongside audio support.
    const inputExt = path.extname(file).toLowerCase();
    const baseName = path.basename(file, inputExt);
    const outPath = nextAvailablePath(path.join(dir, `${baseName}${suffix}${inputExt}`));

    const buffer = config.buffer !== undefined ? config.buffer : 0.5;
    const startTime = Math.max(0, start - buffer);
    const duration = (end - start) + (buffer * 2);
    const timeout = setTimeout(() => { if (activeFfmpegs.has(uiIndex)) { activeFfmpegs.get(uiIndex).kill(); reject(new Error("Timeout")); } }, 1800000);
    const command = ffmpeg(file).setStartTime(startTime).setDuration(duration);

    if (config && config.normalize) {
      const targetLufs = config.lufs || '-14';
      const filter = `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`;
      if (inputExt === '.wav') {
        // WAV containers carry uncompressed PCM. Re-encode to PCM at original bit depth.
        command.outputOptions([`-c:a pcm_s16le`, `-filter:a ${filter}`]);
      } else if (inputExt === '.mp3') {
        // MP3 muxer can't accept AAC — has to be libmp3lame.
        command.outputOptions([`-c:a libmp3lame`, `-b:a 192k`, `-filter:a ${filter}`]);
      } else {
        // Video container — copy the video stream, re-encode audio to AAC.
        command.outputOptions(['-c:v copy', '-c:a aac', '-b:a 192k', `-filter:a ${filter}`]);
      }
    } else {
      // Pure stream-copy. Works for both video containers and audio-only files.
      command.outputOptions('-c copy');
    }

    command
      .on('progress', p => { if (p.percent) win.webContents.send('file-progress', { id: uiIndex, mode: 'saving', percent: Math.round(p.percent), text: `Saving ${Math.round(p.percent)}%` }); })
      .on('end', () => {
        clearTimeout(timeout); activeFfmpegs.delete(uiIndex);
        win.webContents.send('file-progress', { id: uiIndex, mode: 'saving', percent: 100, text: 'Saved' });
        // RESOLVE WITH THE ACTUAL FINAL PATH (For FTP)
        resolve(outPath);
      })
      .on('error', e => {
        clearTimeout(timeout); activeFfmpegs.delete(uiIndex);
        if (!e.message.includes('SIGKILL')) reject(e); else reject(new Error("Aborted"));
      });
    activeFfmpegs.set(uiIndex, command);
    command.save(outPath);
  });
}

function getDuration(filePath) { return new Promise((resolve) => { ffmpeg.ffprobe(filePath, (err, metadata) => { resolve(err ? 0 : metadata.format.duration); }); }); }

// Returns the input path if no file exists there, otherwise inserts _1/_2/... before
// the extension until an unused name is found. Used everywhere we save output files
// (trims, profanity-filtered video, transcripts) so re-running on the same input
// never silently overwrites a previous result.
function nextAvailablePath(desiredPath) {
  if (!fs.existsSync(desiredPath)) return desiredPath;
  const ext = path.extname(desiredPath);
  const base = desiredPath.slice(0, desiredPath.length - ext.length);
  let counter = 1;
  let candidate;
  do {
    candidate = `${base}_${counter}${ext}`;
    counter++;
  } while (fs.existsSync(candidate));
  return candidate;
}
function formatDuration(seconds) {
  if (!seconds) return "0s";
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return (h > 0 ? `${h}h ` : '') + (m > 0 ? `${m}m ` : '') + `${s}s`;
}
function generateWaveformBase64(filePath, uiIndex) {
  return new Promise((resolve, reject) => {
    const tempImg = path.join(app.getPath('temp'), `waveform_${Date.now()}.png`);
    const args = ['-y', '-i', filePath, '-filter_complex', 'aresample=8000,aformat=channel_layouts=mono,showwavespic=s=600x50:colors=#00ffcc', '-frames:v', '1', tempImg];
    const proc = spawn(ffmpegPath, args);
    activeFfmpegs.set(uiIndex, proc);
    proc.on('close', (code) => {
      activeFfmpegs.delete(uiIndex);
      if (code === 0 && fs.existsSync(tempImg)) {
        try { resolve(Buffer.from(fs.readFileSync(tempImg)).toString('base64')); fs.unlinkSync(tempImg); } catch (e) { resolve(null); }
      } else { resolve(null); }
    });
    proc.on('error', () => { activeFfmpegs.delete(uiIndex); resolve(null); });
  });
}

// --- TRANSCRIPTION LOGIC ---
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);

async function extractAudio16k(videoPath, tempWavPath, uiIndex) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(videoPath)
      .outputOptions(['-ar 16000', '-ac 1', '-c:a pcm_s16le', '-y'])
      .on('progress', p => { if (p.percent) win.webContents.send('file-progress', { id: uiIndex, mode: 'scanning', percent: Math.round(p.percent), text: `Extracting Audio` }); })
      .on('end', () => resolve())
      .on('error', err => reject(err));
    cmd.save(tempWavPath);
  });
}

// --- WHISPER MODEL REGISTRY ---
// Models download to userData/models/ on first use and cache forever after.
// Sources: ggerganov/whisper.cpp on Hugging Face (the canonical mirror).
const MODEL_REGISTRY = {
  'speed': {
    filename: 'ggml-large-v3-turbo-q5_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
    label: 'large-v3-turbo (q5)',
    sizeMB: 547,
  },
  'quality': {
    filename: 'ggml-large-v3.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    label: 'large-v3',
    sizeMB: 3094,
  },
  // Diarization currently still uses tinydiarize. Phase 3 will replace this with a
  // proper speaker-embedding pipeline that works with any transcription model.
  'diarize': {
    filename: 'ggml-small.en-tdrz.bin',
    url: 'https://huggingface.co/akashmjn/tinydiarize-whisper.cpp/resolve/main/ggml-small.en-tdrz.bin',
    label: 'small.en-tdrz',
    sizeMB: 488,
  },
};

const modelCacheDir = path.join(app.getPath('userData'), 'models');

// Returns the absolute path of a model file, downloading it if necessary.
// Honors three lookup locations in order:
//   1. <userData>/models/<filename>          — downloads cached here
//   2. process.resourcesPath/models/<file>   — bundled (not currently used; reserved)
//   3. <repo>/models/<file>                  — dev fallback for local checkouts
async function ensureModel(modelKey, uiIndex) {
  const entry = MODEL_REGISTRY[modelKey];
  if (!entry) throw new Error(`Unknown model: ${modelKey}`);

  const cached = path.join(modelCacheDir, entry.filename);
  if (fs.existsSync(cached)) return cached;
  const bundled = path.join(process.resourcesPath, 'models', entry.filename);
  if (fs.existsSync(bundled)) return bundled;
  const devLocal = path.join(__dirname, 'models', entry.filename);
  if (fs.existsSync(devLocal)) return devLocal;

  fs.mkdirSync(modelCacheDir, { recursive: true });
  sendLog(`Downloading model: ${entry.label} (~${entry.sizeMB}MB)`);
  await downloadWithProgress(entry.url, cached, entry.sizeMB, uiIndex, entry.label);
  sendLog(`Model downloaded: ${entry.filename}`, 'success');
  return cached;
}

function downloadWithProgress(url, destPath, expectedMB, uiIndex, label) {
  return new Promise((resolve, reject) => {
    const tempPath = `${destPath}.partial`;
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_e) { /* ignore */ }
    }
    const file = fs.createWriteStream(tempPath);
    let totalBytes = expectedMB * 1024 * 1024;
    let downloaded = 0;

    const cleanup = () => {
      try { file.close(); } catch (_e) { /* ignore */ }
      try { fs.unlinkSync(tempPath); } catch (_e) { /* ignore */ }
    };

    const fetchFollow = (target, hops = 0) => {
      if (hops > 5) {
        cleanup();
        return reject(new Error('Too many redirects'));
      }
      const req = https.get(target, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); // discard headers-only response body
          return fetchFollow(res.headers.location, hops + 1);
        }
        if (res.statusCode !== 200) {
          cleanup();
          return reject(new Error(`Model download failed: HTTP ${res.statusCode}`));
        }
        const cl = parseInt(res.headers['content-length'] || '0', 10);
        if (cl > 0) totalBytes = cl;

        res.on('data', (chunk) => {
          if (isAborted) {
            req.destroy();
            cleanup();
            return reject(new Error('Aborted'));
          }
          downloaded += chunk.length;
          const pct = Math.min(99, Math.floor((downloaded / totalBytes) * 100));
          if (win) {
            // The renderer appends "{percent}%" for 'scanning' mode automatically — sending
            // it here too would produce "Downloading X 47% 47%". Just send the prefix.
            win.webContents.send('file-progress', {
              id: uiIndex, mode: 'scanning', percent: pct,
              text: `Downloading ${label}`,
            });
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close((err) => {
            if (err) { cleanup(); return reject(err); }
            try { fs.renameSync(tempPath, destPath); resolve(); }
            catch (e) { cleanup(); reject(e); }
          });
        });
        res.on('error', (e) => { cleanup(); reject(e); });
      });
      req.on('error', (e) => { cleanup(); reject(e); });
      req.setTimeout(60000, () => { req.destroy(new Error('Download stalled')); });
    };
    fetchFollow(url);
  });
}

async function processTranscriptionSingle(filePath, uiIndex, config) {
  const filename = path.basename(filePath);
  updateRow(uiIndex, 'Starting...', 'status-scanning');
  win.webContents.send('file-progress', { id: uiIndex, mode: 'scanning', percent: 0, text: 'Preparing...' });

  let tempWavPath = null;
  let baseTempName = null;

  try {
    const tempDir = app.getPath('temp');
    baseTempName = path.join(tempDir, `trans_${Date.now()}_${Math.floor(Math.random() * 10000)}`);
    tempWavPath = `${baseTempName}.wav`;

    // 1. Extract audio
    updateRow(uiIndex, 'Extracting...', 'status-scanning');
    await extractAudio16k(filePath, tempWavPath, uiIndex);
    if (isAborted) throw new Error('Aborted');

    // 2. Transcribe with Whisper
    updateRow(uiIndex, 'Transcribing...', 'status-scanning');
    win.webContents.send('file-progress', { id: uiIndex, mode: 'scanning', percent: 0, text: 'Preparing to Transcribe...' });

    const whisperBin = isWin ? path.join(process.resourcesPath, 'bin', 'whisper.exe') : path.join(process.resourcesPath, 'bin', 'whisper');
    // fallback to dev path if needed
    const actualWhisper = fs.existsSync(whisperBin) ? whisperBin : path.join(__dirname, 'bin', isWin ? 'whisper.exe' : 'whisper');
    if (!fs.existsSync(actualWhisper)) throw new Error('Whisper executable not found.');

    // Model selection. Diarization currently requires the tinydiarize-trained model and
    // overrides the user's mode choice (Phase 3 will decouple). Otherwise mode picks
    // between the fast turbo and the high-quality large-v3.
    let modelKey;
    if (config.speakerDiarization) {
      modelKey = 'diarize';
    } else if (config.mode === 'quality') {
      modelKey = 'quality';
    } else {
      modelKey = 'speed';
    }

    updateRow(uiIndex, 'Loading model...', 'status-scanning');
    const modelPath = await ensureModel(modelKey, uiIndex);
    if (isAborted) throw new Error('Aborted');
    updateRow(uiIndex, 'Transcribing...', 'status-scanning');

    const args = ['-m', modelPath, '-f', tempWavPath, '-oj', '-of', baseTempName];

    // Disable context carryover. Whisper has a well-known failure mode where, on
    // silence/ambient-noise sections after speech, it loops: the previously-generated
    // phrase becomes the prompt for the next chunk, the next chunk has no real speech,
    // so the model regenerates the same phrase. -mc 0 (max-context 0) breaks the
    // feedback. Note: the homebrew/v1.8.4 whisper-cli does NOT support -nc/--no-context,
    // it silently dumps help and exits 0 with no output. -mc is universally supported.
    args.push('-mc', '0');

    // Speed mode forces English (much faster, English-only conferences are the common
    // case). Quality mode lets the model auto-detect the language.
    if (config.mode === 'speed' && !config.speakerDiarization) {
      args.push('-l', 'en');
    }
    if (config.speakerDiarization) args.push('-tdrz');
    // Word-level timestamps only make sense for cue-based formats (SRT/VTT). On TXT
    // they fragment the prose with no visible benefit; on JSON the per-word data is
    // already available via -oj's segment.words.
    // -ml 1 alone means "max 1 character per segment" (whisper.cpp interprets max-len as
    // characters, not words). -sow forces splits on word boundaries — without it you get
    // single-character cues. The pair is required for actual word-level cues.
    if (config.wordTimestamps && (config.format === 'srt' || config.format === 'vtt')) {
      args.push('-ml', '1', '-sow');
    }

    // Add format flags
    if (config.format === 'srt') args.push('-osrt');
    if (config.format === 'vtt') args.push('-ovtt');
    if (config.format === 'txt') args.push('-otxt');
    args.push('-pp'); // Force whisper to emit progress text

    sendLog(`Executing: whisper ${args.join(' ')}`);

    // Spawn whisper
    await new Promise((resolve, reject) => {
      // Pipe stderr to capture progress, drop stdout to prevent buffer deadlock
      const proc = spawn(actualWhisper, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      // Whisper prints progress to stderr usually
      proc.stderr.on('data', d => {
        const out = d.toString();
        const match = out.match(/progress\s*=\s*(\d+)%/i);
        if (match) {
          const p = parseInt(match[1], 10);
          if (!isNaN(p)) {
            // Update UI 0-100% just for the transcription block alone
            win.webContents.send('file-progress', { id: uiIndex, mode: 'scanning', percent: p, text: `Transcribing...` });
          }
        }
      });
      proc.on('close', code => {
        if (code !== 0) reject(new Error(`Whisper exited with ${code}`));
        else resolve();
      });
      proc.on('error', err => reject(err));
    });

    if (isAborted) throw new Error('Aborted');

    // Check if we need to copy a requested output transcript to the final destination
    const targetedOutDir = config.outputDir || path.dirname(filePath);
    sendLog(`Expected format: ${config.format}`);
    if (config.format && config.format !== 'none') {
      const ext = `.${config.format}`;
      const generatedFile = `${baseTempName}${ext}`;
      sendLog(`Looking for Whisper generated file at: ${generatedFile}`);

      if (fs.existsSync(generatedFile)) {
        const desiredTranscriptPath = path.join(targetedOutDir, path.basename(filePath, path.extname(filePath)) + ext);
        const finalTranscriptPath = nextAvailablePath(desiredTranscriptPath);
        if (config.speakerDiarization) {
          let content = fs.readFileSync(generatedFile, 'utf8');
          content = processSpeakerDiarization(content, ext);
          fs.writeFileSync(finalTranscriptPath, content, 'utf8');
        } else {
          fs.copyFileSync(generatedFile, finalTranscriptPath);
        }
        sendLog(`Saved transcript: ${finalTranscriptPath}`, 'success');
      } else {
        // Whisper sometimes exits 0 without producing output (most often: an unsupported
        // CLI flag causes it to print help and exit cleanly). Surface this as an error
        // rather than letting the file silently mark Done.
        const tempFiles = fs.readdirSync(path.dirname(baseTempName)).filter(f => f.startsWith(path.basename(baseTempName)));
        sendLog(`Files found in temp matching prefix: ${tempFiles.join(', ') || '(none)'}`);
        throw new Error(`Whisper produced no ${config.format} output. See log for details.`);
      }
    }

    // Profanity censoring — re-encodes audio with mute/bleep over flagged words.
    // Filler-word removal was dropped in Phase 1 (the implementation had known bugs
    // when combined with profanity, and the feature isn't core to transcription).
    if (config.profanityFilter) {
      updateRow(uiIndex, 'Filtering...', 'status-saving');
      win.webContents.send('file-progress', { id: uiIndex, mode: 'saving', percent: 75, text: 'Filtering Audio...' });

      const jsonPath = `${baseTempName}.json`;
      if (!fs.existsSync(jsonPath)) throw new Error("Whisper JSON output not found needed for filtering.");

      const transcriptData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

      const baseName = path.basename(filePath, path.extname(filePath));
      const outPath = nextAvailablePath(path.join(targetedOutDir, `${baseName}_filtered${path.extname(filePath)}`));

      await applyAdvancedFilters(filePath, outPath, transcriptData, config, uiIndex);
      if (isAborted) throw new Error('Aborted');
      sendLog(`Saved filtered video: ${outPath}`, 'success');
    }

    updateRow(uiIndex, 'Done', 'status-done');
    win.webContents.send('file-progress', { id: uiIndex, mode: 'scanning', percent: 100, text: 'Done' });

  } catch (err) {
    if (err.message === 'Aborted') {
      updateRow(uiIndex, 'Aborted', 'status-error');
    } else {
      console.error(err);
      updateRow(uiIndex, 'Error', 'status-error');
      sendLog(`Transcription Error: ${err.message}`, "error");
    }
  } finally {
    if (tempWavPath && fs.existsSync(tempWavPath)) { try { fs.unlinkSync(tempWavPath); } catch (e) { } }
    if (baseTempName) {
      ['.json', '.srt', '.vtt', '.txt', '.wav'].forEach(ext => {
        const f = `${baseTempName}${ext}`;
        if (fs.existsSync(f)) try { fs.unlinkSync(f) } catch (e) { }
      });
    }
  }
}

async function applyAdvancedFilters(inputFile, outputFile, whisperJson, config, uiIndex) {
  return new Promise((resolve, reject) => {
    // Phase 1 simplification: profanity-only path. Filler-word removal was dropped
    // along with its UI toggle — the implementation had known bugs combining with
    // profanity, and isn't core to transcription. Video stream is always copied.
    let badWords = [];
    if (config.profanityDefault) {
      badWords = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick'];
    }
    if (config.profanityList && config.profanityList.trim().length > 0) {
      const custom = config.profanityList.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
      badWords = badWords.concat(custom);
    }

    const muteSegments = [];
    const bleepSegments = [];

    // Flatten word-level timestamps from whisper's JSON output. The shape varies
    // slightly across whisper.cpp versions — accept any of the known layouts.
    const allWords = [];
    if (whisperJson.transcription && whisperJson.transcription.map) {
      whisperJson.transcription.forEach(seg => {
        if (seg.words) allWords.push(...seg.words);
      });
    } else if (whisperJson.segments) {
      whisperJson.segments.forEach(seg => {
        if (seg.words) allWords.push(...seg.words);
      });
    }

    for (const w of allWords) {
      let start = w.timestamps ? w.timestamps.from / 1000 : (w.start || w.t0 / 100);
      let end = w.timestamps ? w.timestamps.to / 1000 : (w.end || w.t1 / 100);
      if (!start && start !== 0 && w.offsets) start = w.offsets.from / 1000;
      if (!end && w.offsets) end = w.offsets.to / 1000;

      const textLower = (w.text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!badWords.includes(textLower)) continue;
      if (config.censorStyle === 'bleep') bleepSegments.push({ start, end });
      else muteSegments.push({ start, end });
    }

    const cmd = ffmpeg(inputFile);
    let aChain = '[0:a]';
    const filters = [];

    if (muteSegments.length > 0) {
      const volumeStrs = muteSegments.map(seg => `volume=0:enable='between(t,${seg.start},${seg.end})'`);
      filters.push(`${aChain}${volumeStrs.join(',')}[amuted]`);
      aChain = '[amuted]';
    }

    if (bleepSegments.length > 0) {
      cmd.input('sine=f=1000').inputFormat('lavfi');
      const volumeStrs = bleepSegments.map(seg => `volume=1:enable='between(t,${seg.start},${seg.end})'`);
      const duckStrs = bleepSegments.map(seg => `volume=0:enable='between(t,${seg.start},${seg.end})'`);
      filters.push(`[1:a]volume=0,${volumeStrs.join(',')}[ableep]`);
      filters.push(`${aChain}${duckStrs.join(',')}[aducked]`);
      filters.push(`[aducked][ableep]amix=inputs=2:duration=first[aout]`);
    } else {
      filters.push(`${aChain}anull[aout]`);
    }

    cmd.complexFilter(filters.join(';'), ['aout']);
    cmd.outputOptions(['-map 0:v', '-c:v copy']);

    cmd.on('progress', p => { if (p.percent) win.webContents.send('file-progress', { id: uiIndex, mode: 'saving', percent: Math.round(p.percent), text: `Filtering ${Math.round(p.percent)}%` }); })
      .on('end', () => resolve())
      .on('error', err => reject(err));

    activeFfmpegs.set(uiIndex, cmd);
    cmd.save(outputFile);
  });
}

function initUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-available', () => {
    if (win) win.webContents.send('updater-event', { type: 'update-available' });
  });
  autoUpdater.on('update-not-available', () => {
    if (win) win.webContents.send('updater-event', { type: 'update-not-available' });
  });
  autoUpdater.on('download-progress', (progressObj) => {
    if (win) win.webContents.send('updater-event', { type: 'download-progress', progress: progressObj.percent });
  });
  autoUpdater.on('update-downloaded', () => {
    if (win) win.webContents.send('updater-event', { type: 'update-downloaded' });
  });
  autoUpdater.on('error', (err) => {
    if (win) win.webContents.send('updater-event', { type: 'error', error: err.message });
  });

  ipcMain.on('check-for-updates', () => autoUpdater.checkForUpdatesAndNotify());
  ipcMain.on('install-update', () => {
    isQuitting = true;
    autoUpdater.quitAndInstall();
  });
}

// --- DIARIZATION: turn-aware N-speaker post-processor ---
// Whisper-tdrz emits [SPEAKER_TURN] markers between detected turns. The model also
// over-segments — a brief pause inside a single speaker's monologue can produce a
// spurious turn boundary. So we:
//   1) Parse blocks, then merge "continuation" blocks (incomplete sentence + lowercase
//      next-block-start) into single turns. This collapses the over-segmentation.
//   2) Extract speaker NAMES from contextual cues across all turns (multi-pass).
//   3) Propagate names: an unnamed turn between two same-named turns is the same speaker;
//      an unnamed turn after a known speaker stays unnamed (Speaker N) so we don't bleed
//      one speaker's name onto another's content.
//   4) Reassemble with [Speaker]: prefixes.
//
// Limitation: this is text-only. We can't tell if Speaker 1 (Darrell, intro) returns at
// turn 5 unless the text says so. For lecture/keynote content (each speaker takes one
// continuous turn), this works well. For Q&A or back-and-forth, audio embeddings would
// be needed (Phase 3b — deferred until we see real-world failure modes).
function processSpeakerDiarization(text, format) {
  const isSubtitle = (format === '.srt' || format === '.vtt');
  const tokenRegex = /\[SPEAKER_TURN\]|<\|speaker_turn\|>/gi;
  const hasTags = tokenRegex.test(text);

  if (isSubtitle && !hasTags) return text;

  const rawBlocks = (hasTags ? text.split(tokenRegex) : text.split(/\n/))
    .map(b => b.trim())
    .filter(b => b.length > 0);

  if (rawBlocks.length === 0) return text;

  // ---- Pass 1: continuation merging ----
  // A block continues the previous turn if the previous block didn't end in a sentence
  // terminator OR the current block starts with a lowercase letter. Apply unconditionally
  // (was previously gated to !hasTags, which caused tdrz over-segmentation to leak through).
  const isContinuation = (prev, curr) => {
    if (!prev || !curr) return false;
    const lastChar = prev.charAt(prev.length - 1);
    const firstChar = curr.charAt(0);
    if (!['.', '?', '!', '"', "'", ']', ')'].includes(lastChar)) return true;
    if (/[a-z]/.test(firstChar)) return true;
    return false;
  };

  const turns = [];
  for (const block of rawBlocks) {
    if (turns.length > 0 && isContinuation(turns[turns.length - 1].text, block)) {
      turns[turns.length - 1].text += ' ' + block;
    } else {
      turns.push({ text: block });
    }
  }

  // ---- Pass 2: name extraction ----
  const STOP_WORDS = new Set([
    'the', 'uh', 'um', 'ah', 'oh', 'okay', 'yeah', 'yes', 'no', 'so', 'and', 'a',
    'an', 'i', 'we', 'you', 'they', 'he', 'she', 'it', 'this', 'that', 'these',
    'those', 'all', 'some', 'any', 'thanks', 'thank', 'hi', 'hello', 'hey',
  ]);
  const isPlausibleName = (n) => {
    if (!n) return false;
    const cleaned = n.trim();
    if (!/^[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/.test(cleaned)) return false;
    return !STOP_WORDS.has(cleaned.toLowerCase().split(/\s+/)[0]);
  };
  // Cues, ordered by reliability: anything later only fires if the slot is still empty.
  // No /i flag — that would also case-insensitive the name capture, so "introduce our
  // first speaker, Michelle" would match as captured-name="our first". The introducer
  // phrases are explicitly written as case-flexible ([Ii]ntroduce etc.) where needed.
  const NAME_RE = '([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)';
  const PATTERNS = {
    selfIntro: new RegExp(`(?:[Ii]'m|[Ii] am|\\b[Mm]y name is)\\s+${NAME_RE}`),
    thxOpener: new RegExp(`^\\s*(?:Thanks?(?:\\s+you)?|Cheers),?\\s+${NAME_RE}`),
    handoff: new RegExp(`(?:[Ii]ntroduce|[Ww]elcome|[Hh]and(?:ing)?\\s+(?:it\\s+|this\\s+|things?\\s+)?(?:over\\s+)?to|[Pp]ass\\s+(?:it|this|things?)\\s+(?:over\\s+|on\\s+)?to|[Tt]urn\\s+it\\s+over\\s+to|[Oo]ur\\s+(?:first|next|second|third|fourth|fifth|final)\\s+speaker,?|[Nn]ext\\s+up\\s+is|[Jj]oining\\s+us\\s+(?:today\\s+)?is)\\s*${NAME_RE}`),
    direct: new RegExp(`(?:^|[,.\\?!]\\s+)${NAME_RE}\\s*[,.\\?!]`),
  };

  const names = new Array(turns.length).fill(null);
  const setIfEmpty = (idx, name) => {
    if (idx < 0 || idx >= turns.length) return;
    if (!isPlausibleName(name)) return;
    if (!names[idx]) names[idx] = name.trim();
  };

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i].text;
    // Self-introduction names the CURRENT turn's speaker.
    const self = t.match(PATTERNS.selfIntro);
    if (self) setIfEmpty(i, self[1]);
    // "Thank you, Steve" at the start of this turn names the PREVIOUS turn's speaker.
    const thx = t.match(PATTERNS.thxOpener);
    if (thx) setIfEmpty(i - 1, thx[1]);
    // "introduce/welcome/our next speaker, Steve" near end of this turn names the NEXT turn.
    const handoff = t.match(PATTERNS.handoff);
    if (handoff) setIfEmpty(i + 1, handoff[1]);
  }

  // ---- Pass 3: forward-propagate names, with break detection ----
  // For lecture/keynote content, once a speaker is named, subsequent unnamed turns are
  // typically that same speaker continuing through tdrz over-segmentation. We propagate
  // forward — but break the propagation when the current turn ADDRESSES the propagating
  // speaker by name (which means the speaker is someone else, e.g., a moderator or AV
  // helper), or when a self-intro establishes a new name.
  const finalLabels = names.slice();
  let lastNamed = null;
  let speakerCounter = 0;
  let lastWasUnnamed = false;
  let currentUnknownLabel = null;

  // Detects whether the speaker is being addressed by name (which means they're NOT
  // the one speaking). Three signals:
  //   - Name immediately followed by sentence terminator: "...show Michelle."
  //   - Name immediately followed by a comma: "OK Tina, I'll go now." or "Tina, can you..."
  //   - We don't fire on incidental mentions like "as Darrell mentioned" — name is
  //     followed by a non-terminator word, neither pattern matches.
  // False-positive risk: "I asked Sarah, and she said yes" would match the comma form.
  // Acceptable trade — incorrectly attributing one referencing turn to Speaker N is
  // less bad than missing a real address and bleeding speakers together.
  const addressedAtBoundary = (turnText, name) => {
    if (!name) return false;
    const first = name.split(/\s+/)[0];
    const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\s*[.?!]|\\b${escaped}\\s*,`);
    return re.test(turnText);
  };

  for (let i = 0; i < finalLabels.length; i++) {
    if (finalLabels[i]) {
      lastNamed = finalLabels[i];
      lastWasUnnamed = false;
      currentUnknownLabel = null;
      continue;
    }
    const t = turns[i].text;
    // If this turn addresses the propagating speaker by name, the speaker isn't them.
    const breaksFromLastNamed = lastNamed && addressedAtBoundary(t, lastNamed);

    if (lastNamed && !breaksFromLastNamed) {
      // Forward-propagate the most recent named speaker through tdrz over-segmentation.
      finalLabels[i] = lastNamed;
      lastWasUnnamed = false;
      continue;
    }

    // No name to propagate (or propagation broken for this turn) — Speaker N.
    // Consecutive unnamed turns share the label so we don't fragment a single unknown.
    if (!lastWasUnnamed) {
      speakerCounter += 1;
      currentUnknownLabel = `Speaker ${speakerCounter}`;
      lastWasUnnamed = true;
    }
    finalLabels[i] = currentUnknownLabel;
    // We deliberately do NOT null lastNamed after a break. For lecture content the
    // named speaker typically resumes right after a brief interlude (a moderator
    // addressing them), and the next turn's address-detection will independently
    // re-evaluate. If a third party speaks for multiple turns in a row, each one's
    // address-check has to fail individually for them to be (mis-)attributed to
    // the named speaker — accept that imperfection as a Phase 3b/audio-embedding case.
  }

  // ---- Pass 4: reassemble ----
  // For TXT output: [Speaker]:\n<text>, separated by blank lines.
  // For SRT/VTT: prefix the speaker label inline. The cues' own newlines/timestamps are
  // preserved because the text inside each turn already contains them.
  const out = [];
  for (let i = 0; i < turns.length; i++) {
    const label = finalLabels[i];
    const body = turns[i].text;
    if (isSubtitle) {
      out.push(`[${label}]: ${body}`);
    } else {
      out.push(`[${label}]:\n${body}`);
    }
  }
  return out.join(isSubtitle ? ' ' : '\n\n');
}