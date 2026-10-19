// scanner.js - High-speed warehouse return scanning station

(function () {
  'use strict';

  // State Management
  let currentOrder = null;
  let autoSubmitTimer = null;
  let countdownInterval = null;
  let isSubmitting = false;
  let soundEnabled = true;
  let soundVolume = 1.0;
  let autoSubmitEnabled = true;
  let autoDownloadEnabled = false;
  let currentTheme = 'dark';
  let batchCondition = 'good';
  let todayScans = [];
  let currentFilter = 'all';
  let sheetSyncUrl = '';
  let sheetSyncEnabled = false;
  let stationPcName = 'PC-1';
  let isOmsLoggedIn = null; // null = initial/unknown, true = logged in, false = session expired
  let isV2LoggedIn = null;
  let isV1LoggedIn = null;
  let isCheckingOmsSession = false;
  let omsCheckTimer = null;
  let autoLoginEnabled = true;
  let floatingWidgetEnabled = true;
  let v2LoginEmail = '';
  let v2LoginPassword = '';
  let v1LoginEmail = '';
  let v1LoginPassword = '';
  let isAutoLoggingIn = false;
  let omsPriority = 'v2'; // 'v2' = V2 First (Jkstyle - my.elitesecom.ai), 'v1' = V1 First (Ugaan - oms.elitesecom.ai)
  let scanMode = localStorage.getItem('ugaan_scan_mode') || 'auto'; // 'auto' = Smart Auto (Detail + Same Day Cancel), 'direct' = Direct Scan, 'detail' = Detail Only

  // DOM Elements
  const el = {
    batchCondition: document.getElementById('batch-condition'),
    scanModeSelect: document.getElementById('scan-mode-select'),
    settingsScanModePills: document.getElementById('settings-scan-mode-pills'),
    toggleAutosubmit: document.getElementById('toggle-autosubmit'),
    toggleSound: document.getElementById('toggle-sound'),
    soundIcon: document.getElementById('sound-icon'),
    volumeSlider: document.getElementById('volume-slider'),
    volumeVal: document.getElementById('volume-val'),
    toggleTheme: document.getElementById('toggle-theme'),
    themeIcon: document.getElementById('theme-icon'),
    toggleFullscreen: document.getElementById('toggle-fullscreen'),
    btnDownloadExcel: document.getElementById('btn-download-excel'),

    // Dual-OMS Status Pills
    btnV2Status: document.getElementById('btn-v2-status'),
    btnV1Status: document.getElementById('btn-v1-status'),
    v2StatusDot: document.getElementById('v2-status-dot'),
    v1StatusDot: document.getElementById('v1-status-dot'),

    // Stats
    statDateDisplay: document.getElementById('stat-date-display'),
    statTotalScans: document.getElementById('stat-total-scans'),
    statGoodScans: document.getElementById('stat-good-scans'),
    statMultiScans: document.getElementById('stat-multi-scans'),
    statDefectScans: document.getElementById('stat-defect-scans'),

    // Image Panel
    imageContainer: document.getElementById('image-container'),
    placeholderBox: document.getElementById('placeholder-box'),
    productImg: document.getElementById('product-img'),
    imageLoader: document.getElementById('image-loader'),
    imageOmsBadge: document.getElementById('image-oms-badge'),
    imageSameDayBadge: document.getElementById('image-same-day-badge'),
    imageMarketplaceBadge: document.getElementById('image-marketplace-badge'),
    imageFooter: document.getElementById('image-footer'),
    imgSkuFooter: document.getElementById('img-sku-footer'),
    btnZoomImage: document.getElementById('btn-zoom-image'),

    // Scanner Input
    awbInput: document.getElementById('awb-input'),
    btnSearchManual: document.getElementById('btn-search-manual'),
    scannerStatusBadge: document.getElementById('scanner-status-badge'),

    // Alerts & Progress
    loginExpiredBox: document.getElementById('login-expired-box'),
    loginExpiredTitle: document.getElementById('login-expired-title'),
    loginExpiredDesc: document.getElementById('login-expired-desc'),
    btnOpenLogin: document.getElementById('btn-open-login'),
    btnOpenV1Login: document.getElementById('btn-open-v1-login'),
    btnDismissLogin: document.getElementById('btn-dismiss-login'),

    multiQtyAlertBox: document.getElementById('multi-qty-alert-box'),
    multiQtyAlertTitle: document.getElementById('multi-qty-alert-title'),
    multiQtyAlertDesc: document.getElementById('multi-qty-alert-desc'),
    alertQtyNum: document.getElementById('alert-qty-num'),
    btnManualSubmitAlert: document.getElementById('btn-manual-submit-alert'),
    btnCancelAlert: document.getElementById('btn-cancel-alert'),

    // Order Details
    detailOmsTag: document.getElementById('detail-oms-tag'),
    detailSameDayTag: document.getElementById('detail-same-day-tag'),
    detailConditionTag: document.getElementById('detail-condition-tag'),
    detMasterSku: document.getElementById('det-master-sku'),
    detAwb: document.getElementById('det-awb'),
    detQuantity: document.getElementById('det-quantity'),
    detMarketplace: document.getElementById('det-marketplace'),
    detMarketSku: document.getElementById('det-market-sku'),
    detSuborder: document.getElementById('det-suborder'),
    detStatus: document.getElementById('det-status'),
    detType: document.getElementById('det-type'),

    orderConditionSelect: document.getElementById('order-condition-select'),
    btnManualSubmit: document.getElementById('btn-manual-submit'),
    btnClearCurrent: document.getElementById('btn-clear-current'),

    // History Table
    historyCount: document.getElementById('history-count'),
    historyTableBody: document.getElementById('history-table-body'),
    btnCopyExcel: document.getElementById('btn-copy-excel'),
    btnClearHistory: document.getElementById('btn-clear-history'),

    // Modal & Toast
    imageModal: document.getElementById('image-modal'),
    modalFullImg: document.getElementById('modal-full-img'),
    modalSkuTitle: document.getElementById('modal-sku-title'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    // Live Google Sheet Sync (in Settings Modal)
    sheetStatusCard: document.getElementById('sheet-status-card'),
    statusIndicatorCircle: document.getElementById('status-indicator-circle'),
    sheetStatusText: document.getElementById('sheet-status-text'),
    sheetStatusDesc: document.getElementById('sheet-status-desc'),
    toggleSheetSync: document.getElementById('toggle-sheet-sync'),
    sheetUrlInput: document.getElementById('sheet-url-input'),
    btnSaveSheetUrl: document.getElementById('btn-save-sheet-url'),
    btnTestSheetSync: document.getElementById('btn-test-sheet-sync'),
    btnSyncAllToday: document.getElementById('btn-sync-all-today'),
    btnCopyScript: document.getElementById('btn-copy-script'),
    scriptCodeBlock: document.getElementById('script-code-block'),
    sheetPcNameInput: document.getElementById('sheet-pc-name-input'),
    btnSavePcName: document.getElementById('btn-save-pc-name'),

    // Unified Settings Modal (⚙️) & Auto-Login
    btnOpenSettings: document.getElementById('btn-open-settings'),
    settingsModal: document.getElementById('settings-modal'),
    btnCloseSettingsModal: document.getElementById('btn-close-settings-modal'),
    settingsTabBtns: document.querySelectorAll('.settings-tab-btn'),
    settingsTabPanes: document.querySelectorAll('.settings-tab-pane'),

    toggleAutologin: document.getElementById('toggle-autologin'),
    toggleFloatingWidget: document.getElementById('toggle-floating-widget'),
    v2EmailInput: document.getElementById('v2-email-input'),
    v2PasswordInput: document.getElementById('v2-password-input'),
    btnSaveV2Creds: document.getElementById('btn-save-v2-creds'),
    btnTestV2Login: document.getElementById('btn-test-v2-login'),
    v2CredStatus: document.getElementById('v2-cred-status'),
    v2LastChecked: document.getElementById('v2-last-checked'),
    btnPortalV2: document.getElementById('btn-portal-v2'),

    v1EmailInput: document.getElementById('v1-email-input'),
    v1PasswordInput: document.getElementById('v1-password-input'),
    btnSaveV1Creds: document.getElementById('btn-save-v1-creds'),
    btnTestV1Login: document.getElementById('btn-test-v1-login'),
    v1CredStatus: document.getElementById('v1-cred-status'),
    v1LastChecked: document.getElementById('v1-last-checked'),
    btnPortalV1: document.getElementById('btn-portal-v1'),
    btnTestSound: document.getElementById('btn-test-sound'),
    themeLabelText: document.getElementById('theme-label-text'),

    // Multi-PC / Backup & Restore
    btnExportSettingsFile: document.getElementById('btn-export-settings-file'),
    btnCopySettingsCode: document.getElementById('btn-copy-settings-code'),
    inputImportSettingsFile: document.getElementById('input-import-settings-file'),
    btnTriggerImportFile: document.getElementById('btn-trigger-import-file'),
    txtImportSettingsCode: document.getElementById('txt-import-settings-code'),
    btnApplyPastedSettings: document.getElementById('btn-apply-pasted-settings')
  };

  // Helper: Today's Storage Key (Partitioned by Date)
  function getTodayKey() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `elitesecom_returns_${year}_${month}_${day}`;
  }

  function getTodayDateString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  // Robust session expiration detector for V1 (oms.elitesecom.ai) & V2 (my.elitesecom.ai)
  function isV1SessionExpired(status, text, data) {
    if (status === 401 || status === 403) return true;
    if (text && text.includes('<html') && text.toLowerCase().includes('login')) return true;
    if (data) {
      if (data.status === 401 || data.status === 403 || data.status_code === 401 || data.status_code === 403) return true;
      if (data.data && typeof data.data.message === 'string') {
        const msg = data.data.message.toLowerCase();
        if (msg.includes('cookie') || msg.includes('session') || msg.includes('login') || msg.includes('auth')) return true;
      }
      if (data.message && typeof data.message === 'string') {
        const msg = data.message.toLowerCase();
        if (msg.includes('cookie') || msg.includes('session') || msg.includes('login') || msg.includes('unauth')) return true;
      }
      if (data.error && typeof data.error === 'string') {
        const err = data.error.toLowerCase();
        if (err.includes('cookie') || err.includes('session') || err.includes('login') || err.includes('unauth')) return true;
      }
      if (data.success === false && !data.orders && (data.status === 401 || (data.data && data.data.message))) return true;
    }
    return false;
  }

  function isV2SessionExpired(status, text, data) {
    if (status === 401 || status === 403) return true;
    if (text && text.includes('<html') && text.toLowerCase().includes('login')) return true;
    if (data) {
      if (data.message === 'Unauthenticated.' || data.error === 'Unauthorized' || data.error === 'Not authenticated') return true;
      if (data.status === 401 || data.status === 403) return true;
      const msg = String(data.error || data.message || '').toLowerCase();
      if (msg.includes('unauth') || msg.includes('not authenticated') || msg.includes('login required')) return true;
    }
    return false;
  }

  // Map return conditions for V1 vs V2 APIs
  function mapConditionForOms(condition, omsSource) {
    const isV1 = (omsSource === "V1" || omsSource === "v1");
    const condLower = (condition || "").toLowerCase().trim();

    if (isV1) {
      // V1 (oms.elitesecom.ai) exact supported keys: Complete, Wrong, Missing QT, Damage, Used, RTO Wrong, Non Barcode RTO
      if (condLower === "good" || condLower === "complete" || condLower === "received") return "Complete";
      if (condLower === "damage" || condLower === "damaged") return "Damage";
      if (condLower === "wrong") return "Wrong";
      if (condLower === "used") return "Used";
      if (condLower === "rto_wrong" || condLower.includes("rto wrong")) return "RTO Wrong";
      if (condLower === "non_barcode_rto" || condLower.includes("non barcode")) return "Non Barcode RTO";
      if (condLower.includes("missing") || condLower.includes("mq") || condLower.includes("qt")) return "Missing QT";
      return condition || "Complete";
    } else {
      // V2 (my.elitesecom.ai) exact supported values: good, received, damaged, wrong, repair
      if (condLower === "good" || condLower === "complete") return "good";
      if (condLower === "received") return "received";
      if (condLower === "damaged" || condLower === "damage") return "damaged";
      if (condLower === "repair") return "repair";
      if (condLower === "wrong" || condLower === "used" || condLower === "rto_wrong" || condLower === "non_barcode_rto") return "wrong";
      if (condLower.includes("missing") || condLower.includes("mq") || condLower.includes("qt")) {
        // V2 backend database enum only allows good/damaged/wrong/repair/received. Missing items are categorized under 'wrong'
        return "wrong";
      }
      return "good";
    }
  }

  // User-facing condition display label formatter
  function formatConditionDisplay(cond) {
    if (!cond) return 'Good';
    const c = String(cond).toLowerCase().trim();
    if (c === 'missing_mq' || c === 'missing_qt' || c.includes('missing') || c.includes('mq') || c.includes('qt')) return 'Missing MQ';
    if (c === 'damaged' || c === 'damage') return 'Damaged';
    if (c === 'wrong') return 'Wrong';
    if (c === 'used') return 'Used';
    if (c === 'repair') return 'Repair';
    if (c === 'good' || c === 'complete') return 'Good';
    return cond;
  }

  // Web Audio API Synthesizer with Real Master Volume Control & Output Limiter
  let audioCtx = null;
  let masterGain = null;
  let limiter = null;

  function updateMasterGain() {
    if (audioCtx && masterGain) {
      const vol = (soundEnabled && soundVolume > 0) ? soundVolume : 0;
      masterGain.gain.setValueAtTime(vol, audioCtx.currentTime);
    }
  }

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
        try {
          // 1. Master Volume Stage - directly controls overall loudness (0.0 to 1.5)
          masterGain = audioCtx.createGain();
          const initialVol = (soundEnabled && soundVolume > 0) ? soundVolume : 0;
          masterGain.gain.setValueAtTime(initialVol, audioCtx.currentTime);

          // 2. Output Limiter Stage - transparent brickwall limiter that ONLY catches digital clipping above 100% boost
          limiter = audioCtx.createDynamicsCompressor();
          limiter.threshold.setValueAtTime(-0.5, audioCtx.currentTime); // Only acts on extreme peaks
          limiter.knee.setValueAtTime(0, audioCtx.currentTime);
          limiter.ratio.setValueAtTime(20, audioCtx.currentTime);
          limiter.attack.setValueAtTime(0.001, audioCtx.currentTime);
          limiter.release.setValueAtTime(0.05, audioCtx.currentTime);

          // Signal Chain: All Tones -> masterGain (Volume Control) -> limiter (Anti-Clip) -> destination
          masterGain.connect(limiter);
          limiter.connect(audioCtx.destination);
        } catch (e) {
          console.warn("Audio node setup error", e);
          if (masterGain) masterGain.connect(audioCtx.destination);
        }
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(ctx, freq, duration, type = 'sine', delay = 0, vol = 1.0) {
    try {
      if (!soundEnabled || soundVolume <= 0) return;
      updateMasterGain();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
      osc.connect(gain);

      // Connect tone directly into the master volume node
      if (masterGain) {
        gain.connect(masterGain);
      } else {
        gain.connect(ctx.destination);
      }

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  function playSound(type) {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    if (type === 'success') {
      // Super Loud High-Clarity Warehouse Chime (G5 -> C6 with harmonic overtone)
      playTone(ctx, 784, 0.12, 'sine', 0, 0.95);
      playTone(ctx, 784 * 2, 0.08, 'triangle', 0, 0.35); // crisp overtone
      playTone(ctx, 1046.5, 0.22, 'sine', 0.10, 1.0);
      playTone(ctx, 1046.5 * 2, 0.15, 'triangle', 0.10, 0.40); // crisp high chime
    } else if (type === 'duplicate') {
      // Extra Loud Warning Beep-Beep (520Hz)
      playTone(ctx, 520, 0.11, 'square', 0, 0.95);
      playTone(ctx, 520, 0.11, 'square', 0.15, 0.95);
    } else if (type === 'not_found') {
      // Extra Loud Harsh descending buzzer
      playTone(ctx, 260, 0.22, 'sawtooth', 0, 1.0);
      playTone(ctx, 150, 0.38, 'sawtooth', 0.20, 1.0);
    } else if (type === 'warning') {
      // Extra Loud Multi-Qty 3-tone Warning Alarm
      playTone(ctx, 620, 0.14, 'triangle', 0, 1.0);
      playTone(ctx, 620, 0.14, 'triangle', 0.16, 1.0);
      playTone(ctx, 880, 0.28, 'triangle', 0.32, 1.1);
    } else if (type === 'error') {
      // Extra Loud Low buzz error
      playTone(ctx, 180, 0.38, 'sawtooth', 0, 1.0);
    }
  }

  // Floating Toast Notification matching Image 2
  function showNotification(title, desc = '', type = 'success', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const card = document.createElement('div');
    card.className = `toast-card toast-${type}`;

    let iconSymbol = '✔';
    if (type === 'duplicate') iconSymbol = '🔁';
    else if (type === 'not_found') iconSymbol = '❌';
    else if (type === 'warning') iconSymbol = '⚠️';
    else if (type === 'error') iconSymbol = '✖';

    card.innerHTML = `
      <div class="toast-icon-circle ${type}">
        ${iconSymbol}
      </div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${desc ? `<div class="toast-desc">${desc}</div>` : ''}
      </div>
      <button class="toast-close" title="Close">&times;</button>
    `;

    const closeBtn = card.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      card.classList.add('hide');
      setTimeout(() => card.remove(), 250);
    });

    container.appendChild(card);

    if (duration > 0) {
      setTimeout(() => {
        if (card.parentNode) {
          card.classList.add('hide');
          setTimeout(() => card.remove(), 250);
        }
      }, duration);
    }
  }

  // Helper for quick single-line notifications
  function showToast(msg, type = 'success') {
    showNotification(msg, '', type, 3000);
  }

  // Update Status Indicator
  function setStatus(text, type = 'ready') {
    el.scannerStatusBadge.textContent = text;
    el.scannerStatusBadge.className = `status-indicator ${type}`;
  }

  function formatVolumeLabel(pct) {
    if (pct > 100) return `${pct}% ⚡ Boost`;
    return `${pct}%`;
  }

  // Theme Management (Light / Dark with Permanent Memory)
  function applyThemeMode(theme) {
    currentTheme = (theme === 'light') ? 'light' : 'dark';
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${currentTheme}`);
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${currentTheme}`);
    try {
      localStorage.setItem('ugaan_theme_mode', currentTheme);
    } catch (e) {}
    chrome.storage.local.set({ themeMode: currentTheme });
    if (el.themeIcon) {
      el.themeIcon.textContent = currentTheme === 'light' ? '🌙' : '☀️';
    }
    if (el.toggleTheme) {
      el.toggleTheme.title = currentTheme === 'light' ? "Switch to Dark Mode (🌙)" : "Switch to Light Mode (☀️)";
    }
    if (el.themeLabelText) {
      el.themeLabelText.textContent = currentTheme === 'light' ? 'Switch to Dark Theme 🌙' : 'Switch to Light Theme ☀️';
    }
  }

  // Live Google Sheet UI & Sync Controller
  function updateSheetSyncUI(state, message) {
    if (state === 'connected') {
      if (el.sheetStatusDot) {
        el.sheetStatusDot.className = 'sheet-status-dot active';
        el.sheetStatusDot.title = 'Live Sync: Connected & Active 🟢';
      }
      if (el.btnSheetSync) el.btnSheetSync.classList.add('connected');
      if (el.statusIndicatorCircle) el.statusIndicatorCircle.className = 'status-indicator-circle active';
      if (el.sheetStatusText) el.sheetStatusText.textContent = '🟢 Connected & Live Active';
      if (el.sheetStatusDesc) el.sheetStatusDesc.textContent = message || 'Every return scan will be added directly into your Google Sheet live in real time.';
      if (el.toggleSheetSync) el.toggleSheetSync.checked = true;
    } else if (state === 'syncing') {
      if (el.sheetStatusDot) {
        el.sheetStatusDot.className = 'sheet-status-dot syncing';
        el.sheetStatusDot.title = 'Live Syncing to Google Sheet...';
      }
    } else if (state === 'error') {
      if (el.sheetStatusDot) {
        el.sheetStatusDot.className = 'sheet-status-dot error';
        el.sheetStatusDot.title = 'Sync Error: Check Web App URL';
      }
      if (el.statusIndicatorCircle) el.statusIndicatorCircle.className = 'status-indicator-circle';
      if (el.sheetStatusText) el.sheetStatusText.textContent = '⚠️ Sync Failed';
      if (el.sheetStatusDesc) el.sheetStatusDesc.textContent = message || 'Could not send scan to Google Sheet. Please check your Web App URL.';
    } else {
      // offline
      if (el.sheetStatusDot) {
        el.sheetStatusDot.className = 'sheet-status-dot offline';
        el.sheetStatusDot.title = 'Live Sync: Disabled / Not Configured';
      }
      if (el.btnSheetSync) el.btnSheetSync.classList.remove('connected');
      if (el.statusIndicatorCircle) el.statusIndicatorCircle.className = 'status-indicator-circle';
      if (el.sheetStatusText) el.sheetStatusText.textContent = sheetSyncUrl ? '⚪ Sync Paused (Disabled)' : '⚪ Not Connected';
      if (el.sheetStatusDesc) el.sheetStatusDesc.textContent = sheetSyncUrl ? 'Live sync is currently toggled off.' : 'Connect your Google Sheet to enable 100% real-time row-by-row live syncing.';
      if (el.toggleSheetSync) el.toggleSheetSync.checked = false;
    }
  }

  function validateSheetUrl(rawUrl) {
    const url = (rawUrl || '').trim();
    if (!url) {
      return { valid: false, error: "Please enter your Google Apps Script Web App URL." };
    }
    if (url.includes('docs.google.com/spreadsheets')) {
      return {
        valid: false,
        error: "This is a spreadsheet link, not a Web App URL. In Google Sheets, click Extensions > Apps Script > Deploy > New deployment."
      };
    }
    if (url.includes('/edit') || url.endsWith('/dev')) {
      return {
        valid: false,
        error: "This is an edit/dev link. In Apps Script, click Deploy > New deployment, select Web app, and copy the URL ending with /exec."
      };
    }
    if (!url.startsWith('https://script.google.com/macros/s/') || !url.includes('/exec')) {
      return {
        valid: false,
        error: "Incomplete Web App URL! A valid URL must start with 'https://script.google.com/macros/s/' and end with '/exec'. Check Steps 4-6 in the Setup Guide below."
      };
    }
    return { valid: true, url };
  }

  function sendSheetPayload(targetUrl, payload, callback) {
    chrome.runtime.sendMessage({
      action: 'sync_to_google_sheet',
      url: targetUrl,
      payload: payload
    }, (res) => {
      // If service worker is not responding or outdated, fallback directly from extension page
      if (chrome.runtime.lastError || !res) {
        fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        })
        .then(async (directRes) => {
          const txt = await directRes.text();
          let dJson = null;
          try { dJson = JSON.parse(txt); } catch(e) {}
          if ((dJson && dJson.result === 'success') || directRes.ok) {
            if (callback) callback({ success: true, count: (dJson && dJson.count) || 1 });
          } else if (dJson && dJson.result === 'error') {
            if (callback) callback({ success: false, error: dJson.error });
          } else if (directRes.status === 404 || (txt && txt.includes('unable to open the file'))) {
            if (callback) callback({
              success: false,
              error: "Web App URL Not Found (HTTP 404): In Google Sheet Apps Script, ensure: 1) Deploy > 'Who has access' is set to 'Anyone', 2) The URL ends with /exec, and 3) Copy the complete Web App URL without missing letters."
            });
          } else if (directRes.status === 401 || directRes.status === 403 || (txt && txt.includes('accounts.google.com'))) {
            if (callback) callback({
              success: false,
              error: "Google Access Denied: In Apps Script Deploy settings, set 'Who has access' to 'Anyone'."
            });
          } else {
            const cleanTxt = txt && txt.includes('<html') ? `HTTP ${directRes.status}: Check Web App URL deployment in Google Sheet.` : txt;
            if (callback) callback({ success: false, error: cleanTxt });
          }
        })
        .catch((err) => {
          if (callback) callback({ success: false, error: `Network error: ${err.message}. Check URL or reload extension.` });
        });
        return;
      }
      if (callback) callback(res);
    });
  }

  async function syncScanToGoogleSheet(item) {
    if (!sheetSyncEnabled || !sheetSyncUrl) return;
    try {
      updateSheetSyncUI('syncing');
      const payload = {
        date: item.date || getTodayDateString(),
        timestamp: item.timestamp || new Date().toLocaleTimeString(),
        pc_name: item.pc_name || stationPcName || 'PC-1',
        oms_source: item.oms_source || 'V2',
        awb: item.awb || '',
        master_sku: item.master_sku || '-',
        marketplace_sku: item.marketplace_sku || '-',
        marketplace: item.marketplace || '-',
        suborder_no: item.suborder_no || '-',
        quantity: item.quantity || 1,
        condition: item.condition || 'Good',
        status: item.status || 'Submitted',
        image_url: item.image_url || ''
      };

      sendSheetPayload(sheetSyncUrl, payload, (res) => {
        if (res && res.success) {
          updateSheetSyncUI('connected');
          console.log('[Google Sheet] Synced live row for AWB:', item.awb);
        } else {
          console.warn('[Google Sheet] Sync warning:', res ? res.error : 'No response');
          updateSheetSyncUI('error', res ? res.error : 'Sync failed');
        }
      });
    } catch (err) {
      console.warn('[Google Sheet] Sync error:', err);
      updateSheetSyncUI('error', err.message);
    }
  }

  // --- Real-time OMS Live Session Monitoring & Automatic Error Synchronization ---
  function updateOmsStatusPills() {
    if (el.v2StatusDot) {
      el.v2StatusDot.className = 'status-indicator-dot ' + (isV2LoggedIn ? 'online' : (isV2LoggedIn === false ? 'offline' : ''));
      if (el.btnV2Status) {
        el.btnV2Status.title = `V2: ${isV2LoggedIn ? 'Connected 🟢' : 'Logged Out 🔴 (Click to Login)'}`;
      }
    }
    if (el.v1StatusDot) {
      el.v1StatusDot.className = 'status-indicator-dot ' + (isV1LoggedIn ? 'online' : (isV1LoggedIn === false ? 'offline' : ''));
      if (el.btnV1Status) {
        el.btnV1Status.title = `V1: ${isV1LoggedIn ? 'Connected 🟢' : 'Logged Out 🔴 (Click to Login)'}`;
      }
    }
  }

  // --- Real-time Dual-OMS Live Session Monitoring & Automatic Error Synchronization ---
  function handleOmsLoggedOut(forceAlarm = false, reason = '') {
    const wasLoggedIn = isOmsLoggedIn !== false;
    isOmsLoggedIn = false;

    chrome.storage.local.set({
      oms_logged_in: false,
      v2_logged_in: isV2LoggedIn,
      v1_logged_in: isV1LoggedIn,
      oms_session_checked_at: Date.now()
    });

    updateOmsStatusPills();

    if (el.loginExpiredBox) {
      if (el.loginExpiredTitle) {
        el.loginExpiredTitle.textContent = reason || 'OMS Session Expired';
      }
      if (el.loginExpiredDesc) {
        let msg = 'Session expired: ';
        if (isV2LoggedIn === false && isV1LoggedIn === false) {
          msg = 'Both V2 (my.elitesecom.ai) and V1 (oms.elitesecom.ai) are logged out.';
        } else if (isV2LoggedIn === false) {
          msg = 'V2 (my.elitesecom.ai) is logged out. Please log in.';
        } else if (isV1LoggedIn === false) {
          msg = 'V1 (oms.elitesecom.ai) is logged out. Please log in.';
        }
        el.loginExpiredDesc.innerHTML = `${msg} <span style="display: block; margin-top: 6px; font-size: 12px; opacity: 0.9; color: #c7d2fe;">⚡ Auto-dismisses upon login.</span>`;
      }
      el.loginExpiredBox.style.display = 'flex';
    }

    setStatus('LOGGED OUT - LOGIN REQUIRED', 'error');

    // Only play sound and show notification when state first changes or if explicitly forced
    if (wasLoggedIn || forceAlarm) {
      playSound('error');
      showNotification(
        "OMS Session Expired",
        reason || "Please log into your OMS account to continue scanning.",
        "error",
        7000
      );
    }

    scheduleNextSessionCheck();
  }

  function handleOmsLoggedIn() {
    const wasLoggedOut = isOmsLoggedIn === false;
    isOmsLoggedIn = true;

    chrome.storage.local.set({
      oms_logged_in: true,
      v2_logged_in: isV2LoggedIn,
      v1_logged_in: isV1LoggedIn,
      oms_session_checked_at: Date.now()
    });

    updateOmsStatusPills();

    // Automatically remove error banner if at least active
    if (el.loginExpiredBox && isV2LoggedIn !== false && isV1LoggedIn !== false) {
      el.loginExpiredBox.style.display = 'none';
    }

    // Restore ready badge if currently showing error
    if (el.scannerStatusBadge && el.scannerStatusBadge.textContent.includes('LOGGED OUT')) {
      setStatus('READY TO SCAN', 'ready');
    }

    // Play pleasant confirmation sound and notify on restore
    if (wasLoggedOut) {
      playSound('success');
      showNotification(
        "OMS Login Connected! 🟢",
        "OMS session restored successfully. Ready to scan returns!",
        "success",
        3500
      );
      focusInput();
    }

    scheduleNextSessionCheck();
  }

  async function checkOmsSession(silent = false) {
    if (isCheckingOmsSession) return;
    isCheckingOmsSession = true;

    try {
      const [v2Result, v1Result] = await Promise.allSettled([
        // V2 Session Check
        fetch('https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ search_type: 'return_awb', value: '__CHECK_SESSION__' })
        }).then(async (res) => {
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch (e) {}
          const isLoginReq = (res.redirected && res.url && res.url.includes('login')) || isV2SessionExpired(res.status, text, data);
          return !isLoginReq && res.status === 200;
        }).catch(() => false),

        // V1 Session Check
        fetch('https://oms.elitesecom.ai/api/return_order_data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ awbNumber: '__CHECK_SESSION__', refrenceCode: '', subOrderNumber: '' })
        }).then(async (res) => {
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch (e) {}
          const isLoginReq = (res.redirected && res.url && res.url.includes('login')) || isV1SessionExpired(res.status, text, data);
          return !isLoginReq && res.status === 200;
        }).catch(() => false)
      ]);

      isV2LoggedIn = v2Result.status === 'fulfilled' ? v2Result.value : false;
      isV1LoggedIn = v1Result.status === 'fulfilled' ? v1Result.value : false;

      // If any session is expired, attempt seamless background auto-login if enabled
      if ((isV2LoggedIn === false || isV1LoggedIn === false) && autoLoginEnabled) {
        const panelsToTry = (isV2LoggedIn === false && isV1LoggedIn === false) ? 'both' : (isV2LoggedIn === false ? 'v2' : 'v1');
        await attemptAutoLogin(panelsToTry);
      }

      updateOmsStatusPills();
      updateCredStatusBadge('v2', isV2LoggedIn);
      updateCredStatusBadge('v1', isV1LoggedIn);

      if (isV2LoggedIn === false && isV1LoggedIn === false) {
        handleOmsLoggedOut(!silent, 'Both V2 and V1 Sessions Expired');
      } else {
        handleOmsLoggedIn();
      }
    } catch (err) {
      console.warn('[OMS Session Monitor] Connection error:', err);
    } finally {
      isCheckingOmsSession = false;
    }
  }

  function scheduleNextSessionCheck() {
    if (omsCheckTimer) {
      clearTimeout(omsCheckTimer);
      omsCheckTimer = null;
    }
    // Pure On-Demand (JIT) Mode: When logged in, NO background polling timer runs!
    // Sessions self-heal on-demand during scan search & submission without constant server polling.
    if (isOmsLoggedIn) return;

    // If completely logged out of both panels, gently retry after 30s
    omsCheckTimer = setTimeout(async () => {
      await checkOmsSession(true);
      scheduleNextSessionCheck();
    }, 30000);
  }

  function updateWidgetPillsUI(theme, sizeVal) {
    if (theme) {
      document.querySelectorAll('[data-widget-theme]').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-widget-theme') === theme);
      });
    }
    if (sizeVal !== undefined) {
      let sizeName = 'medium';
      if (typeof sizeVal === 'string') sizeName = sizeVal;
      else if (typeof sizeVal === 'number') {
        if (sizeVal <= 46) sizeName = 'small';
        else if (sizeVal >= 68) sizeName = 'large';
        else sizeName = 'medium';
      }
      document.querySelectorAll('[data-widget-size]').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-widget-size') === sizeName);
      });
    }
  }

  function updateOmsPriorityUI(priority) {
    const p = priority || 'v2';
    document.querySelectorAll('[data-oms-priority]').forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-oms-priority') === p);
    });
  }

  function updateScanModeUI(mode) {
    const m = mode || 'auto';
    if (el.scanModeSelect) {
      el.scanModeSelect.value = m;
    }
    document.querySelectorAll('[data-scan-mode]').forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-scan-mode') === m);
    });
  }

  // Initialize Settings & Local Storage
  function init() {
    // 1. Immediately read cached theme from localStorage synchronously to eliminate any FOUC
    try {
      const cachedTheme = localStorage.getItem('ugaan_theme_mode');
      if (cachedTheme) {
        applyThemeMode(cachedTheme);
      }
    } catch (e) {}

    el.statDateDisplay.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // Load saved settings
    chrome.storage.local.get([
      'soundEnabled',
      'soundVolume',
      'themeMode',
      'autoSubmitEnabled',
      'batchCondition',
      'scan_mode',
      'sheet_sync_url',
      'sheet_sync_enabled',
      'v2_login_email',
      'v2_login_password',
      'v1_login_email',
      'v1_login_password',
      'auto_login_enabled',
      'es_preferred_theme',
      'es_fab_size',
      'oms_priority',
      getTodayKey()
    ], (res) => {
      if (res.oms_priority) {
        omsPriority = res.oms_priority;
      } else {
        omsPriority = 'v2';
      }
      updateOmsPriorityUI(omsPriority);

      if (res.scan_mode) {
        scanMode = res.scan_mode;
      } else {
        scanMode = localStorage.getItem('ugaan_scan_mode') || 'auto';
      }
      updateScanModeUI(scanMode);

      if (res.es_preferred_theme || res.es_fab_size) {
        updateWidgetPillsUI(res.es_preferred_theme, res.es_fab_size);
      }
      // Restore Theme (Permanent Memory)
      if (res.themeMode) {
        applyThemeMode(res.themeMode);
      } else {
        const cached = localStorage.getItem('ugaan_theme_mode') || 'light';
        applyThemeMode(cached);
      }

      if (res.soundVolume !== undefined) {
        soundVolume = Number(res.soundVolume);
        if (soundVolume > 1.5) soundVolume = soundVolume / 100;
      } else {
        soundVolume = 1.0;
      }
      const pct = Math.round(soundVolume * 100);
      if (el.volumeSlider) el.volumeSlider.value = pct;
      if (el.volumeVal) el.volumeVal.textContent = formatVolumeLabel(pct);

      if (res.soundEnabled !== undefined) {
        soundEnabled = res.soundEnabled;
      }
      const isAudible = soundEnabled && soundVolume > 0;
      el.soundIcon.textContent = isAudible ? '🔊' : '🔇';
      el.toggleSound.classList.toggle('active', isAudible);
      updateMasterGain();

      if (res.autoSubmitEnabled !== undefined) {
        autoSubmitEnabled = res.autoSubmitEnabled;
        el.toggleAutosubmit.checked = autoSubmitEnabled;
      }

      if (res.batchCondition) {
        batchCondition = res.batchCondition;
        el.batchCondition.value = batchCondition;
        el.orderConditionSelect.value = batchCondition;
        el.detailConditionTag.textContent = formatConditionDisplay(batchCondition).toUpperCase();
      }

      if (res.sheet_sync_url) {
        sheetSyncUrl = res.sheet_sync_url;
        if (el.sheetUrlInput) el.sheetUrlInput.value = sheetSyncUrl;
        if (res.sheet_sync_enabled !== undefined) {
          sheetSyncEnabled = res.sheet_sync_enabled;
        } else {
          sheetSyncEnabled = Boolean(sheetSyncUrl);
        }
        updateSheetSyncUI(sheetSyncEnabled && sheetSyncUrl ? 'connected' : 'offline');
      } else if (chrome.storage && chrome.storage.sync) {
        // Seamless Auto-Sync from Google Account across PCs!
        chrome.storage.sync.get(['sheet_sync_url', 'sheet_sync_enabled'], (syncRes) => {
          if (syncRes && syncRes.sheet_sync_url) {
            sheetSyncUrl = syncRes.sheet_sync_url;
            sheetSyncEnabled = syncRes.sheet_sync_enabled !== undefined ? syncRes.sheet_sync_enabled : true;
            chrome.storage.local.set({ sheet_sync_url: sheetSyncUrl, sheet_sync_enabled: sheetSyncEnabled });
            if (el.sheetUrlInput) el.sheetUrlInput.value = sheetSyncUrl;
            updateSheetSyncUI(sheetSyncEnabled && sheetSyncUrl ? 'connected' : 'offline');
          }
        });
      }

      if (res.station_pc_name) {
        stationPcName = res.station_pc_name;
      }
      if (el.sheetPcNameInput) el.sheetPcNameInput.value = stationPcName;
      if (el.stationPcNameDisplay) el.stationPcNameDisplay.textContent = stationPcName;

      // Restore OMS Login Credentials & Auto-Login Switch
      if (res.v2_login_email) {
        v2LoginEmail = res.v2_login_email;
        if (el.v2EmailInput) el.v2EmailInput.value = v2LoginEmail;
      }
      if (res.v2_login_password) {
        v2LoginPassword = res.v2_login_password;
        if (el.v2PasswordInput) el.v2PasswordInput.value = v2LoginPassword;
      }
      if (res.v1_login_email) {
        v1LoginEmail = res.v1_login_email;
        if (el.v1EmailInput) el.v1EmailInput.value = v1LoginEmail;
      }
      if (res.v1_login_password) {
        v1LoginPassword = res.v1_login_password;
        if (el.v1PasswordInput) el.v1PasswordInput.value = v1LoginPassword;
      }
      if (res.auto_login_enabled !== undefined) {
        autoLoginEnabled = res.auto_login_enabled;
        if (el.toggleAutologin) el.toggleAutologin.checked = autoLoginEnabled;
      }
      if (res.floating_widget_enabled !== undefined) {
        floatingWidgetEnabled = Boolean(res.floating_widget_enabled);
        if (el.toggleFloatingWidget) el.toggleFloatingWidget.checked = floatingWidgetEnabled;
      }

      todayScans = (res[getTodayKey()] || []).map(item => {
        const src = item.oms_source || item._oms_source || 'V1';
        item.oms_source = src;
        item._oms_source = src;
        item.suborder_number = item.suborder_number || item.suborder_no || '-';
        return item;
      });
      renderHistoryTable();
      updateStats();
    });

    // Listen for storage changes from other components (popup / content script)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.oms_priority) {
          omsPriority = changes.oms_priority.newValue || 'v2';
          updateOmsPriorityUI(omsPriority);
        }
        if (changes.scan_mode) {
          scanMode = changes.scan_mode.newValue || 'auto';
          updateScanModeUI(scanMode);
        }
        if (changes.v2_login_email) {
          v2LoginEmail = changes.v2_login_email.newValue || '';
          if (el.v2EmailInput) el.v2EmailInput.value = v2LoginEmail;
        }
        if (changes.v2_login_password) {
          v2LoginPassword = changes.v2_login_password.newValue || '';
          if (el.v2PasswordInput) el.v2PasswordInput.value = v2LoginPassword;
        }
        if (changes.v1_login_email) {
          v1LoginEmail = changes.v1_login_email.newValue || '';
          if (el.v1EmailInput) el.v1EmailInput.value = v1LoginEmail;
        }
        if (changes.v1_login_password) {
          v1LoginPassword = changes.v1_login_password.newValue || '';
          if (el.v1PasswordInput) el.v1PasswordInput.value = v1LoginPassword;
        }
        if (changes.auto_login_enabled !== undefined) {
          autoLoginEnabled = changes.auto_login_enabled.newValue;
          if (el.toggleAutologin) el.toggleAutologin.checked = autoLoginEnabled;
        }
        if (changes.floating_widget_enabled !== undefined) {
          floatingWidgetEnabled = Boolean(changes.floating_widget_enabled.newValue);
          if (el.toggleFloatingWidget) el.toggleFloatingWidget.checked = floatingWidgetEnabled;
        }
        if (changes.station_pc_name) {
          stationPcName = changes.station_pc_name.newValue || 'PC-1';
          if (el.sheetPcNameInput) el.sheetPcNameInput.value = stationPcName;
          if (el.stationPcNameDisplay) el.stationPcNameDisplay.textContent = stationPcName;
        }
        if (changes.themeMode) {
          applyThemeMode(changes.themeMode.newValue);
        }
        if (changes.soundVolume) {
          soundVolume = Number(changes.soundVolume.newValue);
          if (soundVolume > 1.5) soundVolume = soundVolume / 100;
          const pct = Math.round(soundVolume * 100);
          if (el.volumeSlider) el.volumeSlider.value = pct;
          if (el.volumeVal) el.volumeVal.textContent = formatVolumeLabel(pct);
          updateMasterGain();
        }
        if (changes.soundEnabled !== undefined) {
          soundEnabled = changes.soundEnabled.newValue;
          updateMasterGain();
        }
        const isAudible = soundEnabled && soundVolume > 0;
        el.soundIcon.textContent = isAudible ? '🔊' : '🔇';
        el.toggleSound.classList.toggle('active', isAudible);

        if (changes.sheet_sync_url) {
          sheetSyncUrl = changes.sheet_sync_url.newValue || '';
          if (el.sheetUrlInput) el.sheetUrlInput.value = sheetSyncUrl;
          updateSheetSyncUI(sheetSyncEnabled && sheetSyncUrl ? 'connected' : 'offline');
        }
        if (changes.sheet_sync_enabled !== undefined) {
          sheetSyncEnabled = changes.sheet_sync_enabled.newValue;
          updateSheetSyncUI(sheetSyncEnabled && sheetSyncUrl ? 'connected' : 'offline');
        }

        if (changes.v2_logged_in !== undefined) {
          isV2LoggedIn = changes.v2_logged_in.newValue;
          updateOmsStatusPills();
          updateCredStatusBadge('v2', isV2LoggedIn);
        }
        if (changes.v1_logged_in !== undefined) {
          isV1LoggedIn = changes.v1_logged_in.newValue;
          updateOmsStatusPills();
          updateCredStatusBadge('v1', isV1LoggedIn);
        }

        if (changes.es_preferred_theme) {
          updateWidgetPillsUI(changes.es_preferred_theme.newValue, undefined);
        }
        if (changes.es_fab_size !== undefined) {
          updateWidgetPillsUI(undefined, changes.es_fab_size.newValue);
        }

        // Live Real-Time Sync for OMS Login / Logout state changes
        if (changes.oms_logged_in !== undefined) {
          if (changes.oms_logged_in.newValue === true) {
            handleOmsLoggedIn();
          } else if (changes.oms_logged_in.newValue === false) {
            handleOmsLoggedOut(false);
          }
        }
      }
    });

    // Listen for broadcast messages from background or other tabs
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.action === 'oms_auth_updated') {
        if (msg.panel === 'v2') {
          isV2LoggedIn = msg.loggedIn;
          updateOmsStatusPills();
          updateCredStatusBadge('v2', isV2LoggedIn);
        } else if (msg.panel === 'v1') {
          isV1LoggedIn = msg.loggedIn;
          updateOmsStatusPills();
          updateCredStatusBadge('v1', isV1LoggedIn);
        } else {
          if (msg.v2_logged_in !== undefined) isV2LoggedIn = msg.v2_logged_in;
          if (msg.v1_logged_in !== undefined) isV1LoggedIn = msg.v1_logged_in;
          updateOmsStatusPills();
        }

        if (isV2LoggedIn || isV1LoggedIn) {
          handleOmsLoggedIn();
        } else if (isV2LoggedIn === false && isV1LoggedIn === false) {
          handleOmsLoggedOut(false);
        }
      }
    });

    // Initial silent OMS session check & schedule periodic heartbeat
    checkOmsSession(true);
    scheduleNextSessionCheck();

    // Instant verification when operator returns to this tab (e.g. after logging into OMS)
    window.addEventListener('focus', () => {
      checkOmsSession(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkOmsSession(true);
      }
    });

    // Auto-focus input
    focusInput();
    setInterval(checkFocus, 2500);
  }

  function isAnyModalOpen() {
    return Boolean(
      (el.imageModal && el.imageModal.style.display === 'flex') ||
      (el.sheetSyncModal && el.sheetSyncModal.style.display === 'flex') ||
      (el.settingsModal && el.settingsModal.style.display === 'flex')
    );
  }

  function checkFocus() {
    // If modal is open, NEVER steal focus or scroll background
    if (isAnyModalOpen()) return;

    // Keep barcode input focused unless user is explicitly on a dropdown, button, slider, or another input
    const active = document.activeElement;
    if (active !== el.awbInput && active.tagName !== 'SELECT' && active.tagName !== 'BUTTON' && active !== el.volumeSlider && active.tagName !== 'INPUT') {
      focusInput();
    }
  }

  function focusInput() {
    if (isAnyModalOpen()) return;
    if (el.awbInput) {
      el.awbInput.focus({ preventScroll: true });
      try {
        el.awbInput.select();
      } catch (e) {}
    }
  }

  // Handle Batch Condition Change
  el.batchCondition.addEventListener('change', (e) => {
    batchCondition = e.target.value;
    el.orderConditionSelect.value = batchCondition;
    el.detailConditionTag.textContent = formatConditionDisplay(batchCondition).toUpperCase();
    chrome.storage.local.set({ batchCondition });
    showToast(`Batch: ${formatConditionDisplay(batchCondition).toUpperCase()}`);
    focusInput();
  });

  // Handle Scan Mode Change
  if (el.scanModeSelect) {
    el.scanModeSelect.addEventListener('change', (e) => {
      scanMode = e.target.value;
      localStorage.setItem('ugaan_scan_mode', scanMode);
      chrome.storage.local.set({ scan_mode: scanMode });
      updateScanModeUI(scanMode);
      showToast(`Mode: ${el.scanModeSelect.options[el.scanModeSelect.selectedIndex].text}`);
      focusInput();
    });
  }

  document.querySelectorAll('[data-scan-mode]').forEach(pill => {
    pill.addEventListener('click', () => {
      const mode = pill.getAttribute('data-scan-mode');
      if (mode) {
        scanMode = mode;
        localStorage.setItem('ugaan_scan_mode', scanMode);
        chrome.storage.local.set({ scan_mode: scanMode });
        updateScanModeUI(scanMode);
        showToast(`Scan Mode: ${mode.toUpperCase()}`);
        focusInput();
      }
    });
  });

  // Handle Toggles
  el.toggleAutosubmit.addEventListener('change', (e) => {
    autoSubmitEnabled = e.target.checked;
    chrome.storage.local.set({ autoSubmitEnabled });
    showToast(autoSubmitEnabled ? "Auto-Submit ON" : "Auto-Submit OFF");
    focusInput();
  });

  el.toggleSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (!soundEnabled) {
      el.soundIcon.textContent = '🔇';
      el.toggleSound.classList.remove('active');
      showToast("Sound Muted");
    } else {
      if (soundVolume <= 0) soundVolume = 1.0;
      const pct = Math.round(soundVolume * 100);
      if (el.volumeSlider) el.volumeSlider.value = pct;
      if (el.volumeVal) el.volumeVal.textContent = formatVolumeLabel(pct);
      el.soundIcon.textContent = '🔊';
      el.toggleSound.classList.add('active');
      showToast(`Sound ON (${formatVolumeLabel(pct)})`);
      updateMasterGain();
      playSound('success');
    }
    chrome.storage.local.set({ soundEnabled, soundVolume });
    focusInput();
  });

  // Manual Volume Slider Listeners (0% to 150% Boost)
  let livePreviewTimer = null;

  if (el.volumeSlider) {
    el.volumeSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      soundVolume = val / 100;
      soundEnabled = val > 0;
      updateMasterGain();
      if (el.volumeVal) el.volumeVal.textContent = formatVolumeLabel(val);
      const isAudible = soundEnabled && soundVolume > 0;
      el.soundIcon.textContent = isAudible ? '🔊' : '🔇';
      el.toggleSound.classList.toggle('active', isAudible);

      // Immediate audible preview while sliding so operator hears the exact loudness
      if (livePreviewTimer) clearTimeout(livePreviewTimer);
      if (isAudible) {
        livePreviewTimer = setTimeout(() => {
          playSound('success');
        }, 130);
      }
    });

    el.volumeSlider.addEventListener('change', (e) => {
      const val = Number(e.target.value);
      soundVolume = val / 100;
      soundEnabled = val > 0;
      updateMasterGain();
      chrome.storage.local.set({ soundVolume, soundEnabled });
      if (soundEnabled && soundVolume > 0) {
        playSound('success');
      }
    });

    const soundGroup = document.querySelector('.sound-control-group');
    if (soundGroup) {
      el.volumeSlider.addEventListener('mousedown', () => {
        soundGroup.classList.add('active-expand');
      });
      window.addEventListener('mouseup', () => {
        soundGroup.classList.remove('active-expand');
      });
    }
  }

  if (el.toggleTheme) {
    el.toggleTheme.addEventListener('click', () => {
      const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyThemeMode(nextTheme);
      chrome.storage.local.set({ themeMode: nextTheme });
      showToast(nextTheme === 'light' ? "Light Theme Active ☀️" : "Dark Theme Active 🌙");
      focusInput();
    });
  }

  el.toggleFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Barcode Input Trigger
  el.awbInput.addEventListener('input', () => {
    const val = el.awbInput.value;
    const upper = val.toUpperCase();
    if (val !== upper) {
      const start = el.awbInput.selectionStart;
      const end = el.awbInput.selectionEnd;
      el.awbInput.value = upper;
      if (start !== null && end !== null) {
        try { el.awbInput.setSelectionRange(start, end); } catch (e) {}
      }
    }
  });

  el.awbInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScanTrigger();
    } else if (e.key === 'Escape') {
      cancelCurrentAction();
    }
  });

  el.btnSearchManual.addEventListener('click', () => {
    handleScanTrigger();
  });

  // Helper to sanitize scanned barcode / AWB strings
  function cleanAwbString(str) {
    if (!str) return '';
    return String(str)
      .trim()
      .replace(/^[(\s"'\[]+|[)\s"'\]]+$/g, '')
      .replace(/^[\t\r\n]+|[\t\r\n]+$/g, '')
      .trim()
      .toUpperCase();
  }

  function handleScanTrigger() {
    const rawAwb = cleanAwbString(el.awbInput.value);
    if (!rawAwb) return;
    el.awbInput.value = rawAwb;

    // Check if already scanned today
    const existing = todayScans.find(s => cleanAwbString(s.awb || '').toLowerCase() === rawAwb.toLowerCase());
    if (existing) {
      playSound('duplicate');
      setStatus('DUPLICATE PARCEL', 'error');

      // Separate Duplicate Notification (Amber Card)
      showNotification(
        "Already Scanned",
        `AWB: ${rawAwb} was already scanned at ${existing.timestamp}.`,
        "duplicate",
        4500
      );

      // Display the full order details and product image!
      const src = existing.oms_source || existing._oms_source || 'V1';
      existing.oms_source = src;
      existing._oms_source = src;
      existing.suborder_number = existing.suborder_number || existing.suborder_no || '-';
      displayOrderDetails(existing);
      el.detailConditionTag.textContent = `ALREADY SCANNED (${(existing.condition || 'GOOD').toUpperCase()})`;
      el.detStatus.textContent = 'Submitted';
      el.btnManualSubmit.disabled = true;
      el.btnManualSubmit.innerHTML = '<span>Already Submitted</span>';

      // If image is missing in cache, fetch it from OMS in background
      if (!existing.image_url) {
        if (existing.oms_source === 'V1') {
          fetch('https://oms.elitesecom.ai/api/return_order_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ awbNumber: rawAwb, refrenceCode: '', subOrderNumber: '' })
          })
            .then(r => r.json())
            .then(data => {
              if (data && data.orders && data.orders[0]) {
                const imgUrl = data.orders[0].product_image;
                if (imgUrl) {
                  existing.image_url = imgUrl;
                  el.productImg.src = imgUrl;
                  el.productImg.style.display = 'block';
                  el.placeholderBox.style.display = 'none';
                  el.imageFooter.style.display = 'flex';
                  saveTodayScans();
                }
              }
            })
            .catch(() => {});
        } else {
          fetch('https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ search_type: 'return_awb', value: rawAwb })
          })
            .then(r => r.json())
            .then(data => {
              if (data && data.return_orders && data.return_orders[0]) {
                const ord = data.return_orders[0];
                const imgUrl = ord.image_url || ord.product_image || (ord.images && ord.images[0]);
                if (imgUrl) {
                  existing.image_url = imgUrl;
                  el.productImg.src = imgUrl;
                  el.productImg.style.display = 'block';
                  el.placeholderBox.style.display = 'none';
                  el.imageFooter.style.display = 'flex';
                  saveTodayScans();
                }
              }
            })
            .catch(() => {});
        }
      }

      // Auto clear input so operator doesn't need to walk to PC!
      el.awbInput.value = '';
      focusInput();
      return;
    }

    cancelTimers();

    // If Direct Scan Mode is active, bypass detail fetch and submit immediately!
    if (scanMode === 'direct') {
      performDirectReturnScan(rawAwb, el.orderConditionSelect.value || batchCondition, false);
      return;
    }

    fetchReturnOrderData(rawAwb);
  }

  // Helper to process and display an order once found (from either V1 or V2)
  function handleFoundOrder(order, awb) {
    el.imageLoader.style.display = 'none';
    const oms = order._oms_source || order.oms_source || 'V1';
    order._oms_source = oms;
    order.oms_source = oms;
    currentOrder = order;
    displayOrderDetails(order);

    // Check if ALREADY QC PASSED / RECEIVED in OMS
    const statusLower = (order.return_status || '').toLowerCase();
    const isAlreadyQc = statusLower.includes('qc') || statusLower.includes('received');
    if (isAlreadyQc) {
      playSound('duplicate');
      setStatus('ALREADY RECEIVED', 'error');
      el.detailConditionTag.textContent = `ALREADY RECEIVED (${(order.return_condition || order.return_status || 'PASSED').toUpperCase()})`;
      el.btnManualSubmit.disabled = true;

      showNotification(
        "Already Received",
        `AWB: ${awb} is already marked as '${order.return_status}' in ${oms}.`,
        "duplicate",
        4500
      );

      el.awbInput.value = '';
      focusInput();
      return;
    }

    // Check Quantity Logic (Core User Rule)
    const qty = Number(order.return_quantity || order.quantity || order.suborder_item_quantity || 1);

    if (qty > 1) {
      // MULTI-QUANTITY CASE: DO NOT AUTO SUBMIT!
      playSound('warning');
      setStatus(`${oms}: MULTI-QTY VERIFY`, 'submitting');
      showMultiQtyAlert(qty);
    } else {
      // SINGLE QUANTITY CASE (Qty == 1)
      hideMultiQtyAlert();
      if (autoSubmitEnabled) {
        // Instant submit - zero delay, no countdown bar!
        submitReturnScan(order, el.orderConditionSelect.value || batchCondition);
      } else {
        setStatus(`PRESS ENTER TO SUBMIT (${oms})`, 'ready');
        el.btnManualSubmit.disabled = false;
      }
    }
  }

  // Search V1 (oms.elitesecom.ai - Ugaan)
  async function searchV1(awb) {
    awb = cleanAwbString(awb);
    let v1Data = null;
    let v1LoginRequired = false;

    try {
      const response = await fetch('https://oms.elitesecom.ai/api/return_order_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          awbNumber: awb,
          refrenceCode: '',
          subOrderNumber: ''
        })
      });

      const responseText = await response.text();
      try { v1Data = JSON.parse(responseText); } catch (e) {}

      v1LoginRequired = (response.redirected && response.url && response.url.includes('login')) || isV1SessionExpired(response.status, responseText, v1Data);

      if (v1LoginRequired && autoLoginEnabled) {
        showToast("V1 session expired, auto-logging in...", "info");
        const ok = await attemptAutoLogin('v1');
        if (ok) {
          try {
            const retryRes = await fetch('https://oms.elitesecom.ai/api/return_order_data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ awbNumber: awb, refrenceCode: '', subOrderNumber: '' })
            });
            const retryText = await retryRes.text();
            try { v1Data = JSON.parse(retryText); } catch (e) {}
            v1LoginRequired = isV1SessionExpired(retryRes.status, retryText, v1Data);
            isV1LoggedIn = !v1LoginRequired;
            updateOmsStatusPills();
          } catch (e) {}
        }
      }

      // Fallback search by subOrderNumber or refrenceCode if awbNumber yields nothing
      if (!v1LoginRequired && (!v1Data || !v1Data.orders || v1Data.orders.length === 0)) {
        try {
          const subRes = await fetch('https://oms.elitesecom.ai/api/return_order_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ awbNumber: '', refrenceCode: awb, subOrderNumber: awb })
          });
          const subData = await subRes.json();
          if (subData && subData.orders && subData.orders.length > 0) {
            v1Data = subData;
          }
        } catch (e) {}
      }

      if (!v1LoginRequired && response.status === 200 && v1Data && v1Data.success !== false) {
        isV1LoggedIn = true;
        updateOmsStatusPills();
      } else if (v1LoginRequired) {
        isV1LoggedIn = false;
        updateOmsStatusPills();
      }
    } catch (err) {
      console.warn('[Scanner] V1 search error:', err);
    }

    if (v1Data && v1Data.orders && v1Data.orders.length > 0) {
      const raw = v1Data.orders[0];
      const isCancelledOrZeroReturn = Boolean(
        (raw.return_quantity !== undefined && raw.return_quantity !== null && Number(raw.return_quantity) === 0) ||
        (raw.status && raw.status.toLowerCase().includes('cancel')) ||
        (raw.order_status && raw.order_status.toLowerCase().includes('cancel')) ||
        (raw.return_type && raw.return_type.toLowerCase().includes('cancel'))
      );

      const parsedQty = Number(raw.return_quantity || raw.suborder_item_quantity || raw.quantity || 1);
      const safeQty = parsedQty > 0 ? parsedQty : Number(raw.quantity || raw.suborder_item_quantity || 1);

      const order = {
        _oms_source: 'V1',
        oms_source: 'V1',
        id: raw.suborder_number || raw.order_number || Date.now(),
        raw_data: raw,
        master_sku: raw.sku || raw.master_sku || '-',
        marketplace_sku: raw.sku || raw.marketplace_sku || '-',
        marketplace: raw.marketplace || '-',
        suborder_number: raw.suborder_number || raw.order_number || '-',
        suborder_no: raw.suborder_number || raw.order_number || '-',
        return_awb_number: raw.return_awb_number || raw.awb_number || awb,
        awb: raw.return_awb_number || raw.awb_number || awb,
        return_quantity: safeQty,
        quantity: safeQty,
        return_status: raw.return_received_quantity ? 'received' : (isCancelledOrZeroReturn ? 'cancelled' : 'pending'),
        return_type: isCancelledOrZeroReturn ? 'Cancelled Order' : (raw.return_type || 'Customer Return'),
        is_cancelled: isCancelledOrZeroReturn,
        fource: isCancelledOrZeroReturn,
        image_url: raw.product_image || '',
        product_image: raw.product_image || '',
        rtn_reason: raw.rtn_reason || (isCancelledOrZeroReturn ? 'Cancelled' : '')
      };
      return { found: true, order, loginRequired: false };
    }

    return { found: false, loginRequired: v1LoginRequired };
  }

  // Search V2 (my.elitesecom.ai - Jkstyle)
  async function searchV2(awb) {
    awb = cleanAwbString(awb);
    let v2Data = null;
    let v2LoginRequired = false;

    try {
      const response = await fetch('https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ search_type: 'return_awb', value: awb })
      });

      const responseText = await response.text();
      try { v2Data = JSON.parse(responseText); } catch (e) {}

      v2LoginRequired = (response.redirected && response.url && response.url.includes('login')) || isV2SessionExpired(response.status, responseText, v2Data);

      if (v2LoginRequired && autoLoginEnabled) {
        showToast("V2 session expired, auto-logging in...", "info");
        const ok = await attemptAutoLogin('v2');
        if (ok) {
          try {
            const retryRes = await fetch('https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ search_type: 'return_awb', value: awb })
            });
            const retryText = await retryRes.text();
            try { v2Data = JSON.parse(retryText); } catch (e) {}
            v2LoginRequired = false;
            isV2LoggedIn = true;
            updateOmsStatusPills();
          } catch (e) {}
        }
      }

      // Intelligent Fallback for Flipkart / Ekart RTOs (search_type: forward_awb)
      if (!v2LoginRequired && (!v2Data || !v2Data.return_orders || v2Data.return_orders.length === 0)) {
        try {
          const fwdRes = await fetch('https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ search_type: 'forward_awb', value: awb })
          });
          const fwdText = await fwdRes.text();
          let fwdData = null;
          try { fwdData = JSON.parse(fwdText); } catch (e) {}
          if (fwdData && fwdData.success && fwdData.return_orders && fwdData.return_orders.length > 0) {
            v2Data = fwdData;
          }
        } catch (e) {}
      }

      // Fallback search by suborder_number if still not found
      if (!v2LoginRequired && (!v2Data || !v2Data.return_orders || v2Data.return_orders.length === 0)) {
        try {
          const subRes = await fetch('https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ search_type: 'suborder_number', value: awb })
          });
          const subText = await subRes.text();
          let subData = null;
          try { subData = JSON.parse(subText); } catch (e) {}
          if (subData && subData.success && subData.return_orders && subData.return_orders.length > 0) {
            v2Data = subData;
          }
        } catch (e) {}
      }

      if (!v2LoginRequired && response.status === 200) {
        isV2LoggedIn = true;
        updateOmsStatusPills();
      } else if (v2LoginRequired) {
        isV2LoggedIn = false;
        updateOmsStatusPills();
      }
    } catch (err) {
      console.warn('[Scanner] V2 search error:', err);
    }

    if (v2Data && v2Data.success && v2Data.return_orders && v2Data.return_orders.length > 0) {
      const order = v2Data.return_orders[0];
      order._oms_source = 'V2';
      order.oms_source = 'V2';
      order.suborder_number = order.suborder_number || order.suborder_no || '-';
      order.suborder_no = order.suborder_number;
      order.awb = order.return_awb_number || order.forward_awb || order.awb || awb;
      order.quantity = Number(order.return_quantity || order.quantity || order.suborder_item_quantity || 1);
      order.return_quantity = order.quantity;
      order.image_url = order.image_url || order.product_image || (order.images && order.images[0]) || '';
      if (order.is_received === true || order.is_received === 1 || order.is_received === '1' || (order.received_date && order.received_date !== '-')) {
        order.return_status = 'received';
      }
      return { found: true, order, loginRequired: false };
    }

    return { found: false, loginRequired: v2LoginRequired };
  }

  // Fetch Order Data with Intelligent Fallback (Priority-aware: V1 First / V2 First)
  async function fetchReturnOrderData(awb) {
    el.imageLoader.style.display = 'flex';
    el.placeholderBox.style.display = 'none';
    el.productImg.style.display = 'none';

    let firstRes = null;
    let secondRes = null;
    const isV2Priority = omsPriority !== 'v1'; // Default: V2 First (my.elitesecom.ai - Jkstyle)

    if (isV2Priority) {
      // 1. Primary: V2 (my.elitesecom.ai - Jkstyle)
      setStatus('CHECKING V2 (JKSTYLE)...', 'scanning');
      firstRes = await searchV2(awb);
      if (firstRes.found) {
        handleFoundOrder(firstRes.order, awb);
        return;
      }

      // 2. Fallback: V1 (oms.elitesecom.ai - Ugaan)
      setStatus('CHECKING V1 (UGAAN)...', 'scanning');
      secondRes = await searchV1(awb);
      if (secondRes.found) {
        handleFoundOrder(secondRes.order, awb);
        return;
      }
    } else {
      // 1. Primary: V1 (oms.elitesecom.ai - Ugaan)
      setStatus('CHECKING V1 (UGAAN)...', 'scanning');
      firstRes = await searchV1(awb);
      if (firstRes.found) {
        handleFoundOrder(firstRes.order, awb);
        return;
      }

      // 2. Fallback: V2 (my.elitesecom.ai - Jkstyle)
      setStatus('CHECKING V2 (JKSTYLE)...', 'scanning');
      secondRes = await searchV2(awb);
      if (secondRes.found) {
        handleFoundOrder(secondRes.order, awb);
        return;
      }
    }

    // Not found in either OMS
    el.imageLoader.style.display = 'none';

    const v1LoginReq = isV2Priority ? (secondRes && secondRes.loginRequired) : (firstRes && firstRes.loginRequired);
    const v2LoginReq = isV2Priority ? (firstRes && firstRes.loginRequired) : (secondRes && secondRes.loginRequired);

    if (v1LoginReq && v2LoginReq) {
      handleOmsLoggedOut(true, 'Both V1 & V2 Sessions Expired');
      return;
    } else if (v1LoginReq) {
      handleOmsLoggedOut(true, 'V1 (oms.elitesecom.ai) Session Expired');
      return;
    } else if (v2LoginReq) {
      handleOmsLoggedOut(true, 'V2 (my.elitesecom.ai) Session Expired');
      return;
    }

    // --- SMART AUTO-FALLBACK FOR SAME DAY CANCEL ---
    if (scanMode === 'auto') {
      console.log(`[Scanner] AWB ${awb} not found in Detail Mode. Attempting Smart Auto-Fallback: Direct Scan (Same Day Cancel)...`);
      await performDirectReturnScan(awb, el.orderConditionSelect.value || batchCondition, true);
      return;
    }

    playSound('not_found'); // Descending alarm
    setStatus('ORDER NOT FOUND IN V1 OR V2', 'error');

    showNotification(
      "Order Not Found in Any OMS!",
      `AWB: ${awb} was not found in V1 or V2. Please check the barcode label.`,
      "not_found",
      5000
    );
    resetDisplay();
    el.awbInput.value = '';
    focusInput();
  }

  // Display Order Information & Big Image
  function displayOrderDetails(order) {
    // 1. Image
    if (order.image_url) {
      el.productImg.src = order.image_url;
      el.productImg.style.display = 'block';
      el.placeholderBox.style.display = 'none';
      el.imageFooter.style.display = 'flex';
      el.imgSkuFooter.textContent = `SKU: ${order.master_sku || '-'}`;
    } else {
      el.productImg.style.display = 'none';
      el.placeholderBox.style.display = 'flex';
      el.imageFooter.style.display = 'none';
    }

    // OMS Source Badge (V1 or V2) - Robust resolution
    const omsSource = order._oms_source || order.oms_source || 'V1';
    order._oms_source = omsSource;
    order.oms_source = omsSource;

    if (el.imageOmsBadge) {
      el.imageOmsBadge.textContent = omsSource;
      el.imageOmsBadge.className = 'badge badge-oms ' + (omsSource === 'V1' ? 'badge-oms-v1' : 'badge-oms-v2');
      el.imageOmsBadge.style.display = 'inline-block';
    }
    if (el.detailOmsTag) {
      el.detailOmsTag.textContent = omsSource;
      el.detailOmsTag.className = 'badge badge-oms ' + (omsSource === 'V1' ? 'badge-oms-v1' : 'badge-oms-v2');
      el.detailOmsTag.style.display = 'inline-block';
    }

    const isSameDay = Boolean(order.is_same_day_cancel || order.return_type === 'Same Day Cancel');
    if (el.imageSameDayBadge) {
      el.imageSameDayBadge.style.display = isSameDay ? 'inline-block' : 'none';
    }
    if (el.detailSameDayTag) {
      el.detailSameDayTag.style.display = isSameDay ? 'inline-block' : 'none';
    }

    // Marketplace badge
    if (order.marketplace) {
      el.imageMarketplaceBadge.textContent = order.marketplace;
      el.imageMarketplaceBadge.style.display = 'inline-block';
    } else {
      el.imageMarketplaceBadge.style.display = 'none';
    }

    // 2. Order Fields
    el.detMasterSku.textContent = order.master_sku || '-';
    el.detAwb.textContent = order.return_awb_number || order.awb || el.awbInput.value.trim();
    const qty = Number(order.return_quantity || order.quantity || order.suborder_item_quantity || 1);
    el.detQuantity.textContent = qty;
    if (qty > 1) {
      el.detQuantity.style.color = '#f59e0b';
    } else {
      el.detQuantity.style.color = '#10b981';
    }

    el.detMarketplace.textContent = order.marketplace || '-';
    el.detMarketSku.textContent = order.marketplace_sku || '-';
    el.detSuborder.textContent = order.suborder_number || order.suborder_no || '-';
    el.detStatus.textContent = order.return_status || order.status || 'delivered';
    el.detType.textContent = order.return_type || (omsSource === 'V1' ? 'Customer Return' : 'courier_return');

    // Condition select defaults to current batchCondition
    el.orderConditionSelect.value = batchCondition;
    el.detailConditionTag.textContent = formatConditionDisplay(batchCondition).toUpperCase();
    el.btnManualSubmit.disabled = false;
    el.btnManualSubmit.innerHTML = '<span>Submit (Enter)</span>';
  }

  // Multi-Quantity Alert Handling
  function showMultiQtyAlert(qty) {
    el.alertQtyNum.textContent = qty;
    el.multiQtyAlertBox.style.display = 'flex';
    el.btnManualSubmit.disabled = false;
    el.btnManualSubmitAlert.focus();
  }

  function hideMultiQtyAlert() {
    el.multiQtyAlertBox.style.display = 'none';
  }

  function cancelTimers() {
    if (autoSubmitTimer) {
      clearTimeout(autoSubmitTimer);
      autoSubmitTimer = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function cancelCurrentAction() {
    cancelTimers();
    hideMultiQtyAlert();
    resetDisplay();
    showToast("Scan cancelled.");
    focusInput();
  }

  el.btnCancelAlert.addEventListener('click', () => {
    cancelCurrentAction();
  });

  if (el.btnOpenLogin) {
    el.btnOpenLogin.addEventListener('click', () => {
      openSettingsModal('tab-login');
    });
  }

  if (el.btnOpenV1Login) {
    el.btnOpenV1Login.addEventListener('click', () => {
      openSettingsModal('tab-login');
    });
  }

  if (el.btnV2Status) {
    el.btnV2Status.addEventListener('click', () => {
      if (isV2LoggedIn === false) {
        openSettingsModal('tab-login');
      } else {
        window.open('https://my.elitesecom.ai/scanorders/return-entry', '_blank');
      }
    });
  }

  if (el.btnV1Status) {
    el.btnV1Status.addEventListener('click', () => {
      if (isV1LoggedIn === false) {
        openSettingsModal('tab-login');
      } else {
        window.open('https://oms.elitesecom.ai/scanorders/return-entry', '_blank');
      }
    });
  }

  if (el.btnDismissLogin) {
    el.btnDismissLogin.addEventListener('click', () => {
      el.loginExpiredBox.style.display = 'none';
      focusInput();
    });
  }

  // Manual Submit Triggers
  el.btnManualSubmitAlert.addEventListener('click', () => {
    if (currentOrder) {
      submitReturnScan(currentOrder, el.orderConditionSelect.value || batchCondition);
    }
  });

  el.btnManualSubmit.addEventListener('click', () => {
    if (currentOrder) {
      cancelTimers();
      submitReturnScan(currentOrder, el.orderConditionSelect.value || batchCondition);
    }
  });

  el.btnClearCurrent.addEventListener('click', () => {
    cancelCurrentAction();
  });

  // Submit API: Dynamic Routing (V1: ee-scanOrders vs V2: return_scan)
  async function submitReturnScan(order, condition) {
    if (isSubmitting) return;
    isSubmitting = true;
    el.btnManualSubmit.disabled = true;
    el.btnManualSubmit.innerHTML = '<span>Submitting...</span>';
    cancelTimers();
    hideMultiQtyAlert();
    setStatus('SUBMITTING...', 'submitting');

    const awb = (order.return_awb_number || order.awb || el.awbInput.value || '').trim();
    const isV1 = (order._oms_source || order.oms_source) === 'V1';

    try {
      let isSuccess = false;
      let resMessage = '';
      let resData = null;
      let isAuthError = false;

      if (isV1) {
        // Submit to V1 (oms.elitesecom.ai)
        const conditionVal = mapConditionForOms(condition, 'V1');
        let targetSuborder = String(order.suborder_number || order.suborder_no || '');
        if ((!targetSuborder || targetSuborder === '-' || targetSuborder === awb) && awb) {
          try {
            const lookupRes = await fetch('https://oms.elitesecom.ai/api/return_order_data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ awbNumber: awb, refrenceCode: '', subOrderNumber: '' })
            });
            const lookupData = await lookupRes.json();
            if (lookupData && lookupData.orders && lookupData.orders[0]) {
              targetSuborder = lookupData.orders[0].suborder_number || lookupData.orders[0].order_number || targetSuborder;
              order.suborder_number = targetSuborder;
              order.suborder_no = targetSuborder;
            }
          } catch (e) {}
        }
        const isCancelled = Boolean(
          order.fource ||
          order.is_cancelled ||
          order.return_type === 'Cancelled Order' ||
          (order.return_status && order.return_status.toLowerCase().includes('cancel')) ||
          (order.return_quantity !== undefined && Number(order.return_quantity) === 0)
        );
        const shouldForce = isCancelled;
        console.log(`[Submit V1] Sending ee-scanOrders for Suborder: ${targetSuborder}, condition: ${conditionVal}, fource: ${shouldForce}`);

        const v1Payload = {
          suborderNumber: String(targetSuborder || awb || ''),
          return_condition: conditionVal,
          fource: shouldForce,
          location_key: null
        };
        // CRITICAL FOR V1: When order is cancelled or forced, NEVER send receive_quantity!
        // Sending receive_quantity > 0 causes V1 backend error "receive_quantity (1) cannot exceed returned quantity (0)"
        if (!shouldForce && Number(order.return_quantity || 1) > 0) {
          v1Payload.receive_quantity = Number(order.quantity || order.return_quantity || 1);
        }

        const response = await fetch('https://oms.elitesecom.ai/api/ee-scanOrders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(v1Payload)
        });

        const responseText = await response.text();
        console.log(`[Submit V1] Status: ${response.status}`, responseText);

        try { resData = JSON.parse(responseText); } catch (e) {}

        isAuthError = isV1SessionExpired(response.status, responseText, resData);
        isSuccess = !isAuthError && response.status === 200 && (!resData || resData.status_code === 200 || (!resData.error && resData.success !== false));
        resMessage = (resData && resData.message) || responseText || 'Submitted to V1';

        // Auto-Force Retry: If V1 rejected because order is cancelled or return_qty is 0, retry with fource: true and OMIT receive_quantity!
        if (!isSuccess && !isAuthError && responseText && (
          responseText.toLowerCase().includes('cannot exceed returned quantity') ||
          responseText.toLowerCase().includes('returned quantity (0)') ||
          responseText.toLowerCase().includes('cancel') ||
          responseText.toLowerCase().includes('force')
        )) {
          console.warn(`[Submit V1] Retrying with fource: true without receive_quantity for cancelled/0-qty order ${targetSuborder}...`);
          showToast(`Force receiving cancelled order in V1...`, 'info');
          const forceRes = await fetch('https://oms.elitesecom.ai/api/ee-scanOrders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              suborderNumber: String(order.suborder_number || order.suborder_no || targetSuborder || awb || ''),
              return_condition: conditionVal,
              fource: true,
              location_key: null
              // OMIT receive_quantity completely so V1 accepts force!
            })
          });
          const forceText = await forceRes.text();
          console.log(`[Submit V1 Force] Status: ${forceRes.status}`, forceText);
          let forceData = null;
          try { forceData = JSON.parse(forceText); } catch (e) {}
          if (forceRes.status === 200 && (!forceData || forceData.status_code === 200 || (!forceData.error && forceData.success !== false))) {
            isSuccess = true;
            resData = forceData;
            resMessage = (forceData && forceData.message) || 'Force submitted to V1 (Cancelled Order)';
            order.is_cancelled = true;
            order.return_type = 'Cancelled Order';
          }
        }
      } else {
        // Submit to V2 (my.elitesecom.ai)
        const conditionToSend = mapConditionForOms(condition, 'V2');
        console.log(`[Submit V2] Sending return_scan for AWB: ${awb}, condition: ${condition} (mapped: ${conditionToSend})`);

        async function callV2Submit(condVal) {
          const resp = await fetch('https://my.elitesecom.ai/api/scanorders/return/return_scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              awbNumber: awb,
              return_condition: condVal
            })
          });
          const txt = await resp.text();
          let parsed = null;
          try { parsed = JSON.parse(txt); } catch (e) {
            parsed = { success: false, message: txt || `HTTP ${resp.status}` };
          }
          return { resp, txt, parsed };
        }

        let { resp: response, txt: responseText, parsed: v2Parsed } = await callV2Submit(conditionToSend);
        resData = v2Parsed;

        // Auto-Retry on 500 Internal Server Error (backend database enum crash)
        if ((response.status === 500 || (responseText && responseText.includes('Internal Server Error'))) && conditionToSend !== 'wrong') {
          console.warn(`[Submit V2] 500 Internal Server Error with condition '${conditionToSend}'. Retrying with safe fallback 'wrong'...`);
          const retry = await callV2Submit('wrong');
          if (retry.parsed && retry.parsed.success) {
            response = retry.resp;
            responseText = retry.txt;
            resData = retry.parsed;
          }
        }

        console.log(`[Submit V2] Status: ${response.status}`, responseText);

        isAuthError = (response.redirected && response.url && response.url.includes('login')) || isV2SessionExpired(response.status, responseText, resData);

        isSuccess = Boolean(resData && resData.success);
        resMessage = (resData && resData.message) || responseText || 'Submitted to V2';
      }

      isSubmitting = false;

      if (isAuthError) {
        if (autoLoginEnabled) {
          showToast(`Re-authenticating ${isV1 ? 'V1' : 'V2'} in background...`, "info");
          const reLogged = await attemptAutoLogin(isV1 ? 'v1' : 'v2');
          if (reLogged) {
            showToast(`${isV1 ? 'V1' : 'V2'} session restored! Retrying submission...`, "success");
            return submitReturnScan(order, condition);
          }
        }
        handleOmsLoggedOut(true, `${isV1 ? 'V1' : 'V2'} Session Expired`);
        return;
      }

      if (isSuccess) {
        const omsSource = order._oms_source || order.oms_source || (isV1 ? 'V1' : 'V2');
        playSound('success'); // Same sweet success chime for both!
        setStatus(`${omsSource}: SUBMITTED!`, 'ready');

        // Immediately update Order Details UI to show Submitted state
        el.detStatus.textContent = 'Submitted';
        el.detailConditionTag.textContent = `SUBMITTED (${formatConditionDisplay(condition).toUpperCase()})`;
        el.btnManualSubmit.disabled = true;
        el.btnManualSubmit.innerHTML = '<span>✓ Submitted</span>';

        // Create history item with explicit OMS tag
        const now = new Date();
        const scanItem = {
          id: order.id || Date.now(),
          timestamp: now.toLocaleTimeString(),
          date: getTodayDateString(),
          pc_name: stationPcName || 'PC-1',
          oms_source: omsSource,
          _oms_source: omsSource,
          awb: awb,
          master_sku: order.master_sku || '-',
          marketplace_sku: order.marketplace_sku || '-',
          marketplace: order.marketplace || '-',
          suborder_no: order.suborder_number || order.suborder_no || '-',
          suborder_number: order.suborder_number || order.suborder_no || '-',
          quantity: Number(order.return_quantity || order.quantity || order.suborder_item_quantity || 1),
          return_quantity: Number(order.return_quantity || order.quantity || order.suborder_item_quantity || 1),
          condition: formatConditionDisplay(condition),
          status: 'Submitted',
          return_status: 'Submitted',
          return_type: order.return_type || (omsSource === 'V1' ? 'Customer Return' : 'courier_return'),
          image_url: order.image_url || ''
        };

        // Add to history (newest first)
        todayScans.unshift(scanItem);
        saveTodayScans();
        renderHistoryTable();
        updateStats();

        // Live Google Sheet Real-time Sync
        if (sheetSyncEnabled && sheetSyncUrl) {
          syncScanToGoogleSheet(scanItem);
        }

        showNotification(
          `${omsSource} Return Submitted Successfully`,
          `AWB: ${awb} | SKU: ${order.master_sku || '-'}`,
          "success",
          3500
        );

        handleOmsLoggedIn();

        // Fast turnaround for next scan
        setTimeout(() => {
          el.awbInput.value = '';
          setStatus('READY TO SCAN', 'ready');
          focusInput();
        }, 300);

      } else {
        const errMsg = resMessage || 'Submission error';
        const errMsgLower = errMsg.toLowerCase();

        // Intelligent Auto-Recovery: If V1 fails because return quantity is 0, auto-fallback to V2 (Jk Style)
        if (isV1 && (errMsgLower.includes('cannot exceed returned quantity') || errMsgLower.includes('returned quantity (0)'))) {
          console.warn(`[Submit] V1 rejected ${awb} due to 0 returned quantity. Automatically retrying on V2 (Jkstyle)...`);
          showToast(`V1 return qty is 0. Checking V2 (Jk Style) for ${awb}...`, 'info');
          const v2Res = await searchV2(awb);
          if (v2Res && v2Res.found) {
            currentOrder = v2Res.order;
            displayOrderDetails(currentOrder);
            showToast(`Found in V2! Submitting to V2...`, 'success');
            return submitReturnScan(currentOrder, condition);
          }
        }

        const statusLower = (order.return_status || '').toLowerCase();
        const isDuplicateOrReceived = 
          statusLower.includes('qc') || 
          statusLower.includes('received') ||
          errMsgLower.includes('already') ||
          errMsgLower.includes('received') ||
          errMsgLower.includes('qc');

        if (isDuplicateOrReceived) {
          playSound('duplicate');
          setStatus('ALREADY RECEIVED / SCANNED', 'error');
          el.detailConditionTag.textContent = `ALREADY RECEIVED`;
          el.detStatus.textContent = 'Already Received';
          el.btnManualSubmit.disabled = true;
          el.btnManualSubmit.innerHTML = '<span>Already Received</span>';

          showNotification(
            "Order already qc passed",
            errMsg || `AWB: ${awb} has already been received in ${order._oms_source || 'OMS'}!`,
            "duplicate",
            5000
          );

          el.awbInput.value = '';
          focusInput();
          return;
        }

        playSound('error');
        setStatus('SUBMISSION ERROR', 'error');
        el.btnManualSubmit.disabled = false;
        el.btnManualSubmit.innerHTML = '<span>Submit (Enter)</span>';
        showNotification("Failed to Submit Return", `${awb}: ${errMsg}`, "error", 4500);

        // Auto-clear and refocus so operator does not have to walk to PC!
        el.awbInput.value = '';
        focusInput();
      }

    } catch (err) {
      isSubmitting = false;
      console.error("[Submit] Network or runtime error:", err);
      playSound('error');
      setStatus('SUBMIT FAILED', 'error');
      showNotification("Submit Network Error", `${awb}: ${err.message}`, "error", 4500);
      el.awbInput.value = '';
      focusInput();
    }
  }

  // Direct Return Scan Handler (Handles Same Day Cancel & Fast Direct Scans)
  async function performDirectReturnScan(rawAwb, condition, isAutoFallback = false) {
    rawAwb = cleanAwbString(rawAwb);
    if (!rawAwb) return;
    if (isSubmitting) return;
    isSubmitting = true;
    el.btnManualSubmit.disabled = true;
    el.btnManualSubmit.innerHTML = '<span>Scanning...</span>';
    cancelTimers();
    hideMultiQtyAlert();

    const cond = condition || el.orderConditionSelect.value || batchCondition || 'good';
    setStatus(isAutoFallback ? 'CHECKING SAME DAY CANCEL...' : 'DIRECT SCANNING...', 'submitting');

    const isV2Priority = omsPriority !== 'v1';

    // Direct Scan attempt for V2 (my.elitesecom.ai - Jkstyle)
    async function directScanV2() {
      try {
        const conditionToSend = mapConditionForOms(cond, 'V2');
        console.log(`[Direct Scan V2] Sending return_scan for AWB: ${rawAwb}, condition: ${cond} (mapped: ${conditionToSend})`);

        async function callV2Direct(cVal) {
          const resp = await fetch('https://my.elitesecom.ai/api/scanorders/return/return_scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              awbNumber: rawAwb,
              return_condition: cVal
            })
          });
          const txt = await resp.text();
          let parsed = null;
          try { parsed = JSON.parse(txt); } catch (e) {
            parsed = { success: false, message: txt };
          }
          return { resp, txt, parsed };
        }

        let { resp: response, txt: responseText, parsed: resData } = await callV2Direct(conditionToSend);

        if ((response.status === 500 || (responseText && responseText.includes('Internal Server Error'))) && conditionToSend !== 'wrong') {
          console.warn(`[Direct Scan V2] 500 error with '${conditionToSend}'. Retrying with safe 'wrong'...`);
          const retry = await callV2Direct('wrong');
          if (retry.parsed && retry.parsed.success) {
            response = retry.resp;
            responseText = retry.txt;
            resData = retry.parsed;
          }
        }

        console.log(`[Direct Scan V2] Status: ${response.status}`, responseText);

        const isAuthError = (response.redirected && response.url && response.url.includes('login')) || isV2SessionExpired(response.status, responseText, resData);
        if (isAuthError && autoLoginEnabled) {
          showToast("V2 session expired, auto-logging in...", "info");
          const reLogged = await attemptAutoLogin('v2');
          if (reLogged) {
            return directScanV2();
          }
        }

        const isSuccess = Boolean(resData && resData.success);
        return {
          success: isSuccess,
          oms: 'V2',
          data: resData,
          status: response.status,
          message: (resData && resData.message) || responseText || 'Submitted to V2',
          authError: isAuthError
        };
      } catch (err) {
        console.warn('[Direct Scan V2] Error:', err);
        return { success: false, oms: 'V2', error: err.message };
      }
    }

    // Direct Scan attempt for V1 (oms.elitesecom.ai - Ugaan)
    async function directScanV1() {
      try {
        const conditionVal = mapConditionForOms(cond, 'V1');

        // In V1, suborder number is required for ee-scanOrders! Look it up from return_order_data first:
        let targetSuborder = rawAwb;
        let v1OrderDetails = null;
        try {
          const lookupRes = await fetch('https://oms.elitesecom.ai/api/return_order_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ awbNumber: rawAwb, refrenceCode: '', subOrderNumber: '' })
          });
          const lookupText = await lookupRes.text();
          let lookupData = null;
          try { lookupData = JSON.parse(lookupText); } catch (e) {}
          if (lookupData && lookupData.orders && lookupData.orders[0]) {
            v1OrderDetails = lookupData.orders[0];
            targetSuborder = v1OrderDetails.suborder_number || v1OrderDetails.order_number || rawAwb;
          }
        } catch (lookupErr) {
          console.warn('[Direct Scan V1] Order lookup error:', lookupErr);
        }

        console.log(`[Direct Scan V1] Sending ee-scanOrders for Suborder: ${targetSuborder}, AWB: ${rawAwb}, condition: ${conditionVal}, fource: true`);
        const response = await fetch('https://oms.elitesecom.ai/api/ee-scanOrders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            suborderNumber: String(targetSuborder),
            return_condition: conditionVal,
            fource: true, // Must be true for direct scan / cancelled orders!
            location_key: null
            // OMIT receive_quantity completely so V1 accepts cancelled / direct orders!
          })
        });

        const responseText = await response.text();
        console.log(`[Direct Scan V1] Status: ${response.status}`, responseText);

        let resData = null;
        try { resData = JSON.parse(responseText); } catch (e) {}

        const isAuthError = isV1SessionExpired(response.status, responseText, resData);
        if (isAuthError && autoLoginEnabled) {
          showToast("V1 session expired, auto-logging in...", "info");
          const reLogged = await attemptAutoLogin('v1');
          if (reLogged) {
            return directScanV1();
          }
        }

        const isSuccess = !isAuthError && response.status === 200 && (!resData || resData.status_code === 200 || (!resData.error && resData.success !== false));
        if (isSuccess && v1OrderDetails) {
          if (!resData) resData = {};
          if (!resData.order) {
            resData.order = {
              id: v1OrderDetails.suborder_number || Date.now(),
              master_sku: v1OrderDetails.sku || v1OrderDetails.master_sku || 'Cancelled Order',
              marketplace_sku: v1OrderDetails.sku || v1OrderDetails.marketplace_sku || '-',
              marketplace: v1OrderDetails.marketplace || 'Meesho',
              suborder_number: targetSuborder,
              suborder_no: targetSuborder,
              quantity: Number(v1OrderDetails.suborder_item_quantity || v1OrderDetails.quantity || 1),
              image_url: v1OrderDetails.product_image || '',
              product_image: v1OrderDetails.product_image || ''
            };
          }
        }

        return {
          success: isSuccess,
          oms: 'V1',
          data: resData,
          status: response.status,
          message: (resData && resData.message) || responseText || 'Submitted to V1',
          authError: isAuthError
        };
      } catch (err) {
        console.warn('[Direct Scan V1] Error:', err);
        return { success: false, oms: 'V1', error: err.message };
      }
    }

    let result = null;
    if (isV2Priority) {
      result = await directScanV2();
      if (!result.success && !result.authError) {
        console.log('[Direct Scan] V2 attempt unsuccessful, trying V1 fallback...');
        const v1Res = await directScanV1();
        if (v1Res.success || (v1Res.data && v1Res.data.order)) result = v1Res;
      }
    } else {
      result = await directScanV1();
      if (!result.success && !result.authError) {
        console.log('[Direct Scan] V1 attempt unsuccessful, trying V2 fallback...');
        const v2Res = await directScanV2();
        if (v2Res.success || (v2Res.data && v2Res.data.order)) result = v2Res;
      }
    }

    isSubmitting = false;

    if (result && result.authError) {
      handleOmsLoggedOut(true, `${result.oms} Session Expired`);
      return;
    }

    if (result && result.success) {
      const omsSource = result.oms;
      const resData = result.data;
      const orderInfo = (resData && (resData.order || resData.return_order || resData.data)) || {};

      playSound('success');
      setStatus(`${omsSource}: SUBMITTED (SAME DAY CANCEL)!`, 'ready');

      const now = new Date();
      const scanItem = {
        id: orderInfo.id || Date.now(),
        timestamp: now.toLocaleTimeString(),
        date: getTodayDateString(),
        pc_name: stationPcName || 'PC-1',
        oms_source: omsSource,
        _oms_source: omsSource,
        awb: rawAwb,
        master_sku: orderInfo.master_sku || orderInfo.sku || 'Same Day Cancel',
        marketplace_sku: orderInfo.marketplace_sku || orderInfo.sku || '-',
        marketplace: orderInfo.marketplace || '-',
        suborder_no: orderInfo.suborder_number || orderInfo.suborder_no || rawAwb,
        suborder_number: orderInfo.suborder_number || orderInfo.suborder_no || rawAwb,
        quantity: Number(orderInfo.quantity || orderInfo.return_quantity || 1),
        return_quantity: Number(orderInfo.quantity || orderInfo.return_quantity || 1),
        condition: formatConditionDisplay(cond),
        status: 'Submitted',
        return_status: 'Submitted',
        return_type: 'Same Day Cancel',
        is_same_day_cancel: true,
        image_url: orderInfo.image_url || orderInfo.product_image || ''
      };

      currentOrder = scanItem;
      displayOrderDetails(scanItem);

      el.detStatus.textContent = 'Submitted';
      el.detailConditionTag.textContent = `SUBMITTED (${formatConditionDisplay(cond).toUpperCase()})`;
      el.btnManualSubmit.disabled = true;
      el.btnManualSubmit.innerHTML = '<span>✓ Submitted</span>';

      todayScans.unshift(scanItem);
      saveTodayScans();
      renderHistoryTable();
      updateStats();

      if (sheetSyncEnabled && sheetSyncUrl) {
        syncScanToGoogleSheet(scanItem);
      }

      showNotification(
        `${omsSource} Same Day Cancel Scanned Successfully`,
        `AWB: ${rawAwb} | Condition: ${cond.toUpperCase()}`,
        "success",
        3500
      );

      handleOmsLoggedIn();

      setTimeout(() => {
        el.awbInput.value = '';
        setStatus('READY TO SCAN', 'ready');
        focusInput();
      }, 300);

    } else {
      playSound('not_found');
      setStatus('ORDER NOT FOUND IN V1 OR V2', 'error');

      const errMsg = (result && result.message) || 'Not found in OMS';
      showNotification(
        "Order Not Found in Any OMS!",
        `AWB: ${rawAwb} (${errMsg}). Please check barcode label.`,
        "not_found",
        5000
      );

      resetDisplay();
      el.awbInput.value = '';
      focusInput();
    }
  }

  // Storage Persistence
  function saveTodayScans() {
    const key = getTodayKey();
    chrome.storage.local.set({ [key]: todayScans });
  }

  // Update Statistics
  function updateStats() {
    const total = todayScans.length;
    const good = todayScans.filter(i => {
      const c = (i.condition || '').toLowerCase();
      return c === 'good' || c === 'complete';
    }).length;
    const multi = todayScans.filter(i => (i.quantity || 1) > 1).length;
    const defects = todayScans.filter(i => {
      const c = (i.condition || '').toLowerCase();
      return ['damaged', 'wrong', 'repair', 'used'].includes(c) || c.includes('missing');
    }).length;

    el.statTotalScans.textContent = total;
    el.statGoodScans.textContent = good;
    el.statMultiScans.textContent = multi;
    el.statDefectScans.textContent = defects;
    el.historyCount.textContent = `${total} items`;
  }

  // Render Scans History Table
  function renderHistoryTable() {
    const filter = currentFilter;
    let filtered = todayScans;

    if (filter === 'good') {
      filtered = todayScans.filter(i => {
        const c = (i.condition || '').toLowerCase();
        return c === 'good' || c === 'complete';
      });
    } else if (filter === 'multi') {
      filtered = todayScans.filter(i => (i.quantity || 1) > 1);
    } else if (filter === 'defect') {
      filtered = todayScans.filter(i => {
        const c = (i.condition || '').toLowerCase();
        return ['damaged', 'wrong', 'repair', 'used'].includes(c) || c.includes('missing');
      });
    }

    if (filtered.length === 0) {
      el.historyTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="10">No items match current filter. Start scanning above!</td>
        </tr>
      `;
      return;
    }

    el.historyTableBody.innerHTML = filtered.map(item => `
      <tr>
        <td><b>${item.timestamp}</b></td>
        <td>
          <span class="badge badge-oms ${(item.oms_source === 'V1') ? 'badge-oms-v1' : 'badge-oms-v2'}">
            ${item.oms_source || 'V2'}
          </span>
        </td>
        <td>
          ${item.image_url 
            ? `<img src="${item.image_url}" class="thumb-img" data-img="${item.image_url}" data-sku="${item.master_sku}" alt="Thumb">` 
            : `<span style="color:#64748b;">No Img</span>`
          }
        </td>
        <td><code style="color:#38bdf8; font-weight:700;">${item.awb}</code></td>
        <td><b>${item.master_sku}</b></td>
        <td><span class="badge" style="background:#0284c7; padding:2px 6px; border-radius:4px; font-size:11px;">${item.marketplace}</span></td>
        <td><span style="color:#94a3b8;">${item.marketplace_sku}</span></td>
        <td>
          <span style="font-weight:700; color:${(item.quantity > 1) ? '#f59e0b' : '#10b981'};">
            ${item.quantity}
          </span>
        </td>
        <td>
          <span style="text-transform:capitalize; font-weight:600; color:${getConditionColor(item.condition)};">
            ${formatConditionDisplay(item.condition)}
          </span>
        </td>
        <td>
          <span style="color:#10b981; font-weight:600;">✔ OK</span>
        </td>
      </tr>
    `).join('');

    // Attach thumbnail click handlers
    document.querySelectorAll('.thumb-img').forEach(img => {
      img.addEventListener('click', () => {
        openImageModal(img.dataset.img, img.dataset.sku);
      });
    });
  }

  function getConditionColor(cond) {
    const c = (cond || '').toLowerCase();
    if (c === 'good' || c === 'complete') return '#10b981';
    if (c === 'damaged' || c === 'wrong') return '#ef4444';
    if (c === 'repair') return '#f59e0b';
    if (c.includes('missing') || c.includes('mq') || c.includes('qt')) return '#a855f7';
    return '#38bdf8';
  }

  // Filter Buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderHistoryTable();
    });
  });

  // Copy for Excel (TSV format directly pasteable to Excel with Ctrl+V)
  if (el.btnCopyExcel) {
    el.btnCopyExcel.addEventListener('click', () => {
      if (todayScans.length === 0) {
        showNotification("No Scans to Copy", "Scan at least one parcel first.", "warning", 3000);
        return;
      }
      const headers = [
        "Date",
        "Scan Time",
        "PC Name",
        "OMS",
        "Return AWB Number",
        "Master SKU",
        "Marketplace SKU",
        "Marketplace",
        "Suborder Number",
        "Return Quantity",
        "Condition",
        "Status"
      ];
      const rows = todayScans.map(i => [
        i.date || getTodayDateString(),
        i.timestamp || '',
        i.pc_name || stationPcName || 'PC-1',
        i.oms_source || 'V2',
        i.awb || '',
        i.master_sku || '',
        i.marketplace_sku || '',
        i.marketplace || '',
        i.suborder_no || '',
        i.quantity || 1,
        i.condition || '',
        i.status || ''
      ].map(val => String(val || '').replace(/[\t\r\n]/g, ' ')).join("\t"));

      const tsv = [headers.join("\t"), ...rows].join("\r\n");

      navigator.clipboard.writeText(tsv).then(() => {
        showNotification(
          "Copied for Excel! 📋",
          `${todayScans.length} rows copied. Open Excel and press Ctrl + V!`,
          "success",
          3500
        );
      }).catch(err => {
        console.error("Clipboard copy failed:", err);
        showNotification("Copy Error", "Please allow clipboard permissions.", "error", 3000);
      });
    });
  }

  // Clear History
  el.btnClearHistory.addEventListener('click', () => {
    if (todayScans.length === 0) return;
    const confirmClear = confirm(`Are you sure you want to clear today's scan log (${todayScans.length} items)?\n\nPlease make sure you have downloaded the Excel file first!`);
    if (confirmClear) {
      todayScans = [];
      saveTodayScans();
      renderHistoryTable();
      updateStats();
      showToast("Today's scan log cleared.");
      focusInput();
    }
  });

  // Export Daily Excel Directly to Downloads Folder
  function exportTodayExcel(isAuto = false) {
    if (todayScans.length === 0) {
      if (!isAuto) showNotification("No Scans to Export", "No items have been scanned today yet.", "warning", 3000);
      return;
    }

    const headers = [
      "Date",
      "Scan Time",
      "PC Name",
      "OMS",
      "Return AWB Number",
      "Master SKU",
      "Marketplace SKU",
      "Marketplace",
      "Suborder Number",
      "Return Quantity",
      "Condition",
      "Status",
      "Image URL"
    ];

    const rows = todayScans.map(i => [
      `"${i.date || getTodayDateString()}"`,
      `"${i.timestamp || ''}"`,
      `"${i.pc_name || stationPcName || 'PC-1'}"`,
      `"${i.oms_source || 'V2'}"`,
      `"${i.awb || ''}"`,
      `"${(i.master_sku || '').replace(/"/g, '""')}"`,
      `"${(i.marketplace_sku || '').replace(/"/g, '""')}"`,
      `"${(i.marketplace || '').replace(/"/g, '""')}"`,
      `"${(i.suborder_no || '').replace(/"/g, '""')}"`,
      i.quantity || 1,
      `"${i.condition || ''}"`,
      `"${i.status || ''}"`,
      `"${i.image_url || ''}"`
    ]);

    // UTF-8 BOM so Excel opens special characters cleanly
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const filename = `Ugaan_Returns_${getTodayDateString()}.csv`;

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false // Directly saves to Downloads folder!
    }, (downloadId) => {
      if (downloadId) {
        showNotification("Excel File Downloaded", `Saved to Downloads folder: ${filename}`, "success", 3500);
      } else {
        console.warn("Download error or cancelled.");
      }
    });
  }

  if (el.btnDownloadExcel) {
    el.btnDownloadExcel.addEventListener('click', () => {
      exportTodayExcel(false);
    });
  }

  // Image Modal with Scroll Position Preservation & Body Lock
  let savedScrollY = 0;

  function openImageModal(imgSrc, sku) {
    savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    el.modalFullImg.src = imgSrc;
    el.modalSkuTitle.textContent = `Product Image - SKU: ${sku || ''}`;
    el.imageModal.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  function closeImageModal() {
    if (!el.imageModal) return;
    el.imageModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    if (el.awbInput) {
      el.awbInput.focus({ preventScroll: true });
    }
  }

  el.btnZoomImage.addEventListener('click', () => {
    if (el.productImg.src) {
      openImageModal(el.productImg.src, el.detMasterSku.textContent);
    }
  });

  el.productImg.addEventListener('click', () => {
    if (el.productImg.src) {
      openImageModal(el.productImg.src, el.detMasterSku.textContent);
    }
  });

  el.btnCloseModal.addEventListener('click', closeImageModal);

  el.imageModal.addEventListener('click', (e) => {
    if (e.target === el.imageModal) {
      closeImageModal();
    }
  });

  // ========================================================
  // Unified Settings Modal (⚙️) & Auto-Login Controller
  // ========================================================
  let savedSettingsScrollY = 0;

  function openSettingsModal(defaultTab = 'tab-login') {
    if (!el.settingsModal) return;
    savedSettingsScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    // Refresh credentials inputs
    if (el.v2EmailInput) el.v2EmailInput.value = v2LoginEmail || '';
    if (el.v2PasswordInput) el.v2PasswordInput.value = v2LoginPassword || '';
    if (el.v1EmailInput) el.v1EmailInput.value = v1LoginEmail || '';
    if (el.v1PasswordInput) el.v1PasswordInput.value = v1LoginPassword || '';
    if (el.toggleAutologin) el.toggleAutologin.checked = autoLoginEnabled;

    // Refresh station inputs
    if (el.sheetPcNameInput) el.sheetPcNameInput.value = stationPcName || 'PC-1';
    if (el.toggleAutosubmit) el.toggleAutosubmit.checked = autoSubmitEnabled;

    // Refresh sound slider
    if (el.volumeSlider) {
      const pct = Math.round(soundVolume * 100);
      el.volumeSlider.value = pct;
      if (el.volumeVal) el.volumeVal.textContent = formatVolumeLabel(pct);
    }

    // Refresh sheet inputs
    if (el.sheetUrlInput && sheetSyncUrl) el.sheetUrlInput.value = sheetSyncUrl;
    if (el.toggleSheetSync) el.toggleSheetSync.checked = sheetSyncEnabled;
    updateSheetSyncUI(sheetSyncEnabled && sheetSyncUrl ? 'connected' : 'offline');

    updateCredStatusBadge('v2', isV2LoggedIn);
    updateCredStatusBadge('v1', isV1LoggedIn);

    if (defaultTab) {
      switchSettingsTab(defaultTab);
    }

    el.settingsModal.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  function closeSettingsModal() {
    if (!el.settingsModal) return;
    el.settingsModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    window.scrollTo({ top: savedSettingsScrollY, behavior: 'instant' });
    if (el.awbInput) {
      el.awbInput.focus({ preventScroll: true });
    }
  }

  function switchSettingsTab(targetTabId) {
    if (el.settingsTabBtns) {
      el.settingsTabBtns.forEach(btn => {
        const isMatch = btn.dataset.tab === targetTabId;
        btn.classList.toggle('active', isMatch);
      });
    }
    if (el.settingsTabPanes) {
      el.settingsTabPanes.forEach(pane => {
        const isMatch = pane.id === targetTabId;
        pane.classList.toggle('active', isMatch);
        pane.style.display = isMatch ? 'flex' : 'none';
      });
    }
  }

  function updateCredStatusBadge(panel, status) {
    const badge = panel === 'v2' ? el.v2CredStatus : el.v1CredStatus;
    const timeHint = panel === 'v2' ? el.v2LastChecked : el.v1LastChecked;
    if (!badge) return;

    if (status === true || status === 'online') {
      badge.textContent = 'Active 🟢';
      badge.className = 'cred-status-pill online';
      if (timeHint) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        timeHint.textContent = `Verified ${timeStr}`;
      }
    } else if (status === false || status === 'offline') {
      badge.textContent = 'Logged Out 🔴';
      badge.className = 'cred-status-pill offline';
      if (timeHint) timeHint.textContent = '';
    } else if (status === 'testing') {
      badge.textContent = 'Testing... ⏳';
      badge.className = 'cred-status-pill checking';
    } else {
      badge.textContent = 'Checking...';
      badge.className = 'cred-status-pill';
    }
  }

  // Eye toggle for show/hide password
  document.querySelectorAll('.btn-toggle-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetInput = document.getElementById(targetId);
      if (!targetInput) return;
      if (targetInput.type === 'password') {
        targetInput.type = 'text';
        btn.textContent = '🙈';
        btn.title = 'Hide password';
      } else {
        targetInput.type = 'password';
        btn.textContent = '👁️';
        btn.title = 'Show password';
      }
    });
  });

  // Save V2 Credentials
  if (el.btnSaveV2Creds) {
    el.btnSaveV2Creds.addEventListener('click', () => {
      const email = (el.v2EmailInput ? el.v2EmailInput.value : '').trim();
      const password = (el.v2PasswordInput ? el.v2PasswordInput.value : '').trim();
      v2LoginEmail = email;
      v2LoginPassword = password;
      chrome.storage.local.set({
        v2_login_email: email,
        v2_login_password: password
      }, () => {
        if (!email && !password) {
          showNotification("V2 Credentials Cleared 🗑️", "V2 login details removed. Auto-login will not run for V2.", "info", 3000);
        } else {
          showNotification("V2 Credentials Saved 💾", "Email & password saved. Auto-login is ready for V2.", "success", 3000);
        }
      });
    });
  }

  // Save V1 Credentials
  if (el.btnSaveV1Creds) {
    el.btnSaveV1Creds.addEventListener('click', () => {
      const email = (el.v1EmailInput ? el.v1EmailInput.value : '').trim();
      const password = (el.v1PasswordInput ? el.v1PasswordInput.value : '').trim();
      v1LoginEmail = email;
      v1LoginPassword = password;
      chrome.storage.local.set({
        v1_login_email: email,
        v1_login_password: password
      }, () => {
        if (!email && !password) {
          showNotification("V1 Credentials Cleared 🗑️", "V1 login details removed. Auto-login will not run for V1.", "info", 3000);
        } else {
          showNotification("V1 Credentials Saved 💾", "Email & password saved. Auto-login is ready for V1.", "success", 3000);
        }
      });
    });
  }

  // Toggle Auto-Login
  if (el.toggleAutologin) {
    el.toggleAutologin.addEventListener('change', (e) => {
      autoLoginEnabled = e.target.checked;
      chrome.storage.local.set({ auto_login_enabled: autoLoginEnabled }, () => {
        showToast(autoLoginEnabled ? "Background Auto-Login ON ⚡" : "Background Auto-Login OFF ⚪");
      });
    });
  }

  // Toggle Floating Scan Widget
  if (el.toggleFloatingWidget) {
    el.toggleFloatingWidget.addEventListener('change', (e) => {
      floatingWidgetEnabled = e.target.checked;
      chrome.storage.local.set({ floating_widget_enabled: floatingWidgetEnabled }, () => {
        showToast(floatingWidgetEnabled ? "Floating Scan Button ON 🟢" : "Floating Scan Button OFF ⚪");
      });
    });
  }

  // Test V2 Login (with Auto-Save on Success)
  async function testV2Login() {
    const email = (el.v2EmailInput ? el.v2EmailInput.value : v2LoginEmail).trim();
    const password = (el.v2PasswordInput ? el.v2PasswordInput.value : v2LoginPassword).trim();
    if (!email || !password) {
      showNotification("Missing V2 Credentials ⚠️", "Please enter both Email and Password for V2.", "error", 4000);
      return;
    }

    updateCredStatusBadge('v2', 'testing');
    showToast("Testing V2 (my.elitesecom.ai) login...", "info");

    chrome.runtime.sendMessage({
      action: "login_oms_v2",
      email: email,
      password: password
    }, (res) => {
      if (chrome.runtime.lastError || !res) {
        fetch("https://my.elitesecom.ai/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ login: email, email: email, password: password })
        }).then(async (directRes) => {
          if (directRes.ok) {
            isV2LoggedIn = true;
            v2LoginEmail = email;
            v2LoginPassword = password;
            chrome.storage.local.set({
              v2_login_email: email,
              v2_login_password: password,
              v2_logged_in: true,
              oms_logged_in: true
            });
            updateCredStatusBadge('v2', true);
            updateOmsStatusPills();
            playSound('success');
            showNotification("V2 Login Verified & Saved! 🟢", "Connected to my.elitesecom.ai.", "success", 4000);
          } else {
            isV2LoggedIn = false;
            updateCredStatusBadge('v2', false);
            updateOmsStatusPills();
            showNotification("V2 Login Failed ❌", `HTTP ${directRes.status}: Check Email & Password.`, "error", 5000);
          }
        }).catch(err => {
          isV2LoggedIn = false;
          updateCredStatusBadge('v2', false);
          updateOmsStatusPills();
          showNotification("V2 Connection Error ❌", err.message, "error", 5000);
        });
        return;
      }

      if (res.success) {
        isV2LoggedIn = true;
        v2LoginEmail = email;
        v2LoginPassword = password;
        chrome.storage.local.set({
          v2_login_email: email,
          v2_login_password: password,
          v2_logged_in: true,
          oms_logged_in: true
        });
        updateCredStatusBadge('v2', true);
        updateOmsStatusPills();
        playSound('success');
        showNotification("V2 Login Verified & Saved! 🟢", "Connected to my.elitesecom.ai.", "success", 4000);
      } else {
        isV2LoggedIn = false;
        updateCredStatusBadge('v2', false);
        updateOmsStatusPills();
        showNotification("V2 Login Failed ❌", res.error || "Check your V2 credentials.", "error", 5000);
      }
    });
  }

  // Test V1 Login (with Auto-Save on Success)
  async function testV1Login() {
    const email = (el.v1EmailInput ? el.v1EmailInput.value : v1LoginEmail).trim();
    const password = (el.v1PasswordInput ? el.v1PasswordInput.value : v1LoginPassword).trim();
    if (!email || !password) {
      showNotification("Missing V1 Credentials ⚠️", "Please enter both Email and Password for V1.", "error", 4000);
      return;
    }

    updateCredStatusBadge('v1', 'testing');
    showToast("Testing V1 (oms.elitesecom.ai) login...", "info");

    chrome.runtime.sendMessage({
      action: "login_oms_v1",
      email: email,
      password: password
    }, (res) => {
      if (chrome.runtime.lastError || !res) {
        fetch("https://oms.elitesecom.ai/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: email, password: password })
        }).then(async (directRes) => {
          const dText = await directRes.text();
          let dJson = null;
          try { dJson = JSON.parse(dText); } catch (e) {}
          const isOk = directRes.ok && (!dJson || (!dJson.error && dJson.status_code !== 403 && dJson.status_code !== 401 && dJson.success !== false));
          if (isOk) {
            isV1LoggedIn = true;
            v1LoginEmail = email;
            v1LoginPassword = password;
            chrome.storage.local.set({
              v1_login_email: email,
              v1_login_password: password,
              v1_logged_in: true,
              oms_logged_in: true
            });
            updateCredStatusBadge('v1', true);
            updateOmsStatusPills();
            playSound('success');
            showNotification("V1 Login Verified & Saved! 🟢", "Connected to oms.elitesecom.ai.", "success", 4000);
          } else {
            isV1LoggedIn = false;
            updateCredStatusBadge('v1', false);
            updateOmsStatusPills();
            const errDetail = (dJson && (dJson.error || dJson.message)) || `HTTP ${directRes.status}: Check Email & Password.`;
            showNotification("V1 Login Failed ❌", errDetail, "error", 5000);
          }
        }).catch(err => {
          isV1LoggedIn = false;
          updateCredStatusBadge('v1', false);
          updateOmsStatusPills();
          showNotification("V1 Connection Error ❌", err.message, "error", 5000);
        });
        return;
      }

      if (res.success) {
        isV1LoggedIn = true;
        v1LoginEmail = email;
        v1LoginPassword = password;
        chrome.storage.local.set({
          v1_login_email: email,
          v1_login_password: password,
          v1_logged_in: true,
          oms_logged_in: true
        });
        updateCredStatusBadge('v1', true);
        updateOmsStatusPills();
        playSound('success');
        showNotification("V1 Login Verified & Saved! 🟢", "Connected to oms.elitesecom.ai.", "success", 4000);
      } else {
        isV1LoggedIn = false;
        updateCredStatusBadge('v1', false);
        updateOmsStatusPills();
        showNotification("V1 Login Failed ❌", res.error || "Check your V1 credentials.", "error", 5000);
      }
    });
  }

  // Enter key shortcuts on credential fields
  [el.v2EmailInput, el.v2PasswordInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          testV2Login();
        }
      });
    }
  });

  [el.v1EmailInput, el.v1PasswordInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          testV1Login();
        }
      });
    }
  });

  // Portal Quick Launch Links
  if (el.btnPortalV2) {
    el.btnPortalV2.addEventListener('click', () => {
      window.open('https://my.elitesecom.ai/scanorders/return-entry', '_blank');
    });
  }

  if (el.btnPortalV1) {
    el.btnPortalV1.addEventListener('click', () => {
      window.open('https://oms.elitesecom.ai/scanorders/return-entry', '_blank');
    });
  }

  // Automatic Background Re-Login Trigger
  async function attemptAutoLogin(panel = 'both') {
    if (!autoLoginEnabled || isAutoLoggingIn) return false;
    isAutoLoggingIn = true;

    try {
      const promises = [];

      if ((panel === 'both' || panel === 'v2') && v2LoginEmail && v2LoginPassword) {
        promises.push(new Promise(resolve => {
          chrome.runtime.sendMessage({
            action: 'login_oms_v2',
            email: v2LoginEmail,
            password: v2LoginPassword
          }, res => resolve({ panel: 'v2', success: Boolean(res && res.success) }));
        }));
      }

      if ((panel === 'both' || panel === 'v1') && v1LoginEmail && v1LoginPassword) {
        promises.push(new Promise(resolve => {
          chrome.runtime.sendMessage({
            action: 'login_oms_v1',
            email: v1LoginEmail,
            password: v1LoginPassword
          }, res => resolve({ panel: 'v1', success: Boolean(res && res.success) }));
        }));
      }

      if (promises.length === 0) {
        isAutoLoggingIn = false;
        return false;
      }

      const results = await Promise.all(promises);
      let anySuccess = false;
      results.forEach(r => {
        if (r.panel === 'v2' && r.success) {
          isV2LoggedIn = true;
          anySuccess = true;
        }
        if (r.panel === 'v1' && r.success) {
          isV1LoggedIn = true;
          anySuccess = true;
        }
      });

      updateOmsStatusPills();
      updateCredStatusBadge('v2', isV2LoggedIn);
      updateCredStatusBadge('v1', isV1LoggedIn);

      if (anySuccess) {
        handleOmsLoggedIn();
      }
      return anySuccess;
    } catch (e) {
      console.warn('[Auto-Login] Error:', e);
      return false;
    } finally {
      isAutoLoggingIn = false;
    }
  }

  // Settings Modal Buttons & Tabs
  if (el.btnOpenSettings) {
    el.btnOpenSettings.addEventListener('click', () => {
      openSettingsModal();
    });
  }

  if (el.btnCloseSettingsModal) {
    el.btnCloseSettingsModal.addEventListener('click', closeSettingsModal);
  }

  if (el.settingsModal) {
    el.settingsModal.addEventListener('click', (e) => {
      if (e.target === el.settingsModal) {
        closeSettingsModal();
      }
    });
  }

  if (el.settingsTabBtns) {
    el.settingsTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        switchSettingsTab(btn.dataset.tab);
      });
    });
  }

  if (el.btnTestV2Login) {
    el.btnTestV2Login.addEventListener('click', testV2Login);
  }

  if (el.btnTestV1Login) {
    el.btnTestV1Login.addEventListener('click', testV1Login);
  }

  if (el.btnTestSound) {
    el.btnTestSound.addEventListener('click', () => {
      playSound('success');
    });
  }

  // OMS Search Priority Listeners (under Settings Modal tab-station)
  document.querySelectorAll('[data-oms-priority]').forEach(pill => {
    pill.addEventListener('click', () => {
      const priority = pill.getAttribute('data-oms-priority');
      omsPriority = priority;
      chrome.storage.local.set({ oms_priority: priority }, () => {
        updateOmsPriorityUI(priority);
        showToast(`Search Priority: ${priority === 'v1' ? 'V1 First (oms.elitesecom.ai)' : 'V2 First (my.elitesecom.ai)'}`);
      });
    });
  });

  // Web Widget Appearance Listeners (under Settings Modal tab-station)
  document.querySelectorAll('[data-widget-theme]').forEach(pill => {
    pill.addEventListener('click', () => {
      const theme = pill.getAttribute('data-widget-theme');
      chrome.storage.local.set({ es_preferred_theme: theme }, () => {
        updateWidgetPillsUI(theme, undefined);
        showToast(`Widget Theme: ${theme.toUpperCase()}`);
      });
    });
  });

  document.querySelectorAll('[data-widget-size]').forEach(pill => {
    pill.addEventListener('click', () => {
      const size = pill.getAttribute('data-widget-size');
      const px = size === 'small' ? 42 : (size === 'large' ? 74 : 58);
      chrome.storage.local.set({ es_fab_size: px }, () => {
        updateWidgetPillsUI(undefined, size);
        showToast(`Widget Size: ${size.toUpperCase()}`);
      });
    });
  });

  function openSheetSyncModal() {
    openSettingsModal('tab-sheet');
  }

  function closeSheetSyncModal() {
    closeSettingsModal();
  }

  // Save PC / Station Name
  if (el.btnSavePcName) {
    el.btnSavePcName.addEventListener('click', () => {
      const val = (el.sheetPcNameInput ? el.sheetPcNameInput.value : '').trim() || 'PC-1';
      stationPcName = val;
      chrome.storage.local.set({ station_pc_name: stationPcName }, () => {
        if (el.stationPcNameDisplay) el.stationPcNameDisplay.textContent = stationPcName;
        showNotification("PC Name Saved 🖥️", `Current Station PC is set to: "${stationPcName}"`, "success", 3000);
      });
    });
  }

  if (el.btnCloseSheetModal) {
    el.btnCloseSheetModal.addEventListener('click', closeSheetSyncModal);
  }

  if (el.sheetSyncModal) {
    el.sheetSyncModal.addEventListener('click', (e) => {
      if (e.target === el.sheetSyncModal) {
        closeSheetSyncModal();
      }
    });
  }

  // Save Google Sheet URL
  if (el.btnSaveSheetUrl) {
    el.btnSaveSheetUrl.addEventListener('click', () => {
      const check = validateSheetUrl(el.sheetUrlInput ? el.sheetUrlInput.value : '');
      if (!check.valid) {
        showNotification("Invalid Web App URL ⚠️", check.error, "error", 7000);
        return;
      }

      sheetSyncUrl = check.url;
      sheetSyncEnabled = true;
      chrome.storage.local.set({
        sheet_sync_url: sheetSyncUrl,
        sheet_sync_enabled: true
      }, () => {
        if (chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({
            sheet_sync_url: sheetSyncUrl,
            sheet_sync_enabled: true
          });
        }
        updateSheetSyncUI('connected');
        showNotification("Google Sheet URL Saved 🟢", "Auto-sync is active. Click 'Test Sync' to verify!", "success", 4500);
      });
    });
  }

  // Toggle Auto-Sync
  if (el.toggleSheetSync) {
    el.toggleSheetSync.addEventListener('change', (e) => {
      sheetSyncEnabled = e.target.checked;
      chrome.storage.local.set({ sheet_sync_enabled: sheetSyncEnabled }, () => {
        updateSheetSyncUI(sheetSyncEnabled && sheetSyncUrl ? 'connected' : 'offline');
        showToast(sheetSyncEnabled ? "Live Google Sheet Sync Enabled 🟢" : "Live Google Sheet Sync Paused ⚪");
      });
    });
  }

  // Test Send 1 Row
  if (el.btnTestSheetSync) {
    el.btnTestSheetSync.addEventListener('click', async () => {
      const check = validateSheetUrl(el.sheetUrlInput ? el.sheetUrlInput.value : sheetSyncUrl);
      if (!check.valid) {
        showNotification("Invalid Web App URL ⚠️", check.error, "error", 7000);
        return;
      }

      showToast("Sending test row to Google Sheet...", "info");
      const testItem = {
        date: getTodayDateString(),
        timestamp: new Date().toLocaleTimeString(),
        pc_name: stationPcName || 'PC-1',
        awb: "TEST-" + Math.floor(1000 + Math.random() * 9000),
        master_sku: "SAMPLE-SKU-TEST",
        marketplace_sku: "SAMPLE-SKU",
        marketplace: "Test_Live_Sync",
        suborder_no: "SUB-TEST-99",
        quantity: 1,
        condition: "Good",
        status: "Test Passed",
        image_url: "https://images.meesho.com/images/products/sample_preview.jpg"
      };

      updateSheetSyncUI('syncing');
      sendSheetPayload(check.url, testItem, (res) => {
        if (res && res.success) {
          updateSheetSyncUI('connected');
          showNotification(
            "Test Row Added Successfully! 🟢",
            "Open your Google Sheet now! A green test row has been appended.",
            "success",
            5500
          );
        } else {
          updateSheetSyncUI('error', res ? res.error : 'Connection failed');
          showNotification("Connection Test Failed ❌", res ? res.error : "Could not connect to Google Sheet.", "error", 7000);
        }
      });
    });
  }

  // Sync All Today Scans
  if (el.btnSyncAllToday) {
    el.btnSyncAllToday.addEventListener('click', async () => {
      const check = validateSheetUrl(el.sheetUrlInput ? el.sheetUrlInput.value : sheetSyncUrl);
      if (!check.valid) {
        showNotification("Invalid Web App URL ⚠️", check.error, "error", 7000);
        return;
      }
      if (todayScans.length === 0) {
        showNotification("No Scans to Sync", "No parcels scanned yet today.", "warning", 3000);
        return;
      }

      showToast(`Syncing ${todayScans.length} scans to Google Sheet...`, "info");
      updateSheetSyncUI('syncing');
      const preparedScans = todayScans.map(s => Object.assign({}, s, { pc_name: s.pc_name || stationPcName || 'PC-1' }));
      sendSheetPayload(check.url, preparedScans, (res) => {
        if (res && res.success) {
          updateSheetSyncUI('connected');
          showNotification(
            "All Scans Synced! 🚀",
            `${todayScans.length} scans have been added to your Google Sheet.`,
            "success",
            4500
          );
        } else {
          updateSheetSyncUI('error', res ? res.error : 'Sync failed');
          showNotification("Sync Failed ❌", res ? res.error : "Could not sync scans to Google Sheet.", "error", 7000);
        }
      });
    });
  }

  // Copy Script Code
  if (el.btnCopyScript) {
    el.btnCopyScript.addEventListener('click', () => {
      const code = el.scriptCodeBlock ? el.scriptCodeBlock.textContent : '';
      if (!code) return;
      navigator.clipboard.writeText(code).then(() => {
        const origText = el.btnCopyScript.textContent;
        el.btnCopyScript.textContent = "✔ Copied!";
        setTimeout(() => { el.btnCopyScript.textContent = origText; }, 2000);
        showNotification("Code Copied! 📋", "Now paste into Google Sheet Extensions > Apps Script.", "success", 3000);
      }).catch(err => {
        console.error("Copy script error:", err);
      });
    });
  }

  // ========================================================
  // Multi-PC Setup & Backup / Import Controller
  // ========================================================
  async function getFullSettingsPayload() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'v2_login_email', 'v2_login_password',
        'v1_login_email', 'v1_login_password',
        'auto_login_enabled', 'oms_priority',
        'station_pc_name', 'autoSubmitEnabled',
        'batchCondition', 'themeMode',
        'soundEnabled', 'soundVolume',
        'sheet_sync_url', 'sheet_sync_enabled',
        'es_preferred_theme', 'es_fab_size'
      ], (stored) => {
        stored = stored || {};
        const payload = {
          version: "1.0",
          app: "Ugaan Return Scan",
          exported_at: new Date().toISOString(),
          station_origin: stored.station_pc_name || stationPcName || 'PC-1',
          settings: {
            v2_login_email: stored.v2_login_email || v2LoginEmail || (el.v2EmailInput ? el.v2EmailInput.value.trim() : ''),
            v2_login_password: stored.v2_login_password || v2LoginPassword || (el.v2PasswordInput ? el.v2PasswordInput.value.trim() : ''),
            v1_login_email: stored.v1_login_email || v1LoginEmail || (el.v1EmailInput ? el.v1EmailInput.value.trim() : ''),
            v1_login_password: stored.v1_login_password || v1LoginPassword || (el.v1PasswordInput ? el.v1PasswordInput.value.trim() : ''),
            auto_login_enabled: stored.auto_login_enabled !== undefined ? stored.auto_login_enabled : autoLoginEnabled,
            oms_priority: stored.oms_priority || omsPriority || 'v2',
            autoSubmitEnabled: stored.autoSubmitEnabled !== undefined ? stored.autoSubmitEnabled : autoSubmitEnabled,
            batchCondition: stored.batchCondition || batchCondition || 'good',
            soundEnabled: stored.soundEnabled !== undefined ? stored.soundEnabled : soundEnabled,
            soundVolume: stored.soundVolume !== undefined ? stored.soundVolume : soundVolume,
            sheet_sync_url: stored.sheet_sync_url || sheetSyncUrl || (el.sheetUrlInput ? el.sheetUrlInput.value.trim() : ''),
            sheet_sync_enabled: stored.sheet_sync_enabled !== undefined ? stored.sheet_sync_enabled : sheetSyncEnabled,
            es_preferred_theme: stored.es_preferred_theme || 'emerald',
            es_fab_size: stored.es_fab_size || 58
          }
        };
        resolve(payload);
      });
    });
  }

  async function exportSettingsToFile() {
    try {
      const payload = await getFullSettingsPayload();
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const pcClean = (payload.station_origin || 'Station').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = getTodayDateString();
      a.href = url;
      a.download = `ugaan_scanner_settings_${pcClean}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      playSound('success');
      showNotification("Backup File Exported! 📥", `Saved to ${a.download}. You can import this file on PC-2!`, "success", 4500);
    } catch (err) {
      console.error("Export file error:", err);
      showNotification("Export Failed ❌", err.message, "error", 5000);
    }
  }

  async function copySettingsCodeToClipboard() {
    try {
      const payload = await getFullSettingsPayload();
      const jsonStr = JSON.stringify(payload);
      const base64Code = btoa(unescape(encodeURIComponent(jsonStr)));
      const formattedCode = `UGAAN-SETUP::${base64Code}`;

      await navigator.clipboard.writeText(formattedCode);
      if (el.btnCopySettingsCode) {
        const orig = el.btnCopySettingsCode.innerHTML;
        el.btnCopySettingsCode.innerHTML = "<span>✔ Code Copied!</span>";
        setTimeout(() => { el.btnCopySettingsCode.innerHTML = orig; }, 2500);
      }
      playSound('success');
      showNotification("Setup Code Copied! 📋", "Now paste this code into PC-2's Settings > Multi-PC tab.", "success", 4000);
    } catch (err) {
      console.error("Copy code error:", err);
      showNotification("Copy Failed ❌", err.message, "error", 4000);
    }
  }

  async function applyImportedSettings(rawContent) {
    try {
      if (!rawContent || !rawContent.trim()) {
        showNotification("Empty Input ⚠️", "Please select a backup file or paste setup code.", "warning", 3500);
        return;
      }

      let parsed;
      const trimmed = rawContent.trim();

      if (trimmed.startsWith("UGAAN-SETUP::")) {
        const b64 = trimmed.substring("UGAAN-SETUP::".length);
        const jsonStr = decodeURIComponent(escape(atob(b64)));
        parsed = JSON.parse(jsonStr);
      } else {
        parsed = JSON.parse(trimmed);
      }

      const s = parsed.settings || parsed;
      if (!s || (typeof s !== 'object')) {
        throw new Error("Invalid configuration format.");
      }

      // Prompt for this PC's station name
      let defaultNewPc = 'PC-2';
      if (parsed.station_origin && parsed.station_origin.toLowerCase().includes('pc-1')) {
        defaultNewPc = 'PC-2';
      } else if (stationPcName && stationPcName !== 'PC-1') {
        defaultNewPc = stationPcName;
      }

      const userPc = prompt(
        `Enter Device / Station Name for this PC:\n(e.g., PC-2, Station-B, Pack-Table-2)\n\nOrigin was: ${parsed.station_origin || 'PC-1'}`,
        defaultNewPc
      );

      const targetPcName = (userPc && userPc.trim()) ? userPc.trim() : (stationPcName || defaultNewPc);

      const updateObj = {
        station_pc_name: targetPcName
      };

      if (s.v2_login_email !== undefined) updateObj.v2_login_email = s.v2_login_email;
      if (s.v2_login_password !== undefined) updateObj.v2_login_password = s.v2_login_password;
      if (s.v1_login_email !== undefined) updateObj.v1_login_email = s.v1_login_email;
      if (s.v1_login_password !== undefined) updateObj.v1_login_password = s.v1_login_password;
      if (s.auto_login_enabled !== undefined) updateObj.auto_login_enabled = Boolean(s.auto_login_enabled);
      if (s.oms_priority !== undefined) updateObj.oms_priority = s.oms_priority;
      if (s.autoSubmitEnabled !== undefined) updateObj.autoSubmitEnabled = Boolean(s.autoSubmitEnabled);
      if (s.batchCondition !== undefined) updateObj.batchCondition = s.batchCondition;
      if (s.soundEnabled !== undefined) updateObj.soundEnabled = Boolean(s.soundEnabled);
      if (s.soundVolume !== undefined) updateObj.soundVolume = Number(s.soundVolume);
      if (s.sheet_sync_url !== undefined) updateObj.sheet_sync_url = s.sheet_sync_url;
      if (s.sheet_sync_enabled !== undefined) updateObj.sheet_sync_enabled = Boolean(s.sheet_sync_enabled);
      if (s.es_preferred_theme !== undefined) updateObj.es_preferred_theme = s.es_preferred_theme;
      if (s.es_fab_size !== undefined) updateObj.es_fab_size = Number(s.es_fab_size);

      chrome.storage.local.set(updateObj, () => {
        if (chrome.storage && chrome.storage.sync && s.sheet_sync_url) {
          chrome.storage.sync.set({
            sheet_sync_url: s.sheet_sync_url,
            sheet_sync_enabled: s.sheet_sync_enabled !== undefined ? s.sheet_sync_enabled : true
          });
        }

        stationPcName = targetPcName;
        if (el.sheetPcNameInput) el.sheetPcNameInput.value = targetPcName;
        if (el.stationPcNameDisplay) el.stationPcNameDisplay.textContent = targetPcName;

        if (s.v2_login_email !== undefined) {
          v2LoginEmail = s.v2_login_email;
          if (el.v2EmailInput) el.v2EmailInput.value = v2LoginEmail;
        }
        if (s.v2_login_password !== undefined) {
          v2LoginPassword = s.v2_login_password;
          if (el.v2PasswordInput) el.v2PasswordInput.value = v2LoginPassword;
        }
        if (s.v1_login_email !== undefined) {
          v1LoginEmail = s.v1_login_email;
          if (el.v1EmailInput) el.v1EmailInput.value = v1LoginEmail;
        }
        if (s.v1_login_password !== undefined) {
          v1LoginPassword = s.v1_login_password;
          if (el.v1PasswordInput) el.v1PasswordInput.value = v1LoginPassword;
        }
        if (s.auto_login_enabled !== undefined) {
          autoLoginEnabled = s.auto_login_enabled;
          if (el.toggleAutologin) el.toggleAutologin.checked = autoLoginEnabled;
        }
        if (s.oms_priority !== undefined) {
          omsPriority = s.oms_priority;
          updateOmsPriorityUI(omsPriority);
        }
        if (s.autoSubmitEnabled !== undefined) {
          autoSubmitEnabled = s.autoSubmitEnabled;
          if (el.toggleAutosubmit) el.toggleAutosubmit.checked = autoSubmitEnabled;
        }
        if (s.batchCondition !== undefined) {
          batchCondition = s.batchCondition;
          if (el.batchCondition) el.batchCondition.value = batchCondition;
          if (el.orderConditionSelect) el.orderConditionSelect.value = batchCondition;
          if (el.detailConditionTag) el.detailConditionTag.textContent = formatConditionDisplay(batchCondition).toUpperCase();
        }
        if (s.soundVolume !== undefined) {
          soundVolume = Number(s.soundVolume);
          const pct = Math.round(soundVolume * 100);
          if (el.volumeSlider) el.volumeSlider.value = pct;
          if (el.volumeVal) el.volumeVal.textContent = formatVolumeLabel(pct);
        }
        if (s.soundEnabled !== undefined) {
          soundEnabled = s.soundEnabled;
          const isAudible = soundEnabled && soundVolume > 0;
          if (el.soundIcon) el.soundIcon.textContent = isAudible ? '🔊' : '🔇';
          if (el.toggleSound) el.toggleSound.classList.toggle('active', isAudible);
          updateMasterGain();
        }
        if (s.sheet_sync_url !== undefined) {
          sheetSyncUrl = s.sheet_sync_url;
          if (el.sheetUrlInput) el.sheetUrlInput.value = sheetSyncUrl;
        }
        if (s.sheet_sync_enabled !== undefined) {
          sheetSyncEnabled = s.sheet_sync_enabled;
          if (el.toggleSheetSync) el.toggleSheetSync.checked = sheetSyncEnabled;
        }
        updateSheetSyncUI(sheetSyncEnabled && sheetSyncUrl ? 'connected' : 'offline');

        if (el.txtImportSettingsCode) el.txtImportSettingsCode.value = '';

        // Re-check OMS sessions so status badges update immediately
        checkOmsSession(true);

        playSound('success');
        showNotification(
          "Settings Restored! 🎉",
          `Station set to "${targetPcName}". All logins, search priority & Sheet sync are live!`,
          "success",
          6000
        );
      });
    } catch (err) {
      console.error("Import settings error:", err);
      showNotification("Import Failed ❌", `Could not read settings: ${err.message}`, "error", 6000);
    }
  }

  // Backup & Import Listeners
  if (el.btnExportSettingsFile) {
    el.btnExportSettingsFile.addEventListener('click', exportSettingsToFile);
  }

  if (el.btnCopySettingsCode) {
    el.btnCopySettingsCode.addEventListener('click', copySettingsCodeToClipboard);
  }

  if (el.btnTriggerImportFile && el.inputImportSettingsFile) {
    el.btnTriggerImportFile.addEventListener('click', () => {
      el.inputImportSettingsFile.value = '';
      el.inputImportSettingsFile.click();
    });

    el.inputImportSettingsFile.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        applyImportedSettings(ev.target.result);
      };
      reader.onerror = () => {
        showNotification("File Read Error ❌", "Could not read the selected backup file.", "error", 4000);
      };
      reader.readAsText(file);
    });
  }

  if (el.btnApplyPastedSettings) {
    el.btnApplyPastedSettings.addEventListener('click', () => {
      const code = el.txtImportSettingsCode ? el.txtImportSettingsCode.value : '';
      applyImportedSettings(code);
    });
  }

  // Reset Display
  function resetDisplay() {
    currentOrder = null;
    el.productImg.src = '';
    el.productImg.style.display = 'none';
    el.placeholderBox.style.display = 'flex';
    el.imageFooter.style.display = 'none';
    el.imageMarketplaceBadge.style.display = 'none';
    if (el.imageOmsBadge) el.imageOmsBadge.style.display = 'none';
    if (el.detailOmsTag) el.detailOmsTag.style.display = 'none';
    if (el.imageSameDayBadge) el.imageSameDayBadge.style.display = 'none';
    if (el.detailSameDayTag) el.detailSameDayTag.style.display = 'none';

    el.detMasterSku.textContent = '-';
    el.detAwb.textContent = '-';
    el.detQuantity.textContent = '-';
    el.detMarketplace.textContent = '-';
    el.detMarketSku.textContent = '-';
    el.detSuborder.textContent = '-';
    el.detStatus.textContent = '-';
    el.detType.textContent = '-';

    el.btnManualSubmit.disabled = true;
    el.btnManualSubmit.innerHTML = '<span>Submit (Enter)</span>';
    hideMultiQtyAlert();
    cancelTimers();
  }

  // Keyboard Global Shortcuts
  window.addEventListener('keydown', (e) => {
    // F2: Confirm submit multi-qty
    if (e.key === 'F2') {
      e.preventDefault();
      if (currentOrder) {
        submitReturnScan(currentOrder, el.orderConditionSelect.value || batchCondition);
      }
    }
    // F8: Download today's Excel
    else if (e.key === 'F8') {
      e.preventDefault();
      exportTodayExcel(false);
    }
    // Escape closes modal or cancels
    else if (e.key === 'Escape') {
      if (el.imageModal && el.imageModal.style.display === 'flex') {
        closeImageModal();
      } else if (el.settingsModal && el.settingsModal.style.display === 'flex') {
        closeSettingsModal();
      } else if (el.sheetSyncModal && el.sheetSyncModal.style.display === 'flex') {
        closeSheetSyncModal();
      } else {
        cancelCurrentAction();
      }
    }
  });

  // --- Zero-Click Background Auto-Update Listener ---
  let initialUpdateSignal = null;
  let isAutoUpdating = false;

  async function checkLocalUpdateSignal() {
    if (isAutoUpdating) return;
    try {
      const url = chrome.runtime.getURL('update_signal.txt?t=' + Date.now());
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const text = (await res.text()).trim();
      if (!text) return;

      if (initialUpdateSignal === null) {
        initialUpdateSignal = text;
        return;
      }

      // If update_signal.txt has changed on disk (pulled by auto-pull.bat)
      if (text !== initialUpdateSignal) {
        // Safe check: Only reload when operator is idle (not actively scanning or submitting a parcel)
        const isIdle = !isSubmitting && (!currentOrder) && (!el.awbInput || !el.awbInput.value.trim());
        if (!isIdle) return; // Will check again on next interval once idle

        isAutoUpdating = true;
        showNotification("⚡ New Update Installed!", "New version pulled from GitHub. Auto-reloading in 2 seconds...", "success", 3000);
        showToast("🚀 Zero-Click Auto-Update Applied!");

        setTimeout(() => {
          chrome.runtime.reload();
        }, 2200);
      }
    } catch (e) {}
  }

  // Check every 20 seconds, and whenever window regains focus
  setInterval(checkLocalUpdateSignal, 20000);
  window.addEventListener('focus', checkLocalUpdateSignal);

  // Start on load
  document.addEventListener('DOMContentLoaded', () => {
    init();
    checkLocalUpdateSignal();
  });

})();
