const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const chokidar = require('chokidar');
const https = require('https');
const ftp = require('basic-ftp'); // Dependency for FTP
const fsPromises = require('fs/promises');
const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, Notification, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

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
let activePythonProcess = null;
let activeFfmpegCommand = null;

// --- QUEUES & TRACKING ---
const autoQueue = [];
let isAutoProcessing = false;
const manualSkippedIds = new Set();
let currentFileId = null;

// --- PATH CONFIGURATION (Platform Aware) ---
const isDev = !app.isPackaged;
const isWin = process.platform === 'win32';
const binExt = isWin ? '.exe' : '';

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
      const file = commandLine.find(arg => arg.match(/\.(mp4|mov|mkv)$/i));
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
  win = new BrowserWindow({
    width: 1000, height: 900,
    backgroundColor: '#1e1e1e',
    icon: path.join(__dirname, 'assets/logo.png'), 
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });
  
  win.loadFile('index.html');

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
      return false;
    }
  });

  if (process.platform === 'win32' && process.argv.length >= 2) {
      const file = process.argv.find(arg => arg.match(/\.(mp4|mov|mkv)$/i));
      if (file) {
          win.webContents.once('did-finish-load', () => {
              win.webContents.send('add-external-file', file);
          });
      }
  }
}

// --- 1. SYSTEM TRAY ---
function createTray() {
    const iconPath = path.join(__dirname, 'assets/logo.png');
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

function sendLog(msg, type='info') {
  // Auto-write to disk
  const logLine = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${msg}\n`;
  fs.appendFileSync(logFilePath, logLine);
  
  // Send to UI
  if(win) win.webContents.send('log-entry', { msg, type });
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
  const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'mkv'] }] });
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
  if (activePythonProcess) activePythonProcess.kill();
  if (activeFfmpegCommand) {
      if (typeof activeFfmpegCommand.kill === 'function') activeFfmpegCommand.kill();
  }
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
ipcMain.handle('check-license', () => {
  return fs.existsSync(licensePath);
});

ipcMain.handle('validate-license', async (event, inputKey) => {
  const targetUrl = `${GOOG_URL}?key=${inputKey.trim().toUpperCase()}`;
  const fetchWithRedirects = (url) => {
    return new Promise((resolve) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(fetchWithRedirects(res.headers.location));
        }
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.valid) {
              fs.writeFileSync(licensePath, JSON.stringify({ key: inputKey, date: Date.now() }));
              resolve({ success: true });
            } else {
              resolve({ success: false, error: json.reason });
            }
          } catch (e) { resolve({ success: false, error: "Server Error (Invalid JSON)" }); }
        });
      }).on('error', (e) => {
        resolve({ success: false, error: "Network Error" });
      });
    });
  };
  return fetchWithRedirects(targetUrl);
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
        try { totalBytes += fs.statSync(p).size; } catch(e){}
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
  if (currentFileId === id) {
    sendLog(`Skipping active file: ${id}`, "warn");
    if (activePythonProcess) activePythonProcess.kill();
    if (activeFfmpegCommand) {
       if (typeof activeFfmpegCommand.kill === 'function') activeFfmpegCommand.kill();
    }
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
    if (!filePath.match(/\.(mp4|mov|mkv)$/i)) return;
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
      new Notification({ title: 'SessionCut', body: 'Batch Processing Complete' }).show();
  }
});

// --- PROCESSOR ---
async function processSingleFile(filePath, uiIndex, config) {
  const filename = path.basename(filePath);
  currentFileId = uiIndex; 
  updateRow(uiIndex, 'Starting...', 'status-scanning');
  win.webContents.send('file-progress', { id: uiIndex, mode: 'scanning', percent: 0, text: 'Starting...' });

  try {
    updateRow(uiIndex, 'Listening...', 'status-scanning');
    win.webContents.send('file-progress', { id: uiIndex, mode: 'scanning', percent: 1, text: 'Listening...' });

    const segments = await runPythonVAD(filePath, ffmpegPath, config.threshold, config.splitMode, config.splitGap);
    
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
        const waveformImage = await generateWaveformBase64(filePath);
        if (isAborted) return; 

        updateRow(uiIndex, 'Reviewing...', 'status-review');
        sendLog(`Waiting for review: ${filename}`);
        if(isWin) win.flashFrame(true);

        const approved = await new Promise(resolve => { 
          reviewResolver = resolve; 
          win.webContents.send('review-request', { index: uiIndex, filename: filename, segments, stats, waveform: waveformImage }); 
        });
        if(isWin) win.flashFrame(false);

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
          updateRow(uiIndex, 'Uploading...', 'status-saving');
          win.webContents.send('file-progress', { id: uiIndex, mode: 'saving', percent: 100, text: 'Uploading...' });
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
  } finally {
      if (currentFileId === uiIndex) currentFileId = null;
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
            win.webContents.send('file-progress', { id: uiIndex, mode: 'saving', percent: 100, text: `Uploading ${i+1}/${filePaths.length}...` });
            await client.uploadFrom(file, remoteName);
        }
        sendLog(`Uploaded ${filePaths.length} files to FTP.`, "success");
    } catch(err) { 
        sendLog(`FTP Error: ${err.message}`, "error"); 
        throw err;
    } 
    finally { client.close(); }
}

function runPythonVAD(filePath, ffmpegBin, threshold, isSplit, splitGap) {
  return new Promise((resolve, reject) => {
    const vadThreshold = threshold ? String(threshold) : '0.5';
    const gap = isSplit ? (splitGap || '300') : '360000';
    let exePath = path.join(process.resourcesPath, `vad${binExt}`); 
    let cmd, args;
    if (fs.existsSync(exePath)) { cmd = exePath; args = [filePath, ffmpegBin, vadThreshold, gap]; } 
    else { cmd = '/Library/Frameworks/Python.framework/Versions/3.11/bin/python3'; args = ['-u', 'vad.py', filePath, ffmpegBin, vadThreshold, gap]; }

    activePythonProcess = spawn(cmd, args);
    const timeout = setTimeout(() => { if (activePythonProcess) { activePythonProcess.kill(); reject(new Error("Timeout")); } }, 900000);
    let finalData = ''; 

    activePythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          if (trimmed.startsWith('{')) {
            const msg = JSON.parse(trimmed);
            if (msg.status === 'progress') {
              win.webContents.send('file-progress', { id: currentFileId, mode: 'scanning', percent: msg.percent, text: 'Listening...' });
            } else if (msg.status === 'success' || msg.status === 'error') { finalData = JSON.stringify(msg); }
          }
        } catch (e) { }
      });
    });
    activePythonProcess.stderr.on('data', d => console.log(`PyLog: ${d}`));
    activePythonProcess.on('close', code => {
      clearTimeout(timeout); activePythonProcess = null;
      if (isAborted) return reject(new Error("Aborted"));
      if (code !== 0 && code !== null) {
          return reject(new Error(`Crash: Python VAD exited with code ${code}`));
      }
      try {
        if (!finalData) throw new Error("No VAD data returned.");
        const res = JSON.parse(finalData);
        if (res.status === 'success') resolve(res.segments); else reject(new Error(res.message));
      } catch (e) { reject(new Error("Analysis failed: " + e.message)); }
    });
    activePythonProcess.on('error', (err) => reject(err));
  });
}

function updateRow(index, status, cssClass) { win.webContents.send('update-row', { index, status, cssClass }); }

// --- TRIM VIDEO WITH SAFE SAVE ---
function trimVideo(file, start, end, outputDir, suffix, config, uiIndex) {
  return new Promise((resolve, reject) => {
    const dir = outputDir || path.dirname(file);
    
    // Construct initial filename
    let baseName = path.basename(file, '.mp4'); 
    // Handle non-mp4 inputs nicely if possible, or assume mp4 output
    if (path.extname(file).toLowerCase() !== '.mp4') {
        baseName = path.basename(file, path.extname(file));
    }
    
    // Initial proposed path
    let outPath = path.join(dir, `${baseName}${suffix}.mp4`);
    
    // COLLISION CHECK: If file exists, append _1, _2, etc.
    let counter = 1;
    while (fs.existsSync(outPath)) {
        outPath = path.join(dir, `${baseName}${suffix}_${counter}.mp4`);
        counter++;
    }

    const buffer = config.buffer !== undefined ? config.buffer : 0.5;
    const startTime = Math.max(0, start - buffer);
    const duration = (end - start) + (buffer * 2); 
    const timeout = setTimeout(() => { if (activeFfmpegCommand) { activeFfmpegCommand.kill(); reject(new Error("Timeout")); } }, 1800000);
    const command = ffmpeg(file).setStartTime(startTime).setDuration(duration);

    if (config && config.normalize) {
        const targetLufs = config.lufs || '-14';
        command.outputOptions(['-c:v copy', '-c:a aac', '-b:a 192k', `-filter:a loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`]);
    } else { command.outputOptions('-c copy'); }

    command
      .on('progress', p => { if (p.percent) win.webContents.send('file-progress', { id: uiIndex, mode: 'saving', percent: Math.round(p.percent), text: 'Saving...' }); })
      .on('end', () => { 
          clearTimeout(timeout); activeFfmpegCommand = null; 
          win.webContents.send('file-progress', { id: uiIndex, mode: 'saving', percent: 100, text: 'Saved' }); 
          // RESOLVE WITH THE ACTUAL FINAL PATH (For FTP)
          resolve(outPath); 
      })
      .on('error', e => { 
          clearTimeout(timeout); activeFfmpegCommand = null; 
          if (!e.message.includes('SIGKILL')) reject(e); else reject(new Error("Aborted")); 
      });
    activeFfmpegCommand = command;
    command.save(outPath);
  });
}

function getDuration(filePath) { return new Promise((resolve) => { ffmpeg.ffprobe(filePath, (err, metadata) => { resolve(err ? 0 : metadata.format.duration); }); }); }
function formatDuration(seconds) {
  if (!seconds) return "0s";
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return (h > 0 ? `${h}h ` : '') + (m > 0 ? `${m}m ` : '') + `${s}s`;
}
function generateWaveformBase64(filePath) {
  return new Promise((resolve, reject) => {
    const tempImg = path.join(app.getPath('temp'), `waveform_${Date.now()}.png`);
    const args = ['-y', '-i', filePath, '-filter_complex', 'aresample=8000,aformat=channel_layouts=mono,showwavespic=s=600x50:colors=#00ffcc', '-frames:v', '1', tempImg];
    activeFfmpegCommand = spawn(ffmpegPath, args);
    activeFfmpegCommand.on('close', (code) => {
      activeFfmpegCommand = null; 
      if (code === 0 && fs.existsSync(tempImg)) {
        try { resolve(Buffer.from(fs.readFileSync(tempImg)).toString('base64')); fs.unlinkSync(tempImg); } catch (e) { resolve(null); }
      } else { resolve(null); }
    });
    activeFfmpegCommand.on('error', () => { activeFfmpegCommand = null; resolve(null); });
  });
}

function initUpdater() {
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-available', () => {
        if(win) win.webContents.send('updater-event', { type: 'update-available' });
    });
    autoUpdater.on('update-not-available', () => {
        if(win) win.webContents.send('updater-event', { type: 'update-not-available' });
    });
    autoUpdater.on('download-progress', (progressObj) => {
        if(win) win.webContents.send('updater-event', { type: 'download-progress', progress: progressObj.percent });
    });
    autoUpdater.on('update-downloaded', () => {
        if(win) win.webContents.send('updater-event', { type: 'update-downloaded' });
    });
    autoUpdater.on('error', (err) => {
        if(win) win.webContents.send('updater-event', { type: 'error', error: err.message });
    });

    ipcMain.on('check-for-updates', () => autoUpdater.checkForUpdatesAndNotify());
    ipcMain.on('install-update', () => {
        isQuitting = true;
        autoUpdater.quitAndInstall();
    });
}