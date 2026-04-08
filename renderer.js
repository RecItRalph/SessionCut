// --- UTILS ---
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
  }
  
  // --- UI ELEMENTS ---
  const ui = {
    // Manual Controls
    addBtn: document.getElementById('addBtn'),
    clearBtn: document.getElementById('clearBtn'),
    outBtn: document.getElementById('outBtn'),
    outPath: document.getElementById('outPath'),
    startBtn: document.getElementById('startBtn'),
    abortBtn: document.getElementById('abortBtn'),
    manualQueueList: document.getElementById('manualQueueList'),
    manualProgressCard: document.getElementById('manualProgressCard'),
    elapsedDisplay: document.getElementById('elapsedDisplay'),
    etcDisplay: document.getElementById('etcDisplay'),
    presetSelect: document.getElementById('presetSelect'),
    savePresetBtn: document.getElementById('savePresetBtn'),
    deletePresetBtn: document.getElementById('deletePresetBtn'),
    exportLogBtn: document.getElementById('exportLogBtn'),
    
    // Manual Settings
    manualSensitivity: document.getElementById('manualSensitivity'), 
    manualSplit: document.getElementById('manualSplit'),
    manualSplitGap: document.getElementById('manualSplitGap'), 
    manualSplitGroup: document.getElementById('manualSplitGroup'), 
    manualReview: document.getElementById('manualReview'),
    manualNorm: document.getElementById('manualNorm'),
    manualNormTarget: document.getElementById('manualNormTarget'),
    manualNormTargetGroup: document.getElementById('manualNormTargetGroup'), 
    manualBuffer: document.getElementById('manualBuffer'),
    manualSuffix: document.getElementById('manualSuffix'),
    manualConcurrency: document.getElementById('manualConcurrency'),
    
    // Manual FTP
    manualFtpToggle: document.getElementById('manualFtpToggle'),
  
    // Auto Controls
    watchBtn: document.getElementById('watchBtn'),
    watchPath: document.getElementById('watchPath'),
    autoOutBtn: document.getElementById('autoOutBtn'),
    autoOutPath: document.getElementById('autoOutPath'),
    toggleAutoBtn: document.getElementById('toggleAutoBtn'),
    autoStatus: document.getElementById('autoStatus'),
    autoCard: document.getElementById('autoCard'),
    autoQueueList: document.getElementById('autoQueueList'),
    
    // Auto Settings
    autoSensitivity: document.getElementById('autoSensitivity'), 
    autoSplit: document.getElementById('autoSplit'),
    autoSplitGap: document.getElementById('autoSplitGap'), 
    autoSplitGroup: document.getElementById('autoSplitGroup'), 
    autoNorm: document.getElementById('autoNorm'),
    autoNormTarget: document.getElementById('autoNormTarget'),
    autoNormTargetGroup: document.getElementById('autoNormTargetGroup'), 
    autoBuffer: document.getElementById('autoBuffer'),
    autoSuffix: document.getElementById('autoSuffix'),
  
    // Auto FTP
    autoFtpToggle: document.getElementById('autoFtpToggle'),
    
    // Settings
    globalConcurrency: document.getElementById('globalConcurrency'),
    globalFtpHost: document.getElementById('globalFtpHost'),
    globalFtpUser: document.getElementById('globalFtpUser'),
    globalFtpPass: document.getElementById('globalFtpPass'),
    globalFtpPath: document.getElementById('globalFtpPath'),
  
    // Shared
    systemLog: document.getElementById('systemLog'),
    batchBar: document.getElementById('batchBar'),
    batchCount: document.getElementById('batchCount')
  };
  
  // ==========================================
  // LOG EXPORT
  // ==========================================
  ui.exportLogBtn.addEventListener('click', async () => {
      const logText = ui.systemLog.innerText;
      const saved = await window.electronAPI.exportLog(logText);
      if (saved) showToast("Log exported successfully!", "success");
  });

  // ==========================================
  // PRESET PROFILES
  // ==========================================
  const DEFAULT_PRESETS = {
      "Noisy Hall": { manualSensitivity: "0.95", manualBuffer: "0.1", manualSplit: true, manualSplitGap: "15000", manualNorm: true, manualNormTarget: "-16" },
      "Quiet Studio": { manualSensitivity: "0.5", manualBuffer: "1.0", manualSplit: false, manualNorm: false }
  };

  let userPresets = JSON.parse(localStorage.getItem('sessionCutPresets')) || {};

  function renderPresetDropdown() {
      ui.presetSelect.innerHTML = '<option value="Custom">Custom Settings</option>';
      
      const combined = { ...DEFAULT_PRESETS, ...userPresets };
      for (const [name, _] of Object.entries(combined)) {
          ui.presetSelect.insertAdjacentHTML('beforeend', `<option value="${name}">${name}</option>`);
      }
      
      const current = localStorage.getItem('sessionCutActivePreset') || "Custom";
      ui.presetSelect.value = current;
      ui.deletePresetBtn.style.display = userPresets[current] ? 'block' : 'none';
  }

  ui.presetSelect.addEventListener('change', () => {
      const selected = ui.presetSelect.value;
      localStorage.setItem('sessionCutActivePreset', selected);
      ui.deletePresetBtn.style.display = userPresets[selected] ? 'block' : 'none';
      
      if (selected === "Custom") return;

      const profile = DEFAULT_PRESETS[selected] || userPresets[selected];
      if (!profile) return;

      // Apply settings
      if(profile.manualSensitivity) ui.manualSensitivity.value = profile.manualSensitivity;
      if(profile.manualBuffer) ui.manualBuffer.value = profile.manualBuffer;
      if(profile.manualSplit !== undefined) {
          ui.manualSplit.checked = profile.manualSplit;
          ui.manualSplitGroup.style.display = profile.manualSplit ? 'block' : 'none';
      }
      if(profile.manualSplitGap) ui.manualSplitGap.value = profile.manualSplitGap;
      if(profile.manualNorm !== undefined) {
          ui.manualNorm.checked = profile.manualNorm;
          ui.manualNormTargetGroup.style.display = profile.manualNorm ? 'block' : 'none';
      }
      if(profile.manualNormTarget) ui.manualNormTarget.value = profile.manualNormTarget;
      
      saveSettings();
      showToast(`Loaded Preset: ${selected}`);
  });

  ui.savePresetBtn.addEventListener('click', () => {
      const name = prompt("Enter a name for this preset:");
      if (!name) return;

      userPresets[name] = {
          manualSensitivity: ui.manualSensitivity.value,
          manualBuffer: ui.manualBuffer.value,
          manualSplit: ui.manualSplit.checked,
          manualSplitGap: ui.manualSplitGap.value,
          manualNorm: ui.manualNorm.checked,
          manualNormTarget: ui.manualNormTarget.value
      };
      
      localStorage.setItem('sessionCutPresets', JSON.stringify(userPresets));
      localStorage.setItem('sessionCutActivePreset', name);
      renderPresetDropdown();
      showToast(`Saved Preset: ${name}`, "success");
  });

  ui.deletePresetBtn.addEventListener('click', () => {
      const selected = ui.presetSelect.value;
      if (confirm(`Delete preset "${selected}"?`)) {
          delete userPresets[selected];
          localStorage.setItem('sessionCutPresets', JSON.stringify(userPresets));
          localStorage.setItem('sessionCutActivePreset', "Custom");
          renderPresetDropdown();
      }
  });

  
  // --- NATIVE MENU & FILE ASSOCIATION LISTENERS ---
  window.electronAPI.onMenuAddFiles(() => {
     ui.addBtn.click();
  });
  
  window.electronAPI.onAddExternalFile((path) => {
     addToManualQueue([path]);
     switchTab('manual');
  });
  
  // ==========================================
  // NEW UX FEATURES: SHORTCUTS
  // ==========================================
  let selectedFileId = null;

  document.addEventListener('keydown', (e) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const isTyping = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
      
      // 1. Add Files (Cmd + O)
      if (isCmdOrCtrl && e.key.toLowerCase() === 'o') {
          e.preventDefault();
          ui.addBtn.click();
      }
      
      // 2. Start Batch (Cmd + Return)
      if (isCmdOrCtrl && e.key === 'Enter') {
          e.preventDefault();
          ui.startBtn.click();
      }
      
      // 3. Delete Selected File (Delete or Backspace)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
          if (selectedFileId) {
              e.preventDefault();
              removeFile(selectedFileId);
              selectedFileId = null;
          }
      }

      // 4. Open Settings (Focuses first dropdown as a shortcut)
      if (isCmdOrCtrl && e.key === ',') {
          e.preventDefault();
          ui.manualSensitivity.focus();
      }
  });

  // ==========================================
  // NEW UX FEATURES: DRAG TO REORDER & CONTEXT MENU
  // ==========================================
  let draggingElement = null;

  // Listeners attached via delegation to the list container
  ui.manualQueueList.addEventListener('mousedown', (e) => {
      const fileItem = e.target.closest('.file-item');
      if (!fileItem) return;

      // Handle Selection
      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
      fileItem.classList.add('selected');
      selectedFileId = fileItem.id;

      // Handle Right Click (Context Menu)
      if (e.button === 2 && window.electronAPI.showContextMenu) {
          const itemData = manualQueue.find(i => i.id === selectedFileId);
          if (itemData) {
              window.electronAPI.showContextMenu({ id: selectedFileId, filePath: itemData.path });
          }
      }
  });

  ui.manualQueueList.addEventListener('dragstart', (e) => {
      const fileItem = e.target.closest('.file-item');
      if (fileItem) {
          draggingElement = fileItem;
          setTimeout(() => fileItem.classList.add('dragging'), 0);
      }
  });

  ui.manualQueueList.addEventListener('dragend', (e) => {
      if (draggingElement) {
          draggingElement.classList.remove('dragging');
          draggingElement = null;
          updateQueueOrderFromDOM();
      }
  });

  ui.manualQueueList.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggingElement) return;
      
      const afterElement = getDragAfterElement(ui.manualQueueList, e.clientY);
      if (afterElement == null) {
          ui.manualQueueList.appendChild(draggingElement);
      } else {
          ui.manualQueueList.insertBefore(draggingElement, afterElement);
      }
  });

  function getDragAfterElement(container, y) {
      const draggableElements = [...container.querySelectorAll('.file-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
              return { offset: offset, element: child };
          } else {
              return closest;
          }
      }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function updateQueueOrderFromDOM() {
      const currentDOMIds = [...ui.manualQueueList.querySelectorAll('.file-item')].map(el => el.id);
      const newQueue = [];
      currentDOMIds.forEach(id => {
          const item = manualQueue.find(q => q.id === id);
          if (item) newQueue.push(item);
      });
      manualQueue = newQueue;
  }

  // Handle IPC calls returning from the Context Menu
  if (window.electronAPI.onResetFileStatus) {
      window.electronAPI.onResetFileStatus((id) => {
          const item = manualQueue.find(q => q.id === id);
          if (item) {
              item.status = 'Ready';
              document.getElementById(`status-${id}`).innerText = 'Ready';
              document.getElementById(`status-${id}`).className = 'file-status status-pending';
              document.getElementById(`prog-${id}`).style.width = '0%';
          }
      });
  }

  if (window.electronAPI.onContextRemoveItem) {
      window.electronAPI.onContextRemoveItem((id) => removeFile(id));
  }


  // --- VISIBILITY & TOGGLE LOGIC ---
  function checkNormWarning() {
      const suppressed = localStorage.getItem('suppressNormWarning');
      if (!suppressed) {
          document.getElementById('norm-warning-modal').style.display = 'flex';
      }
  }
  
  window.closeNormWarning = () => {
      const checked = document.getElementById('normWarningCheck').checked;
      if (checked) localStorage.setItem('suppressNormWarning', 'true');
      document.getElementById('norm-warning-modal').style.display = 'none';
  };
  
  function toggleNorm(checkbox, group) {
    group.style.display = checkbox.checked ? 'block' : 'none';
    if (checkbox.checked) checkNormWarning(); 
    saveSettings();
  }
  
  function toggleSplit(checkbox, group) {
    group.style.display = checkbox.checked ? 'block' : 'none';
    saveSettings();
  }
  
  // Event Listeners for Toggles
  ui.manualNorm.addEventListener('change', () => toggleNorm(ui.manualNorm, ui.manualNormTargetGroup));
  ui.autoNorm.addEventListener('change', () => toggleNorm(ui.autoNorm, ui.autoNormTargetGroup));
  ui.manualSplit.addEventListener('change', () => toggleSplit(ui.manualSplit, ui.manualSplitGroup));
  ui.autoSplit.addEventListener('change', () => toggleSplit(ui.autoSplit, ui.autoSplitGroup));
  
  // FTP Toggle Logic
  ui.manualFtpToggle.addEventListener('change', () => {
      saveSettings();
  });
  ui.autoFtpToggle.addEventListener('change', () => {
      saveSettings();
  });
  
  // --- FTP BROWSER LOGIC ---
  let currentFtpPath = '/';
  
  window.openFtpBrowser = async () => {
      const host = ui.globalFtpHost.value;
      const user = ui.globalFtpUser.value;
      const pass = ui.globalFtpPass.value;
  
      if (!host || !user || !pass) return showToast("Please enter Host, User, and Password first.", "error");
  
      document.getElementById('ftp-modal').style.display = 'flex';
      document.getElementById('ftp-list-container').innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Connecting...</div>';
      
      await fetchFtpDir(host, user, pass, '/');
  };
  
  window.closeFtpBrowser = () => {
      document.getElementById('ftp-modal').style.display = 'none';
  };
  
  window.confirmFtpSelection = () => {
      ui.globalFtpPath.value = currentFtpPath;
      saveSettings();
      closeFtpBrowser();
  };

  // --- UPDATER / ABOUT MODAL ---
  window.openAboutModal = () => {
      document.getElementById('about-modal').style.display = 'flex';
  };
  window.closeAboutModal = () => {
      document.getElementById('about-modal').style.display = 'none';
  };
  window.triggerUpdateCheck = () => {
      document.getElementById('updater-status-text').innerText = "Checking for updates...";
      document.getElementById('btn-check-updates').disabled = true;
      document.getElementById('updater-progress-track').style.display = 'none';
      window.electronAPI.checkForUpdates();
  };
  window.installUpdate = () => {
      window.electronAPI.installUpdate();
  };

  window.electronAPI.onUpdaterEvent((e) => {
      const textEl = document.getElementById('updater-status-text');
      const btn = document.getElementById('btn-check-updates');
      const track = document.getElementById('updater-progress-track');
      const fill = document.getElementById('updater-progress-fill');

      if (e.type === 'update-available') {
          textEl.innerText = "Downloading update...";
          track.style.display = 'block';
          fill.style.width = '0%';
      } else if (e.type === 'update-not-available') {
          textEl.innerText = "You are on the latest version.";
          btn.disabled = false;
      } else if (e.type === 'download-progress') {
          fill.style.width = e.progress + '%';
          textEl.innerText = `Downloading... ${Math.round(e.progress)}%`;
      } else if (e.type === 'update-downloaded') {
          textEl.innerText = "Update downloaded and ready to install!";
          track.style.display = 'none';
          btn.innerText = "Restart & Install";
          btn.disabled = false;
          btn.onclick = window.installUpdate;
          showToast("A new update is ready to install.", "success");
      } else if (e.type === 'error') {
          textEl.innerText = "Error: " + e.error.split('\n')[0];
          btn.disabled = false;
          track.style.display = 'none';
      }
  });
  
  async function fetchFtpDir(host, user, pass, path) {
      currentFtpPath = path;
      document.getElementById('ftp-current-path').innerText = path;
      try {
          const result = await window.electronAPI.ftpList({ host, user, pass, path });
          if (!result.success) {
              document.getElementById('ftp-list-container').innerHTML = `<div style="padding:20px; text-align:center; color:#d32f2f;">Connection Failed:<br>${result.error}</div>`;
              return;
          }
          renderFtpList(result.items, host, user, pass);
      } catch (e) {
          document.getElementById('ftp-list-container').innerHTML = `<div style="padding:20px; text-align:center; color:#d32f2f;">Error: ${e.message}</div>`;
      }
  }
  
  function renderFtpList(items, host, user, pass) {
      const container = document.getElementById('ftp-list-container');
      container.innerHTML = '';
  
      if (currentFtpPath !== '/') {
          const upDiv = document.createElement('div');
          upDiv.className = 'ftp-item folder';
          upDiv.innerHTML = '<i>📁</i> .. (Up Level)';
          upDiv.onclick = () => {
             const parts = currentFtpPath.split('/').filter(p => p);
             parts.pop();
             const parentPath = parts.length ? '/' + parts.join('/') : '/';
             fetchFtpDir(host, user, pass, parentPath);
          };
          container.appendChild(upDiv);
      }
  
      items.forEach(item => {
          const div = document.createElement('div');
          div.className = item.isDir ? 'ftp-item folder' : 'ftp-item';
          div.innerHTML = `<i>${item.isDir ? '📁' : '📄'}</i> ${item.name}`;
          if (item.isDir) {
              div.onclick = () => {
                  const nextPath = currentFtpPath === '/' ? `/${item.name}` : `${currentFtpPath}/${item.name}`;
                  fetchFtpDir(host, user, pass, nextPath);
              };
          }
          container.appendChild(div);
      });
      if (items.length === 0) container.innerHTML = '<div style="padding:20px; text-align:center; color:#444;">(Empty Folder)</div>';
  }
  
  // --- SETTINGS PERSISTENCE ---
  function loadSettings() {
    const s = localStorage.getItem('sessionCutSettings');
    if (!s) return;
    const data = JSON.parse(s);
    
    if(data.manualOut) ui.outPath.value = data.manualOut;
    if(data.watchPath) ui.watchPath.value = data.watchPath;
    if(data.autoOut) ui.autoOutPath.value = data.autoOut;
    if(data.manualSuffix) ui.manualSuffix.value = data.manualSuffix;
    if(data.autoSuffix) ui.autoSuffix.value = data.autoSuffix;
    if(data.manualBuffer) ui.manualBuffer.value = data.manualBuffer;
    if(data.autoBuffer) ui.autoBuffer.value = data.autoBuffer;
    if(data.globalConcurrency) {
        ui.globalConcurrency.value = data.globalConcurrency;
    }
  
    // Sensitivity
    if(data.manualSensitivity) ui.manualSensitivity.value = data.manualSensitivity;
    if(data.autoSensitivity) ui.autoSensitivity.value = data.autoSensitivity;
  
    // Split Settings
    if(data.manualSplit !== undefined) {
        ui.manualSplit.checked = data.manualSplit;
        ui.manualSplitGroup.style.display = data.manualSplit ? 'block' : 'none';
    }
    if(data.manualSplitGap) ui.manualSplitGap.value = data.manualSplitGap;
  
    if(data.autoSplit !== undefined) {
        ui.autoSplit.checked = data.autoSplit;
        ui.autoSplitGroup.style.display = data.autoSplit ? 'block' : 'none';
    }
    if(data.autoSplitGap) ui.autoSplitGap.value = data.autoSplitGap;
  
    // Toggles & Visibility
    if(data.manualReview !== undefined) ui.manualReview.checked = data.manualReview;
    
    if(data.manualNorm !== undefined) { 
        ui.manualNorm.checked = data.manualNorm; 
        ui.manualNormTargetGroup.style.display = data.manualNorm ? 'block' : 'none';
    }
    if(data.manualNormTarget) ui.manualNormTarget.value = data.manualNormTarget;
    
    if(data.autoNorm !== undefined) { 
        ui.autoNorm.checked = data.autoNorm; 
        ui.autoNormTargetGroup.style.display = data.autoNorm ? 'block' : 'none';
    }
    if(data.autoNormTarget) ui.autoNormTarget.value = data.autoNormTarget;
  
    // FTP
    if(data.manualFtpToggle !== undefined) { 
      ui.manualFtpToggle.checked = data.manualFtpToggle; 
    }
  
    if(data.autoFtpToggle !== undefined) { 
      ui.autoFtpToggle.checked = data.autoFtpToggle; 
    }
    
    if(data.globalFtpHost) ui.globalFtpHost.value = data.globalFtpHost;
    if(data.globalFtpUser) ui.globalFtpUser.value = data.globalFtpUser;
    if(data.globalFtpPass) ui.globalFtpPass.value = data.globalFtpPass;
    if(data.globalFtpPath) ui.globalFtpPath.value = data.globalFtpPath;
  }
  
  function saveSettings() {
    const settings = {
      manualOut: ui.outPath.value,
      watchPath: ui.watchPath.value,
      autoOut: ui.autoOutPath.value,
      manualSuffix: ui.manualSuffix.value,
      autoSuffix: ui.autoSuffix.value,
      manualBuffer: ui.manualBuffer.value,
      autoBuffer: ui.autoBuffer.value,
      globalConcurrency: ui.globalConcurrency.value,
      
      manualSensitivity: ui.manualSensitivity.value, 
      manualSplit: ui.manualSplit.checked,
      manualSplitGap: ui.manualSplitGap.value, 
      manualReview: ui.manualReview.checked,
      manualNorm: ui.manualNorm.checked,
      manualNormTarget: ui.manualNormTarget.value,
      
      autoSensitivity: ui.autoSensitivity.value, 
      autoSplit: ui.autoSplit.checked,
      autoSplitGap: ui.autoSplitGap.value, 
      autoNorm: ui.autoNorm.checked,
      autoNormTarget: ui.autoNormTarget.value,
  
      // FTP
      manualFtpToggle: ui.manualFtpToggle.checked,
      autoFtpToggle: ui.autoFtpToggle.checked,
      
      globalFtpHost: ui.globalFtpHost.value,
      globalFtpUser: ui.globalFtpUser.value,
      globalFtpPass: ui.globalFtpPass.value,
      globalFtpPath: ui.globalFtpPath.value
    };
    localStorage.setItem('sessionCutSettings', JSON.stringify(settings));
  }
  
  // --- ATTACH SAVE LISTENERS TO ALL INPUTS ---
  document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', saveSettings));
  
  // --- STARTUP ---
  (async () => {
    const version = await window.electronAPI.getAppVersion();
    const tag = document.getElementById('appVersionTag');
    if(tag) tag.innerText = `v${version}`;
    const abt = document.getElementById('about-version');
    if(abt) abt.innerText = `v${version}`;

    try {
      const isActivated = await window.electronAPI.checkLicense();
      if (!isActivated) document.getElementById('activationOverlay').style.display = 'flex';
    } catch (e) { document.getElementById('activationOverlay').style.display = 'flex'; }
    loadSettings(); 
    renderPresetDropdown();
  })();
  
  // --- APP LOGIC ---
  let manualQueue = [];
  let uniqueIdCounter = 0;
  let isAutoPilot = false;
  let batchTimerInterval = null;
  
  // Helper: Time Format
  function formatTime(ms) {
     const totalSec = Math.floor(ms / 1000);
     const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
     const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
     const s = (totalSec % 60).toString().padStart(2, '0');
     return `${h}:${m}:${s}`;
  }
  
  function startBatchTimer() {
      if (batchTimerInterval) clearInterval(batchTimerInterval);
      const startTime = Date.now();
      ui.elapsedDisplay.innerText = "00:00:00";
      ui.manualProgressCard.style.display = 'block'; // Show card
      
      batchTimerInterval = setInterval(() => {
          ui.elapsedDisplay.innerText = formatTime(Date.now() - startTime);
      }, 1000);
  }
  
  function stopBatchTimer() {
      if (batchTimerInterval) {
          clearInterval(batchTimerInterval);
          batchTimerInterval = null;
      }
  }
  
  function hideBatchBar() {
      stopBatchTimer();
      ui.manualProgressCard.style.display = 'none';
      ui.elapsedDisplay.innerText = '';
      ui.etcDisplay.innerText = '';
  }
  
  window.switchTab = (mode) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mode-content').forEach(c => c.classList.remove('active'));
    
    let tabId = 'tabLog'; let viewId = 'viewLog';
    if(mode === 'manual') { tabId = 'tabManual'; viewId = 'viewManual'; }
    else if(mode === 'auto') { tabId = 'tabAuto'; viewId = 'viewAuto'; }
    else if(mode === 'settings') { tabId = 'tabSettings'; viewId = 'viewSettings'; }
    
    document.getElementById(tabId).classList.add('active');
    document.getElementById(viewId).classList.add('active');
  };
  
 // --- GLOBAL DRAG & DROP ---
  document.addEventListener('dragover', (e) => { 
    e.preventDefault(); 
    // NEW: If we are dragging an internal file to reorder, abort! Do not show the blue overlay.
    if (draggingElement) return; 

    if (document.getElementById('viewManual').classList.contains('active')) {
      document.getElementById('dropOverlay').style.display = 'flex'; 
    }
  });
  
  document.addEventListener('dragleave', (e) => { 
    if (draggingElement) return; // Ignore internal drags

    if (e.clientX === 0 || e.clientY === 0) {
      document.getElementById('dropOverlay').style.display = 'none'; 
    }
  });
  
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    document.getElementById('dropOverlay').style.display = 'none';
    
    // NEW: If this was an internal drop (reordering), stop here so it doesn't try to load a new file
    if (draggingElement) return; 

    if (!document.getElementById('viewManual').classList.contains('active')) return;
    
    // Safety check added for f.path existing
    const paths = Array.from(e.dataTransfer.files).filter(f => f.path && f.path.match(/\.(mp4|mov|mkv)$/i)).map(f => f.path);
    if (paths.length) addToManualQueue(paths);
  });
  
  function addToManualQueue(paths) {
    paths.forEach(path => {
      if (manualQueue.find(q => q.path === path)) return;
      const id = `man-${Date.now()}-${uniqueIdCounter++}`;
      manualQueue.push({ id, path, thumb: null, status: 'Ready' });
      renderManualQueue();
      window.electronAPI.generateThumbnail(path, id);
    });
  }
  
  function renderManualQueue() {
    ui.manualQueueList.innerHTML = '';
    if(manualQueue.length === 0) { ui.manualQueueList.innerHTML = '<div style="padding:20px; text-align:center; color:#444;">No files loaded.</div>'; return; }
    
    manualQueue.forEach(item => {
      const name = item.path.split(/[/\\]/).pop();
      const bg = item.thumb ? `background-image: url('data:image/png;base64,${item.thumb}')` : '';
      
      // ADDED draggable="true" here
      ui.manualQueueList.insertAdjacentHTML('beforeend', `
        <div class="file-item" id="${item.id}" draggable="true"> 
          <div class="file-bg-layer" id="bg-${item.id}" style="${bg}"></div>
          <div class="file-progress-layer" id="prog-${item.id}"></div>
          <div class="file-content-layer">
            <div class="file-name">${name}</div>
            <div class="file-status" id="status-${item.id}">${item.status}</div>
            <button class="btn-retry" id="retry-${item.id}" onclick="retryFile('${item.id}')" style="display:none;" title="Retry Failed File">↻</button>
            <button class="btn-remove" onclick="removeFile('${item.id}')">✕</button>
          </div>
        </div>`);
    });

    // Re-apply selection visual if a file was selected before render
    if (selectedFileId && document.getElementById(selectedFileId)) {
        document.getElementById(selectedFileId).classList.add('selected');
    }
  }
  
  ui.outBtn.addEventListener('click', async () => { const p = await window.electronAPI.selectFolder(); if(p) { ui.outPath.value = p; saveSettings(); } });
  ui.watchBtn.addEventListener('click', async () => { const p = await window.electronAPI.selectFolder(); if(p) { ui.watchPath.value = p; saveSettings(); } });
  ui.autoOutBtn.addEventListener('click', async () => { const p = await window.electronAPI.selectFolder(); if(p) { ui.autoOutPath.value = p; saveSettings(); } });
  
  // START MANUAL BATCH (WITH DISK CHECK)
  ui.startBtn.addEventListener('click', async () => {
    if (!manualQueue.length) return showToast("No files loaded.", "error");

    // --- NEW: DISK SPACE PRE-CHECK ---
    ui.startBtn.innerText = "Checking Disk...";
    
    const filePaths = manualQueue.map(i => i.path);
    const totalBytes = await window.electronAPI.getTotalSize(filePaths);
    
    // Determine the target directory to check
    const targetDir = ui.outPath.value === "Same as source" ? filePaths[0] : ui.outPath.value;
    const spaceRes = await window.electronAPI.checkDiskSpace(targetDir);
    
    if (spaceRes.success) {
        const totalInputGB = totalBytes / (1024 ** 3);
        // We warn if they have less than 120% of the original files size free
        if (spaceRes.availableGB < (totalInputGB * 1.2)) {
            const warning = `Low Disk Space Warning!\n\nYou have ${spaceRes.availableGB.toFixed(1)} GB free on the target drive, but the source files are ${totalInputGB.toFixed(1)} GB.\n\nYou may run out of space during processing. Continue anyway?`;
            if (!confirm(warning)) {
                ui.startBtn.innerText = "Start Manual Batch";
                return; // Abort
            }
        }
    }
    
    ui.startBtn.innerText = "Start Manual Batch"; // Reset label
    // --- END PRE-CHECK ---

    toggleLock(true);
    startBatchTimer(); 
    
    const config = {
      files: manualQueue.map(i => ({ path: i.path, id: i.id })),
      outputDir: ui.outPath.value === "Same as source" ? null : ui.outPath.value,
      suffix: ui.manualSuffix.value,
      threshold: ui.manualSensitivity.value, 
      splitMode: ui.manualSplit.checked,
      splitGap: ui.manualSplitGap.value, 
      reviewMode: ui.manualReview.checked,
      normalize: ui.manualNorm.checked,
      lufs: ui.manualNormTarget.value,
      buffer: parseFloat(ui.manualBuffer.value),
      concurrency: parseInt(ui.globalConcurrency.value) || 1
    };
  
    if (ui.manualFtpToggle.checked) {
        config.ftp = {
            host: ui.globalFtpHost.value,
            user: ui.globalFtpUser.value,
            pass: ui.globalFtpPass.value,
            path: ui.globalFtpPath.value
        };
    }
  
    window.electronAPI.startProcessing(config);
  });
  
  // START AUTO PILOT
  ui.toggleAutoBtn.addEventListener('click', () => {
    if (!isAutoPilot) {
      if (!ui.watchPath.value) return showToast("Select Watch Folder.", "error");
      if (!ui.autoOutPath.value) return showToast("Select Output Folder.", "error");
      
      isAutoPilot = true;
      ui.toggleAutoBtn.innerText = "⛔ Stop AutoPilot"; ui.toggleAutoBtn.className = "danger";
      ui.autoCard.classList.add('auto-pilot-active');
      ui.autoStatus.innerText = "🟢 Monitoring: " + ui.watchPath.value; ui.autoStatus.style.color = "#4caf50";
      ui.autoQueueList.innerHTML = '';
  
      const config = {
        watchDir: ui.watchPath.value, outputDir: ui.autoOutPath.value,
        suffix: ui.autoSuffix.value,
        threshold: ui.autoSensitivity.value, 
        splitMode: ui.autoSplit.checked,
        splitGap: ui.autoSplitGap.value, 
        normalize: ui.autoNorm.checked,
        lufs: ui.autoNormTarget.value,
        buffer: parseFloat(ui.autoBuffer.value)
      };
  
      if (ui.autoFtpToggle.checked) {
          config.ftp = {
              host: ui.globalFtpHost.value,
              user: ui.globalFtpUser.value,
              pass: ui.globalFtpPass.value,
              path: ui.globalFtpPath.value
          };
      }
  
      window.electronAPI.startAutoPilot(config);
    } else {
      isAutoPilot = false;
      ui.toggleAutoBtn.innerText = "Enable AutoPilot"; ui.toggleAutoBtn.className = "primary";
      ui.autoCard.classList.remove('auto-pilot-active');
      ui.autoStatus.innerText = "System Offline"; ui.autoStatus.style.color = "#666";
      window.electronAPI.stopAutoPilot();
    }
  });
  
  ui.abortBtn.addEventListener('click', () => window.electronAPI.abortProcessing());
  
  window.removeFile = (id) => { 
    window.electronAPI.removeItem(id);
    const el = document.getElementById(id);
    if(el) el.remove();
    if (id.startsWith('man-')) {
        manualQueue = manualQueue.filter(i => i.id !== id);
        if(!manualQueue.length) {
           renderManualQueue();
           hideBatchBar(); 
        }
    }
  };
  
  window.retryFile = (id) => {
      const item = manualQueue.find(q => q.id === id);
      if (item) {
          item.status = 'Ready';
          const st = document.getElementById(`status-${id}`);
          if (st) { st.innerText = 'Ready'; st.className = 'file-status status-pending'; }
          const pb = document.getElementById(`prog-${id}`);
          if (pb) pb.style.width = '0%';
          const btn = document.getElementById(`retry-${id}`);
          if (btn) btn.style.display = 'none';
          
          showToast('Prepared file for retry', 'info');
      }
  };
  
  window.electronAPI.onThumbnailGenerated(({ id, base64 }) => {
    const item = manualQueue.find(q => q.id === id);
    if (item) item.thumb = base64;
    const el = document.getElementById(`bg-${id}`);
    if (el) el.style.backgroundImage = `url('data:image/png;base64,${base64}')`;
  });
  
  window.electronAPI.onUpdateRow(({ index, status, cssClass, filename }) => {
    if (!document.getElementById(index)) {
       if(ui.autoQueueList.innerHTML.includes("Waiting for files")) ui.autoQueueList.innerHTML = '';
       ui.autoQueueList.insertAdjacentHTML('afterbegin', `
        <div class="file-item" id="${index}">
          <div class="file-bg-layer"></div>
          <div class="file-progress-layer" id="prog-${index}"></div>
          <div class="file-content-layer">
            <div class="file-name">${filename || "Detected File..."}</div>
            <div class="file-status" id="status-${index}"></div>
            <button class="btn-remove" onclick="removeFile('${index}')">✕</button>
          </div>
        </div>`);
    }
    const st = document.getElementById(`status-${index}`);
    if(st) { st.innerText = status; st.className = `file-status ${cssClass}`; }
    
    const retryBtn = document.getElementById(`retry-${index}`);
    if (retryBtn) {
        if (status === 'Error' || status === 'Aborted') {
            retryBtn.style.display = 'flex';
        } else {
            retryBtn.style.display = 'none';
        }
    }

    if (['Done', 'Error', 'No Speech'].includes(status)) {
       setTimeout(() => document.getElementById('globalIndicator').style.display = 'none', 500);
    }
  });
  
  let progressResetTimer = null;
  
  window.electronAPI.onFileProgress(({ id, mode, percent, text }) => {
     const globalInd = document.getElementById('globalIndicator');
     globalInd.style.display = 'flex';
     if (progressResetTimer) clearTimeout(progressResetTimer);
  
     const progBar = document.getElementById(`prog-${id}`);
     const statusBadge = document.getElementById(`status-${id}`);
  
     if (progBar && statusBadge) {
         progBar.style.width = `${percent}%`;
         
         if (text === 'Done' || text === 'Saved') {
             statusBadge.innerText = 'Done';
             statusBadge.className = 'file-status status-done';
         } else {
             statusBadge.innerText = `${text} ${percent}%`;
             statusBadge.className = 'file-status status-scanning'; 
         }
     }
  
     if (percent === 100) progressResetTimer = setTimeout(() => globalInd.style.display = 'none', 2000);
  });
  
window.electronAPI.onBatchUpdate(({ total, completed, etc }) => {
    const pct = (total > 0) ? Math.round((completed / total) * 100) : 0;
    ui.batchBar.style.width = `${pct}%`;
    ui.batchCount.innerText = `Batch: ${completed}/${total}`;
    
    ui.etcDisplay.innerText = etc ? `ETA: ${etc}` : '';
  
    if(total > 0 && total === completed) {
       ui.etcDisplay.innerText = 'Complete'; 
       
       showToast('Batch Complete', 'success');
       new Notification('SessionCut', { body: 'Batch Complete' });
       stopBatchTimer(); 
       
       setTimeout(() => {
           resetProgress();
           hideBatchBar();
       }, 2000);
    }
  });
  
  function toggleLock(locked) {
    ui.startBtn.style.display = locked ? 'none' : 'inline-block';
    ui.abortBtn.style.display = locked ? 'inline-block' : 'none';
    ui.clearBtn.disabled = locked;
  }
  
  function resetProgress() {
    document.querySelectorAll('.file-progress-layer').forEach(b => b.style.width = '0%');
    ui.batchBar.style.width = '0%';
    ui.batchCount.innerText = 'Batch Progress';
    toggleLock(false);
  }
  
  window.electronAPI.onBatchAborted(() => { 
      resetProgress(); 
      hideBatchBar(); 
      addLog('Batch Aborted', 'error'); 
      document.getElementById('globalIndicator').style.display = 'none';
  });
  window.electronAPI.onLogEntry(({ msg, type }) => addLog(msg, type));
  
  function addLog(msg, type = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    ui.systemLog.insertAdjacentHTML('beforeend', `<div class="log-entry ${type}"><span class="log-time">[${time}]</span> ${msg}</div>`);
    ui.systemLog.scrollTop = ui.systemLog.scrollHeight;
  }
  
  // License Check
  document.getElementById('licenseKeyInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('activateBtn').click(); });
  document.getElementById('activateBtn').addEventListener('click', async () => {
    const key = document.getElementById('licenseKeyInput').value.trim();
    const msg = document.getElementById('activationMsg');
    const btn = document.getElementById('activateBtn');
    if (!key) return;
    btn.disabled = true; btn.innerText = "Verifying..."; msg.innerText = "";
    const result = await window.electronAPI.validateLicense(key);
    if (result.success) {
      msg.style.color = "#4caf50"; msg.innerText = "Success!";
      setTimeout(() => document.getElementById('activationOverlay').style.display = 'none', 1000);
    } else {
      msg.style.color = "#ff5555";
      msg.innerText = (result.error === "Key already used.") ? "Key Already Used" : (result.error === "Key not found." ? "Invalid Key" : "Activation Failed");
      btn.disabled = false; btn.innerText = "Activate License";
    }
  });
  
  // Review Modal
  window.handleReview = (app) => { document.getElementById('review-modal').style.display = 'none'; window.electronAPI.reviewResponse(app); };
  window.electronAPI.onReviewRequest((data) => {
    document.getElementById('review-modal').style.display = 'flex';
    document.getElementById('review-filename').innerText = data.filename;
    if (data.waveform) { document.getElementById('review-waveform').src = `data:image/png;base64,${data.waveform}`; document.getElementById('review-waveform').style.display = 'block'; }
    if (data.stats) {
       document.getElementById('review-stats').innerHTML = `
        <div><div style="font-size:0.8em;opacity:0.5">ORIGINAL</div><div>${data.stats.original}</div></div>
        <div><div style="font-size:0.8em;opacity:0.5">NEW</div><div style="color:#00ffcc">${data.stats.new}</div></div>
        <div><div style="font-size:0.8em;opacity:0.5">CUT</div><div style="color:#ff5555">${100 - data.stats.percent}%</div></div>`;
    }
    const l = document.getElementById('review-segment-list'); l.innerHTML = '';
    data.segments.forEach((s, i) => l.insertAdjacentHTML('beforeend', `<div class="segment-item">Clip ${i+1}: ${new Date(s.start*1000).toISOString().substr(11,8)} ➜ ${new Date(s.end*1000).toISOString().substr(11,8)}</div>`));
  });