const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // Context Menu
  showContextMenu: (data) => ipcRenderer.send('show-context-menu', data),
  onResetFileStatus: (callback) => ipcRenderer.on('reset-file-status', (_event, id) => callback(id)),
  onContextRemoveItem: (callback) => ipcRenderer.on('context-remove-item', (_event, id) => callback(id)),

  // FTP
  ftpList: (config) => ipcRenderer.invoke('ftp-list', config),

  // Licensing
  // checkLicense returns { state: 'active'|'unactivated'|'invalid'|'expired', reason?, offline? }
  checkLicense: () => ipcRenderer.invoke('check-license'),
  validateLicense: (key) => ipcRenderer.invoke('validate-license', key),

  // Secrets — FTP password (and any future encrypted values). Stored in OS keychain.
  setSecret: (name, value) => ipcRenderer.invoke('secret-set', name, value),
  getSecret: (name) => ipcRenderer.invoke('secret-get', name),

  // Processing
  startProcessing: (config) => ipcRenderer.send('start-processing', config),
  abortProcessing: () => ipcRenderer.send('abort-processing'),

  // AutoPilot
  startAutoPilot: (config) => ipcRenderer.send('start-auto-pilot', config),
  stopAutoPilot: () => ipcRenderer.send('stop-auto-pilot'),

  // Transcription
  startTranscription: (config) => ipcRenderer.send('start-transcription', config),

  // Review
  reviewResponse: (approved) => ipcRenderer.send('review-response', approved),
  removeItem: (id) => ipcRenderer.send('remove-item', id),

  // Thumbnails
  generateThumbnail: (path, id) => ipcRenderer.send('generate-thumbnail', { filePath: path, id }),
  onThumbnailGenerated: (callback) => ipcRenderer.on('thumbnail-generated', (event, data) => callback(data)),

  // Menu
  onMenuAddFiles: (callback) => ipcRenderer.on('menu-add-files', () => callback()),
  onMenuStartBatch: (callback) => ipcRenderer.on('menu-start-batch', () => callback()),
  onMenuClearQueue: (callback) => ipcRenderer.on('menu-clear-queue', () => callback()),
  onMenuPreferences: (callback) => ipcRenderer.on('menu-preferences', () => callback()),
  onAddExternalFile: (callback) => ipcRenderer.on('add-external-file', (event, path) => callback(path)),

  // NEW: Data & Config
  exportLog: (text) => ipcRenderer.invoke('export-log', text),
  checkDiskSpace: (dir) => ipcRenderer.invoke('check-disk-space', dir),
  getTotalSize: (paths) => ipcRenderer.invoke('get-total-size', paths),

  // Application Info & Updates
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdaterEvent: (callback) => ipcRenderer.on('updater-event', (event, data) => callback(data)),

  // Events
  onUpdateRow: (callback) => ipcRenderer.on('update-row', (event, data) => callback(data)),
  onFileProgress: (callback) => ipcRenderer.on('file-progress', (event, data) => callback(data)),
  onBatchUpdate: (callback) => ipcRenderer.on('batch-update', (event, data) => callback(data)),
  onTransBatchUpdate: (callback) => ipcRenderer.on('trans-batch-update', (event, data) => callback(data)),
  onBatchAborted: (callback) => ipcRenderer.on('batch-aborted', (event, data) => callback(data)),
  onLogEntry: (callback) => ipcRenderer.on('log-entry', (event, data) => callback(data)),
  onReviewRequest: (callback) => ipcRenderer.on('review-request', (event, data) => callback(data)),
});