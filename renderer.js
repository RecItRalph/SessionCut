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
    speechMergeGap: document.getElementById('speechMergeGap'),
    minClipDuration: document.getElementById('minClipDuration'),
    globalFtpHost: document.getElementById('globalFtpHost'),
    globalFtpUser: document.getElementById('globalFtpUser'),
    globalFtpPass: document.getElementById('globalFtpPass'),
    globalFtpPath: document.getElementById('globalFtpPath'),

    // Shared
    systemLog: document.getElementById('systemLog'),
    batchBar: document.getElementById('batchBar'),
    batchCount: document.getElementById('batchCount'),

    // Transcription UI
    addTransBtn: document.getElementById('addTransBtn'),
    clearTransBtn: document.getElementById('clearTransBtn'),
    startTransBtn: document.getElementById('startTransBtn'),
    transOutBtn: document.getElementById('transOutBtn'),
    transOutPath: document.getElementById('transOutPath'),
    transcriptionQueueList: document.getElementById('transcriptionQueueList'),
    transMode: document.getElementById('transMode'),
    transFormat: document.getElementById('transFormat'),
    transSpeakerDiarization: document.getElementById('transSpeakerDiarization'),
    transWordTimestamps: document.getElementById('transWordTimestamps'),
    transAdvancedToggle: document.getElementById('transAdvancedToggle'),
    transAdvancedGroup: document.getElementById('transAdvancedGroup'),
    transProfanityFilter: document.getElementById('transProfanityFilter'),
    transCensorGroup: document.getElementById('transCensorGroup'),
    transProfanityList: document.getElementById('transProfanityList'),
    transProgressCard: document.getElementById('transProgressCard'),
    transElapsedDisplay: document.getElementById('transElapsedDisplay'),
    transEtcDisplay: document.getElementById('transEtcDisplay'),
    transBatchCount: document.getElementById('transBatchCount'),
    transBatchBar: document.getElementById('transBatchBar')
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
    if (profile.manualSensitivity) ui.manualSensitivity.value = profile.manualSensitivity;
    if (profile.manualBuffer) ui.manualBuffer.value = profile.manualBuffer;
    if (profile.manualSplit !== undefined) {
        ui.manualSplit.checked = profile.manualSplit;
        ui.manualSplitGroup.style.display = profile.manualSplit ? 'block' : 'none';
    }
    if (profile.manualSplitGap) ui.manualSplitGap.value = profile.manualSplitGap;
    if (profile.manualNorm !== undefined) {
        ui.manualNorm.checked = profile.manualNorm;
        ui.manualNormTargetGroup.style.display = profile.manualNorm ? 'block' : 'none';
    }
    if (profile.manualNormTarget) ui.manualNormTarget.value = profile.manualNormTarget;

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


window.electronAPI.onMenuAddFiles(() => ui.addBtn.click());
window.electronAPI.onMenuStartBatch(() => ui.startBtn.click());
window.electronAPI.onMenuClearQueue(() => ui.clearBtn.click());
window.electronAPI.onMenuPreferences(() => switchTab('settings'));
if (window.electronAPI.onMenuAbout) window.electronAPI.onMenuAbout(() => window.openAboutModal && window.openAboutModal());

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

    // 4. Open Settings (Cmd + ,)
    if (isCmdOrCtrl && e.key === ',') {
        e.preventDefault();
        switchTab('settings');
    }

    // 5. Tab Flipping (Cmd + 1, 2, 3)
    if (isCmdOrCtrl && e.key === '1') { e.preventDefault(); switchTab('manual'); }
    if (isCmdOrCtrl && e.key === '2') { e.preventDefault(); switchTab('auto'); }
    if (isCmdOrCtrl && e.key === '3') { e.preventDefault(); switchTab('settings'); }
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
ui.transProfanityFilter.addEventListener('change', () => {
    ui.transCensorGroup.style.display = ui.transProfanityFilter.checked ? 'flex' : 'none';
    saveSettings();
});
ui.transAdvancedToggle.addEventListener('change', () => {
    ui.transAdvancedGroup.style.display = ui.transAdvancedToggle.checked ? 'block' : 'none';
    saveSettings();
});

// Word-Level Timestamps only affects SRT/VTT cue structure — TXT/JSON ignore it.
// Reflect that in the UI so users don't toggle it expecting changes that won't appear.
function syncWordTimestampsAvailability() {
    const fmt = ui.transFormat.value;
    const supported = (fmt === 'srt' || fmt === 'vtt');
    ui.transWordTimestamps.disabled = !supported;
    const row = ui.transWordTimestamps.closest('.toggle-container') || ui.transWordTimestamps.parentElement;
    if (row) row.style.opacity = supported ? '1' : '0.45';
}
ui.transFormat.addEventListener('change', syncWordTimestampsAvailability);
syncWordTimestampsAvailability();

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
// Secret values (currently just the FTP password) live in OS keychain via main-process
// safeStorage, not in localStorage. loadSettings handles non-secret fields; loadSecrets
// populates the password fields asynchronously after the bridge call returns.
function loadSettings() {
    const s = localStorage.getItem('sessionCutSettings');
    if (!s) return;
    const data = JSON.parse(s);

    if (data.manualOut) ui.outPath.value = data.manualOut;
    if (data.watchPath) ui.watchPath.value = data.watchPath;
    if (data.autoOut) ui.autoOutPath.value = data.autoOut;
    if (data.manualSuffix) ui.manualSuffix.value = data.manualSuffix;
    if (data.autoSuffix) ui.autoSuffix.value = data.autoSuffix;
    if (data.manualBuffer) ui.manualBuffer.value = data.manualBuffer;
    if (data.autoBuffer) ui.autoBuffer.value = data.autoBuffer;
    if (data.globalConcurrency) {
        ui.globalConcurrency.value = data.globalConcurrency;
    }
    if (data.speechMergeGap) ui.speechMergeGap.value = data.speechMergeGap;
    if (data.minClipDuration !== undefined) ui.minClipDuration.value = data.minClipDuration;

    // Sensitivity
    if (data.manualSensitivity) ui.manualSensitivity.value = data.manualSensitivity;
    if (data.autoSensitivity) ui.autoSensitivity.value = data.autoSensitivity;

    // Split Settings
    if (data.manualSplit !== undefined) {
        ui.manualSplit.checked = data.manualSplit;
        ui.manualSplitGroup.style.display = data.manualSplit ? 'block' : 'none';
    }
    if (data.manualSplitGap) ui.manualSplitGap.value = data.manualSplitGap;

    if (data.autoSplit !== undefined) {
        ui.autoSplit.checked = data.autoSplit;
        ui.autoSplitGroup.style.display = data.autoSplit ? 'block' : 'none';
    }
    if (data.autoSplitGap) ui.autoSplitGap.value = data.autoSplitGap;

    // Toggles & Visibility
    if (data.manualReview !== undefined) ui.manualReview.checked = data.manualReview;

    if (data.manualNorm !== undefined) {
        ui.manualNorm.checked = data.manualNorm;
        ui.manualNormTargetGroup.style.display = data.manualNorm ? 'block' : 'none';
    }
    if (data.manualNormTarget) ui.manualNormTarget.value = data.manualNormTarget;

    if (data.autoNorm !== undefined) {
        ui.autoNorm.checked = data.autoNorm;
        ui.autoNormTargetGroup.style.display = data.autoNorm ? 'block' : 'none';
    }
    if (data.autoNormTarget) ui.autoNormTarget.value = data.autoNormTarget;

    const profDefault = document.getElementById('transProfanityDefaultList');
    if (profDefault && data.transProfanityDefaultList !== undefined) {
        profDefault.checked = data.transProfanityDefaultList;
    }

    // FTP (non-secret fields only)
    if (data.manualFtpToggle !== undefined) {
        ui.manualFtpToggle.checked = data.manualFtpToggle;
    }

    if (data.autoFtpToggle !== undefined) {
        ui.autoFtpToggle.checked = data.autoFtpToggle;
    }

    if (data.globalFtpHost) ui.globalFtpHost.value = data.globalFtpHost;
    if (data.globalFtpUser) ui.globalFtpUser.value = data.globalFtpUser;
    if (data.globalFtpPath) ui.globalFtpPath.value = data.globalFtpPath;

    // Transcription tab
    if (data.transMode) ui.transMode.value = data.transMode;
    if (data.transFormat) ui.transFormat.value = data.transFormat;
    if (data.transWordTimestamps !== undefined) ui.transWordTimestamps.checked = data.transWordTimestamps;
    if (data.transAdvancedToggle !== undefined) {
        ui.transAdvancedToggle.checked = data.transAdvancedToggle;
        ui.transAdvancedGroup.style.display = data.transAdvancedToggle ? 'block' : 'none';
    }
    if (typeof syncWordTimestampsAvailability === 'function') syncWordTimestampsAvailability();
}

// One-shot migration for users upgrading from the old plaintext-localStorage layout.
// Reads any FTP password from the legacy settings blob, hands it to the OS keychain
// via safeStorage, and strips it (plus any leftover hfToken from earlier diarization
// experiments) out of localStorage so secrets don't sit there in plaintext anymore.
async function migrateSecretsFromLocalStorage() {
    const raw = localStorage.getItem('sessionCutSettings');
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch (_e) { return; }
    let mutated = false;
    if (data.globalFtpPass !== undefined) {
        if (data.globalFtpPass) {
            await window.electronAPI.setSecret('ftpPassword', data.globalFtpPass);
        }
        delete data.globalFtpPass;
        mutated = true;
    }
    if (data.hfToken !== undefined) {
        // hfToken is no longer used by the app; just strip it from localStorage.
        delete data.hfToken;
        mutated = true;
    }
    if (mutated) {
        localStorage.setItem('sessionCutSettings', JSON.stringify(data));
    }
}

async function loadSecrets() {
    try {
        const ftp = await window.electronAPI.getSecret('ftpPassword');
        if (ftp && ftp.ok && ftp.value) ui.globalFtpPass.value = ftp.value;
    } catch (_e) { /* secrets unavailable — fields stay blank */ }
}

async function saveSecret(name, value) {
    try { await window.electronAPI.setSecret(name, value); }
    catch (_e) { /* swallow — the user can re-enter on next launch if write failed */ }
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
        speechMergeGap: ui.speechMergeGap.value,
        minClipDuration: ui.minClipDuration.value,

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

        transMode: ui.transMode.value,
        transFormat: ui.transFormat.value,
        transWordTimestamps: ui.transWordTimestamps.checked,
        transAdvancedToggle: ui.transAdvancedToggle.checked,
        transProfanityDefaultList: document.getElementById('transProfanityDefaultList') ? document.getElementById('transProfanityDefaultList').checked : true,

        // FTP (non-secret fields only — globalFtpPass is handled via safeStorage)
        manualFtpToggle: ui.manualFtpToggle.checked,
        autoFtpToggle: ui.autoFtpToggle.checked,

        globalFtpHost: ui.globalFtpHost.value,
        globalFtpUser: ui.globalFtpUser.value,
        globalFtpPath: ui.globalFtpPath.value
    };
    localStorage.setItem('sessionCutSettings', JSON.stringify(settings));
}

// --- ATTACH SAVE LISTENERS TO ALL INPUTS ---
document.querySelectorAll('input, select').forEach(el => {
    // Skip secret fields — they're persisted separately via safeStorage on blur.
    if (el.id !== 'ftpPass' && el.id !== 'globalFtpPass') {
        el.addEventListener('change', saveSettings);
    }
});
// Explicitly add delayed save for text inputs (non-secret only).
const textInputs = ['outPath', 'watchPath', 'autoOutPath', 'globalFtpHost', 'globalFtpUser', 'transOutPath', 'transProfanityList'];
textInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', saveSettings);
});
// Secret fields — write to OS keychain on blur.
ui.globalFtpPass.addEventListener('blur', () => saveSecret('ftpPassword', ui.globalFtpPass.value));

// --- STARTUP ---
(async () => {
    // System notifications are fired from main process via Electron's Notification API.
    // No renderer-side permission grant needed — that's handled by the OS once the
    // packaged app first asks (via Notification.show in main.js).

    const version = await window.electronAPI.getAppVersion();
    const tag = document.getElementById('appVersionTag');
    if (tag) tag.innerText = `v${version}`;
    const abt = document.getElementById('about-version');
    if (abt) abt.innerText = `v${version}`;

    try {
        const status = await window.electronAPI.checkLicense();
        if (!status || status.state === 'unactivated') {
            document.getElementById('activationOverlay').style.display = 'flex';
        } else if (status.state === 'invalid') {
            document.getElementById('activationOverlay').style.display = 'flex';
            const msg = document.getElementById('activationMsg');
            if (msg) {
                msg.style.color = '#ff5555';
                msg.innerText = status.reason || 'License invalid — please reactivate.';
            }
        } else if (status.state === 'expired') {
            document.getElementById('activationOverlay').style.display = 'flex';
            const msg = document.getElementById('activationMsg');
            if (msg) {
                msg.style.color = '#ff9800';
                msg.innerText = status.reason || 'Connect to the internet to verify your license.';
            }
        }
        // 'active' (online or offline-with-grace) → overlay stays hidden, app proceeds.
    } catch (_e) { document.getElementById('activationOverlay').style.display = 'flex'; }
    await migrateSecretsFromLocalStorage();
    loadSettings();
    await loadSecrets();
    renderPresetDropdown();
})();

// --- APP LOGIC ---
let manualQueue = [];
let transcriptionQueue = [];
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
    if (mode === 'manual') { tabId = 'tabManual'; viewId = 'viewManual'; }
    else if (mode === 'auto') { tabId = 'tabAuto'; viewId = 'viewAuto'; }
    else if (mode === 'transcription') { tabId = 'tabTranscription'; viewId = 'viewTranscription'; }
    else if (mode === 'settings') { tabId = 'tabSettings'; viewId = 'viewSettings'; }

    document.getElementById(tabId).classList.add('active');
    document.getElementById(viewId).classList.add('active');

    const profContainer = document.getElementById('profileHeaderContainer');
    if (profContainer) {
        if (mode === 'transcription' || mode === 'settings') {
            profContainer.style.visibility = 'hidden';
        } else {
            profContainer.style.visibility = 'visible';
        }
    }
};

// --- GLOBAL DRAG & DROP ---
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    // NEW: If we are dragging an internal file to reorder, abort! Do not show the blue overlay.
    if (draggingElement) return;

    if (document.getElementById('viewManual').classList.contains('active') || document.getElementById('viewTranscription').classList.contains('active')) {
        document.getElementById('dropOverlay').style.display = 'flex';
    }
});

document.addEventListener('dragleave', (e) => {
    if (draggingElement) return; // Ignore internal drags

    if (e.clientX === 0 || e.clientY === 0) {
        document.getElementById('dropOverlay').style.display = 'none';
    }
});

// Per-queue allow-lists. Both queues accept video containers and bare audio files.
// Transcription stays slightly broader (m4a too) because whisper extracts to PCM anyway.
const MANUAL_EXTS = ['mp4', 'mov', 'mkv', 'mp3', 'wav'];
const TRANS_EXTS = ['mp4', 'mov', 'mkv', 'wav', 'mp3', 'm4a'];

document.addEventListener('drop', (e) => {
    e.preventDefault();
    document.getElementById('dropOverlay').style.display = 'none';

    // If this was an internal drop (reordering), stop here so it doesn't try to load a new file
    if (draggingElement) return;

    const inManual = document.getElementById('viewManual').classList.contains('active');
    const inTrans = document.getElementById('viewTranscription').classList.contains('active');
    if (!inManual && !inTrans) return;

    const allowedExts = inManual ? MANUAL_EXTS : TRANS_EXTS;
    const allowedRe = new RegExp(`\\.(${allowedExts.join('|')})$`, 'i');

    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.path);
    const accepted = droppedFiles.filter(f => allowedRe.test(f.path));
    const rejected = droppedFiles.filter(f => !allowedRe.test(f.path));

    if (rejected.length > 0) {
        const names = rejected.slice(0, 3).map(f => f.path.split(/[/\\]/).pop()).join(', ');
        const more = rejected.length > 3 ? ` +${rejected.length - 3} more` : '';
        const supported = allowedExts.map(ext => '.' + ext).join(', ');
        const noun = rejected.length > 1 ? 'files' : 'file';
        showToast(`Unsupported ${noun}: ${names}${more} — supported: ${supported}`, 'error');
    }

    if (accepted.length > 0) {
        const paths = accepted.map(f => f.path);
        if (inManual) addToManualQueue(paths);
        else if (inTrans) addToTranscriptionQueue(paths);
    }
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
    if (manualQueue.length === 0) { ui.manualQueueList.innerHTML = '<div style="padding:20px; text-align:center; color:#444;">No files loaded.</div>'; return; }

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

function addToTranscriptionQueue(paths) {
    paths.forEach(path => {
        if (transcriptionQueue.find(q => q.path === path)) return;
        const id = `trans-${Date.now()}-${uniqueIdCounter++}`;
        transcriptionQueue.push({ id, path, thumb: null, status: 'Ready' });
        renderTranscriptionQueue();
        // Waveform thumbnails work on any ffmpeg-readable input (audio extracts the same way),
        // so we generate one for video and audio inputs alike.
        if (path.match(/\.(mp4|mov|mkv|mp3|wav|m4a)$/i)) {
            window.electronAPI.generateThumbnail(path, id);
        }
    });
}

function renderTranscriptionQueue() {
    ui.transcriptionQueueList.innerHTML = '';
    if (transcriptionQueue.length === 0) { ui.transcriptionQueueList.innerHTML = '<div style="padding:20px; text-align:center; color:#444;">No files loaded for transcription.</div>'; return; }

    transcriptionQueue.forEach(item => {
        const name = item.path.split(/[/\\]/).pop();
        const bg = item.thumb ? `background-image: url('data:image/png;base64,${item.thumb}')` : '';

        ui.transcriptionQueueList.insertAdjacentHTML('beforeend', `
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

    if (selectedFileId && document.getElementById(selectedFileId)) {
        document.getElementById(selectedFileId).classList.add('selected');
    }
}

ui.outBtn.addEventListener('click', async () => { const p = await window.electronAPI.selectFolder(); if (p) { ui.outPath.value = p; saveSettings(); } });
ui.watchBtn.addEventListener('click', async () => { const p = await window.electronAPI.selectFolder(); if (p) { ui.watchPath.value = p; saveSettings(); } });
ui.autoOutBtn.addEventListener('click', async () => { const p = await window.electronAPI.selectFolder(); if (p) { ui.autoOutPath.value = p; saveSettings(); } });

ui.clearBtn.addEventListener('click', () => {
    manualQueue.length = 0;
    renderManualQueue();
});

ui.addTransBtn.addEventListener('click', async () => {
    const paths = await window.electronAPI.selectFiles();
    if (paths && paths.length) addToTranscriptionQueue(paths);
});

ui.transOutBtn.addEventListener('click', async () => {
    const p = await window.electronAPI.selectFolder();
    if (p) { ui.transOutPath.value = p; }
});

ui.clearTransBtn.addEventListener('click', () => {
    transcriptionQueue.length = 0;
    renderTranscriptionQueue();
});

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

    manualBatchAborted = false; // fresh batch — clear any prior cancel flag
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
        concurrency: parseInt(ui.globalConcurrency.value) || 1,
        speechMergeGap: parseFloat(ui.speechMergeGap.value),
        minClipDuration: parseFloat(ui.minClipDuration.value)
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
            buffer: parseFloat(ui.autoBuffer.value),
            speechMergeGap: parseFloat(ui.speechMergeGap.value),
            minClipDuration: parseFloat(ui.minClipDuration.value)
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

ui.startTransBtn.addEventListener('click', () => {
    if (!transcriptionQueue.length) return showToast("No files loaded for transcription.", "error");

    const config = {
        files: transcriptionQueue.map(i => ({ path: i.path, id: i.id })),
        outputDir: ui.transOutPath.value === "Same as source" ? null : ui.transOutPath.value,
        mode: ui.transMode.value, // 'speed' | 'quality'
        format: ui.transFormat.value,
        speakerDiarization: ui.transSpeakerDiarization.checked,
        wordTimestamps: ui.transWordTimestamps.checked,
        profanityFilter: ui.transProfanityFilter.checked,
        censorStyle: document.querySelector('input[name="censorStyle"]:checked').value,
        profanityDefault: document.getElementById('transProfanityDefaultList') ? document.getElementById('transProfanityDefaultList').checked : true,
        profanityList: ui.transProfanityList.value
    };

    transBatchAborted = false; // fresh batch — clear any prior cancel flag
    ui.transProgressCard.style.display = 'block';
    ui.transBatchBar.style.width = '0%';
    ui.startTransBtn.style.display = 'none';
    ui.clearTransBtn.disabled = true;

    window.electronAPI.startTranscription(config);
});

ui.abortBtn.addEventListener('click', () => window.electronAPI.abortProcessing());

window.removeFile = (id) => {
    window.electronAPI.removeItem(id);
    const el = document.getElementById(id);
    if (el) el.remove();
    if (id.startsWith('man-')) {
        manualQueue = manualQueue.filter(i => i.id !== id);
        if (!manualQueue.length) {
            renderManualQueue();
            hideBatchBar();
            // If we emptied the visible queue while a batch was actually processing, treat
            // as cancellation. The main-process batch loop will quietly skip the rest via
            // manualSkippedIds; flagging here suppresses the eventual fake "Complete".
            if (ui.abortBtn.style.display === 'inline-block') {
                manualBatchAborted = true;
                showToast('Queue cleared — batch cancelled', 'warn');
                resetProgress();
            }
        }
    } else if (id.startsWith('trans-')) {
        transcriptionQueue = transcriptionQueue.filter(i => i.id !== id);
        if (!transcriptionQueue.length) {
            renderTranscriptionQueue();
            // Same logic for the transcription side: if processing card is visible we
            // were in the middle of a batch, so treat the empty-queue as cancellation.
            if (ui.transProgressCard.style.display !== 'none') {
                transBatchAborted = true;
                showToast('Queue cleared — transcription cancelled', 'warn');
                resetTransUI();
            }
        }
    }
};

window.retryFile = (id) => {
    let item = manualQueue.find(q => q.id === id);
    if (!item) item = transcriptionQueue.find(q => q.id === id);
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
    let item = manualQueue.find(q => q.id === id);
    if (!item) item = transcriptionQueue.find(q => q.id === id);
    if (item) item.thumb = base64;
    const el = document.getElementById(`bg-${id}`);
    if (el) el.style.backgroundImage = `url('data:image/png;base64,${base64}')`;
});

window.electronAPI.onUpdateRow(({ index, status, cssClass, filename }) => {
    if (!document.getElementById(index)) {
        if (ui.autoQueueList.innerHTML.includes("Waiting for files")) ui.autoQueueList.innerHTML = '';
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
    if (st) { st.innerText = status; st.className = `file-status ${cssClass}`; }

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
        // Reset animation to drop down instantly
        if (percent <= 2) progBar.style.transition = 'none';

        requestAnimationFrame(() => {
            progBar.style.width = `${percent}%`;
            if (percent > 2) progBar.style.transition = 'width 0.2s linear';
        });

        if (mode === 'scanning') progBar.style.backgroundColor = 'rgba(76, 175, 80, 0.35)'; // Green
        if (mode === 'saving') progBar.style.backgroundColor = 'rgba(0, 122, 204, 0.35)';   // Blue
        if (mode === 'uploading') progBar.style.backgroundColor = 'rgba(255, 152, 0, 0.35)'; // Orange

        if (text === 'Done' || text === 'Saved') {
            statusBadge.innerText = 'Done';
            statusBadge.className = 'file-status status-done';
        } else {
            // Handle the text explicitly 
            statusBadge.innerText = (mode === 'uploading' || mode === 'saving') ? `${text}` : `${text} ${percent}%`;
            statusBadge.className = 'file-status status-' + mode;
        }
    }

    if (percent === 100) progressResetTimer = setTimeout(() => globalInd.style.display = 'none', 2000);
});

// Tracks whether the user (or the main process) cancelled the active batch. The
// trailing batch-update IPC sometimes arrives AFTER abort-processing fires
// (the in-flight processSingleFile finishes its catch + completedCount++ before
// the next loop iteration sees isAborted). When that happens, total === completed
// and the renderer would otherwise show "Batch Complete" even though it was cancelled.
// Reset to false when a new batch starts.
let manualBatchAborted = false;
let transBatchAborted = false;

window.electronAPI.onBatchUpdate(({ total, completed, etc }) => {
    const pct = (total > 0) ? Math.round((completed / total) * 100) : 0;
    ui.batchBar.style.width = `${pct}%`;
    ui.batchCount.innerText = `Batch: ${completed}/${total}`;

    ui.etcDisplay.innerText = etc ? `ETA: ${etc}` : '';

    if (total > 0 && total === completed) {
        if (manualBatchAborted) {
            // Suppress the "Complete" message — onBatchAborted already showed
            // a Cancelled toast and reset the UI.
            return;
        }
        ui.etcDisplay.innerText = 'Complete';
        showToast('Batch Complete', 'success');
        // System-level notification is fired from main process (showSystemNotification)
        // and only when the window isn't focused — the in-app toast above is sufficient.
        stopBatchTimer();

        setTimeout(() => {
            resetProgress();
            hideBatchBar();
        }, 2000);
    }
});

window.electronAPI.onTransBatchUpdate(({ total, completed, etc }) => {
    const pct = (total > 0) ? Math.round((completed / total) * 100) : 0;
    ui.transBatchBar.style.width = `${pct}%`;
    ui.transBatchCount.innerText = `Batch: ${completed}/${total}`;

    ui.transEtcDisplay.innerText = etc ? `ETA: ${etc}` : '';

    if (total > 0 && total === completed) {
        if (transBatchAborted) {
            return;
        }
        ui.transEtcDisplay.innerText = 'Complete';
        showToast('Transcription Complete', 'success');
        // System-level notification handled in main process — see showSystemNotification.

        setTimeout(() => {
            resetTransUI();
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

// Resets transcription tab UI to its idle state. Used by completion, abort, and
// the queue-emptied-mid-batch path so the start button comes back consistently.
function resetTransUI() {
    document.querySelectorAll('.file-progress-layer').forEach(b => b.style.width = '0%');
    ui.transBatchBar.style.width = '0%';
    ui.transBatchCount.innerText = 'Batch Progress';
    ui.transProgressCard.style.display = 'none';
    ui.transEtcDisplay.innerText = '';
    ui.startTransBtn.style.display = 'inline-block';
    ui.clearTransBtn.disabled = false;
}

window.electronAPI.onBatchAborted(() => {
    manualBatchAborted = true;
    transBatchAborted = true;
    resetProgress();
    hideBatchBar();
    showToast('Batch Cancelled', 'warn');
    addLog('Batch Cancelled', 'warn');
    document.getElementById('globalIndicator').style.display = 'none';

    // Also reset transcription tab UI in case the abort came from there.
    resetTransUI();
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
        const reason = result.error || '';
        let display;
        if (reason === 'Key not found.') display = 'Invalid Key';
        else if (reason === 'Key revoked.') display = 'Key Revoked — contact admin';
        else if (reason === 'Key bound to another machine.') display = 'Already activated on another machine — contact admin to reset';
        else if (reason === 'Network unreachable' || reason === 'License server timeout') display = 'Network Error — check your internet connection';
        else display = reason || 'Activation Failed';
        msg.innerText = display;
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
    data.segments.forEach((s, i) => l.insertAdjacentHTML('beforeend', `<div class="segment-item">Clip ${i + 1}: ${new Date(s.start * 1000).toISOString().substr(11, 8)} ➜ ${new Date(s.end * 1000).toISOString().substr(11, 8)}</div>`));
});