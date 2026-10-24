// popup.js - Unified Ugaan Hub (Return QC & VMS Pickup)

function getTodayReturnKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `elitesecom_returns_${year}_${month}_${day}`;
}

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

// =========================================================================
// Web Audio API Synthesizer with Extra Volume Booster & Tone Types
// =========================================================================
let audioCtx = null;
let masterGain = null;
let limiter = null;
let soundVolume = 1.0;
let soundEnabled = true;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      try {
        masterGain = audioCtx.createGain();
        const initialVol = (soundEnabled && soundVolume > 0) ? soundVolume : 0;
        masterGain.gain.setValueAtTime(initialVol, audioCtx.currentTime);

        limiter = audioCtx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-0.5, audioCtx.currentTime);
        limiter.knee.setValueAtTime(0, audioCtx.currentTime);
        limiter.ratio.setValueAtTime(20, audioCtx.currentTime);
        limiter.attack.setValueAtTime(0.001, audioCtx.currentTime);
        limiter.release.setValueAtTime(0.05, audioCtx.currentTime);

        masterGain.connect(limiter);
        limiter.connect(audioCtx.destination);
      } catch (e) {
        if (masterGain) masterGain.connect(audioCtx.destination);
      }
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function updateMasterGain() {
  if (audioCtx && masterGain) {
    const vol = (soundEnabled && soundVolume > 0) ? soundVolume : 0;
    masterGain.gain.setValueAtTime(vol, audioCtx.currentTime);
  }
}

function playSound(type) {
  if (!soundEnabled || soundVolume <= 0) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    updateMasterGain();
    const now = ctx.currentTime;

    function tone(freq, duration, wave = 'sine', delay = 0, vol = 1.0) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(vol, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
      osc.connect(gain);
      if (masterGain) gain.connect(masterGain);
      else gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + duration);
    }

    if (type === 'cancelled') {
      const freqs = [880, 520, 880, 520];
      const duration = 0.18;
      freqs.forEach((freq, idx) => {
        tone(freq, duration, 'sawtooth', idx * 0.2, 1.2);
      });
    } else if (type === 'success') {
      tone(784, 0.12, 'sine', 0, 0.95);
      tone(784 * 2, 0.08, 'triangle', 0, 0.35);
      tone(1046.5, 0.22, 'sine', 0.10, 1.0);
      tone(1046.5 * 2, 0.15, 'triangle', 0.10, 0.40);
    } else if (type === 'duplicate' || type === 'warning') {
      tone(520, 0.11, 'square', 0, 0.95);
      tone(520, 0.11, 'square', 0.15, 0.95);
    } else if (type === 'not_found') {
      tone(260, 0.22, 'sawtooth', 0, 1.0);
      tone(150, 0.38, 'sawtooth', 0.20, 1.0);
    } else {
      tone(180, 0.38, 'sawtooth', 0, 1.0);
    }
  } catch (e) {
    console.warn('Audio tone error:', e);
  }
}

// =========================================================================
// Initialization & Tab Controller
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const pillV2 = document.getElementById('pill-v2');
  const pillV1 = document.getElementById('pill-v1');
  const btnToggleTheme = document.getElementById('popup-toggle-theme');
  const themeIcon = document.getElementById('popup-theme-icon');
  const footerConnection = document.getElementById('footer-connection');

  // Live Update Notification Banner
  const updateBanner = document.getElementById('popup-update-banner');
  const reloadBtn = document.getElementById('popup-reload-btn');
  try {
    chrome.runtime.sendMessage({ action: "CHECK_UPDATE" }, (resp) => {
      if (chrome.runtime.lastError) return;
      if (resp && resp.updateAvailable && updateBanner) {
        updateBanner.style.display = "flex";
      } else if (updateBanner) {
        updateBanner.style.display = "none";
      }
    });

    if (reloadBtn) {
      reloadBtn.onclick = () => {
        reloadBtn.textContent = "Reloading...";
        try {
          chrome.runtime.sendMessage({ action: "RELOAD_EXTENSION" });
        } catch (e) {}
        setTimeout(() => window.close(), 300);
      };
    }
  } catch (e) {}

  // Volume Elements
  const volumeSlider = document.getElementById('volume-slider');
  const volumeVal = document.getElementById('volume-val');
  const btnTestSound = document.getElementById('btn-test-sound');

  // Return QC Elements
  const quickInput = document.getElementById('quick-awb-input');
  const quickBtn = document.getElementById('quick-scan-btn');
  const quickCondition = document.getElementById('quick-condition');
  const quickResult = document.getElementById('quick-result');
  const quickImg = document.getElementById('quick-img');
  const quickSku = document.getElementById('quick-sku');
  const quickSub = document.getElementById('quick-sub');
  const quickStatus = document.getElementById('quick-status');
  const openScannerBtn = document.getElementById('open-scanner-btn');
  const quickDownloadBtn = document.getElementById('quick-download-btn');
  const statDate = document.getElementById('stat-date');
  const statReturnTotal = document.getElementById('stat-return-total');
  const statReturnGood = document.getElementById('stat-return-good');
  const statReturnMulti = document.getElementById('stat-return-multi');
  const toggleWidget = document.getElementById('popup-toggle-widget');

  // Pickup Elements
  const selectPriority = document.getElementById('select-priority');
  const toggleSync = document.getElementById('toggle-sync');
  const statTotal = document.getElementById('stat-total');
  const statSuccess = document.getElementById('stat-success');
  const statCancelled = document.getElementById('stat-cancelled');
  const statFailed = document.getElementById('stat-failed');
  const btnDownloadCsv = document.getElementById('btn-download-csv');
  const testInput = document.getElementById('test-awb-input');
  const btnTestScan = document.getElementById('btn-test-scan');
  const testResultBox = document.getElementById('test-result-box');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // Settings Elements
  const toggleAutoLogin = document.getElementById('toggle-autologin');
  const v2Email = document.getElementById('v2-email');
  const v2Pass = document.getElementById('v2-pass');
  const btnTestV2Login = document.getElementById('btn-test-v2-login');
  const v2LoginMsg = document.getElementById('v2-login-msg');
  const v1Email = document.getElementById('v1-email');
  const v1Pass = document.getElementById('v1-pass');
  const btnTestV1Login = document.getElementById('btn-test-v1-login');
  const v1LoginMsg = document.getElementById('v1-login-msg');
  const inputCourier = document.getElementById('input-courier');
  const toggleSheetSync = document.getElementById('toggle-sheetsync');
  const inputSheetUrl = document.getElementById('input-sheet-url');
  const btnTestSheet = document.getElementById('btn-test-sheet');
  const sheetMsg = document.getElementById('sheet-msg');
  const btnCopyScriptCode = document.getElementById('btn-copy-script-code');
  const btnOpenSheets = document.getElementById('btn-open-sheets');
  const copyScriptMsg = document.getElementById('copy-script-msg');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Tab Navigation
  function switchTab(tabId) {
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });
    chrome.storage.local.set({ activePopupTab: tabId });
    if (tabId === 'tab-return' && quickInput) quickInput.focus();
    if (tabId === 'tab-pickup' && testInput) testInput.focus();
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  // Theme Manager
  let popupTheme = 'dark';
  function applyTheme(theme) {
    popupTheme = (theme === 'light') ? 'light' : 'dark';
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${popupTheme}`);
    if (themeIcon) themeIcon.textContent = popupTheme === 'light' ? '🌙' : '☀️';
  }

  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', () => {
      const next = popupTheme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      chrome.storage.local.set({ themeMode: next });
    });
  }

  // Volume Manager
  function updateVolumeUI(pct) {
    if (volumeSlider) volumeSlider.value = pct;
    if (volumeVal) volumeVal.textContent = pct > 100 ? `${pct}% ⚡` : `${pct}%`;
    soundVolume = pct / 100;
    soundEnabled = pct > 0;
    updateMasterGain();
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      updateVolumeUI(Number(volumeSlider.value));
    });
    volumeSlider.addEventListener('change', () => {
      const val = Number(volumeSlider.value);
      chrome.storage.local.set({ soundVolume: val, soundEnabled: val > 0 });
      playSound('success');
    });
  }

  if (btnTestSound) {
    btnTestSound.addEventListener('click', () => playSound('success'));
  }

  // Status Pill Updates
  function updatePillStatus(portal, isOnline) {
    const pill = portal === 'v2' ? pillV2 : pillV1;
    if (!pill) return;
    const pName = portal.toUpperCase();
    if (isOnline) {
      pill.className = 'status-pill online';
      pill.title = `${pName} Online 🟢 - Click to Open`;
      pill.innerHTML = `<span class="dot"></span> ${pName} 🟢`;
    } else {
      pill.className = 'status-pill offline';
      pill.title = `${pName} Logged Out 🔴 - Click to Open`;
      pill.innerHTML = `<span class="dot"></span> ${pName} 🔴`;
    }
  }

  function updateFooterStatus(v2Online, v1Online) {
    if (!footerConnection) return;
    const v2Text = v2Online ? 'V2: Online 🟢' : 'V2: Logged Out 🔴';
    const v1Text = v1Online ? 'V1: Online 🟢' : 'V1: Logged Out 🔴';
    footerConnection.textContent = `${v2Text} | ${v1Text}`;
    if (v2Online && v1Online) footerConnection.style.color = '#10b981';
    else if (v2Online || v1Online) footerConnection.style.color = '#f59e0b';
    else footerConnection.style.color = '#ef4444';
  }

  pillV2.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'OPEN_ELITE_TAB', panel: 'v2' }));
  pillV1.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'OPEN_ELITE_TAB', panel: 'v1' }));

  // Load Saved Data & Stats
  chrome.storage.local.get([
    'themeMode', 'activePopupTab', 'soundVolume', 'soundEnabled',
    'syncEnabled', 'omsPriority', 'oms_priority', 'courier',
    'autoLoginEnabled', 'auto_login_enabled',
    'v2LoginEmail', 'v2_login_email', 'v2LoginPassword', 'v2_login_password',
    'v1LoginEmail', 'v1_login_email', 'v1LoginPassword', 'v1_login_password',
    'sheetSyncEnabled', 'sheetUrl', 'sheet_sync_url', 'floating_widget_enabled',
    'v2_logged_in', 'v1_logged_in', 'todaySuccess', 'todayFailed', 'todayCancelled'
  ], (data) => {
    if (data.themeMode) applyTheme(data.themeMode);
    else applyTheme('dark');

    if (data.activePopupTab) switchTab(data.activePopupTab);

    let vol = data.soundVolume !== undefined ? Number(data.soundVolume) : 100;
    if (vol <= 1.5 && vol > 0) vol = Math.round(vol * 100);
    updateVolumeUI(vol);

    if (toggleSync) toggleSync.checked = data.syncEnabled !== false;
    if (selectPriority) selectPriority.value = data.omsPriority || (data.oms_priority === 'v1' ? 'auto_v1_first' : 'auto_v2_first');
    if (toggleWidget) toggleWidget.checked = data.floating_widget_enabled !== false;

    // Settings fields
    if (toggleAutoLogin) toggleAutoLogin.checked = data.autoLoginEnabled !== false && data.auto_login_enabled !== false;
    if (v2Email) v2Email.value = data.v2LoginEmail || data.v2_login_email || '';
    if (v2Pass) v2Pass.value = data.v2LoginPassword || data.v2_login_password || '';
    if (v1Email) v1Email.value = data.v1LoginEmail || data.v1_login_email || '';
    if (v1Pass) v1Pass.value = data.v1LoginPassword || data.v1_login_password || '';
    if (inputCourier) inputCourier.value = data.courier || 'all';
    if (toggleSheetSync) toggleSheetSync.checked = !!data.sheetSyncEnabled;
    if (inputSheetUrl) inputSheetUrl.value = data.sheetUrl || data.sheet_sync_url || '';

    // Pickup stats
    const s = data.todaySuccess || 0;
    const f = data.todayFailed || 0;
    const c = data.todayCancelled || 0;
    if (statSuccess) statSuccess.textContent = s;
    if (statFailed) statFailed.textContent = f;
    if (statCancelled) statCancelled.textContent = c;
    if (statTotal) statTotal.textContent = s + f + c;

    updatePillStatus('v2', !!data.v2_logged_in);
    updatePillStatus('v1', !!data.v1_logged_in);
    updateFooterStatus(!!data.v2_logged_in, !!data.v1_logged_in);
  });

  // Check Live Sessions
  chrome.runtime.sendMessage({ action: 'CHECK_CONNECTION' }, (res) => {
    if (res) {
      const v2On = !!res.v2_logged_in;
      const v1On = !!res.v1_logged_in;
      updatePillStatus('v2', v2On);
      updatePillStatus('v1', v1On);
      updateFooterStatus(v2On, v1On);
    }
  });

  // =========================================================================
  // TAB 1: RETURN QC (Ruten Scen Logic)
  // =========================================================================
  function updateReturnStats() {
    const todayKey = getTodayReturnKey();
    const d = new Date();
    if (statDate) statDate.textContent = d.toLocaleDateString('en-US');

    chrome.storage.local.get([todayKey, 'batchCondition'], (result) => {
      const items = result[todayKey] || [];
      const total = items.length;
      const good = items.filter(i => (i.condition || '').toLowerCase() === 'good').length;
      const multi = items.filter(i => (i.quantity || 1) > 1).length;

      if (statReturnTotal) statReturnTotal.textContent = total;
      if (statReturnGood) statReturnGood.textContent = good;
      if (statReturnMulti) statReturnMulti.textContent = multi;

      if (result.batchCondition && quickCondition) {
        quickCondition.value = result.batchCondition;
      }
    });
  }
  updateReturnStats();

  async function handleQuickReturnScan() {
    let rawAwb = (quickInput.value || '').trim().toUpperCase();
    rawAwb = rawAwb.replace(/^[(\s"'\[]+|[)\s"'\]]+$/g, '').trim();
    if (!rawAwb) return;
    quickInput.value = rawAwb;

    quickResult.style.display = 'flex';
    quickImg.style.display = 'none';
    quickSku.textContent = `AWB: ${rawAwb}`;
    quickSub.textContent = 'Searching OMS...';
    quickStatus.textContent = 'Searching...';
    quickStatus.className = 'quick-badge';

    const todayKey = getTodayReturnKey();

    chrome.storage.local.get([todayKey], (result) => {
      const items = result[todayKey] || [];
      const isDuplicate = items.some(i => (i.awb || '').toUpperCase() === rawAwb);

      if (isDuplicate) {
        playSound('duplicate');
        quickStatus.textContent = 'Already Scanned!';
        quickStatus.className = 'quick-badge duplicate';
        quickInput.value = '';
        quickInput.focus();
        return;
      }

      chrome.runtime.sendMessage({ action: 'get_return_order', awb: rawAwb }, (res) => {
        if (!res) {
          playSound('error');
          quickStatus.textContent = 'Network Error!';
          quickStatus.className = 'quick-badge error';
          quickInput.value = '';
          quickInput.focus();
          return;
        }

        if (res.sessionExpired) {
          updatePillStatus('v2', false);
          updatePillStatus('v1', false);
          playSound('error');
          quickStatus.textContent = 'Session Expired!';
          quickStatus.className = 'quick-badge error';
          quickSub.textContent = 'Please log in to OMS';
          quickInput.value = '';
          quickInput.focus();
          return;
        }

        if (!res.success || !res.return_orders || res.return_orders.length === 0) {
          playSound('not_found');
          quickStatus.textContent = 'Order Not Found!';
          quickStatus.className = 'quick-badge error';
          quickSub.textContent = res.message || 'Not found in V1 or V2';
          quickInput.value = '';
          quickInput.focus();
          return;
        }

        const order = res.return_orders[0];
        const omsTag = res.oms_source || res._oms_source || order.oms_source || 'V2';
        quickSku.textContent = `[${omsTag}] ${order.master_sku || order.marketplace_sku || rawAwb}`;
        quickSub.textContent = `${order.marketplace || 'Marketplace'} • Suborder: ${order.suborder_number || order.suborder_no || '-'}`;

        if (order.image_url) {
          quickImg.src = order.image_url;
          quickImg.style.display = 'block';
        }

        const qty = Number(order.return_quantity || order.quantity || 1);

        if (res.is_same_day_cancel && res.already_submitted) {
          playSound('success');
          quickStatus.textContent = `✔ [${omsTag}] Same-Day Cancel`;
          quickStatus.className = 'quick-badge success';

          const now = new Date();
          const scanItem = {
            id: order.id || Date.now(),
            timestamp: now.toLocaleTimeString(),
            date: getTodayDateString(),
            oms_source: omsTag,
            awb: rawAwb,
            master_sku: order.master_sku || 'Same Day Cancel',
            marketplace_sku: order.marketplace_sku || '-',
            marketplace: order.marketplace || '-',
            suborder_no: order.suborder_number || order.suborder_no || rawAwb,
            quantity: 1,
            condition: quickCondition.value || 'good',
            status: 'Submitted',
            is_same_day_cancel: true,
            image_url: order.image_url || ''
          };
          items.unshift(scanItem);
          chrome.storage.local.set({ [todayKey]: items }, updateReturnStats);
          quickInput.value = '';
          quickInput.focus();
          return;
        }

        if (qty > 1) {
          playSound('error');
          quickStatus.textContent = `Multi-Qty (${qty} pcs) - Open Station`;
          quickStatus.className = 'quick-badge duplicate';
          quickInput.value = '';
          quickInput.focus();
          return;
        }

        // Submit Return
        quickStatus.textContent = 'Submitting...';
        const cond = quickCondition.value || 'good';

        chrome.runtime.sendMessage({
          action: 'submit_return_scan',
          awb: rawAwb,
          condition: cond.toLowerCase(),
          oms_source: omsTag,
          _oms_source: omsTag,
          suborder_number: order.suborder_number || order.suborder_no,
          quantity: qty,
          fource: Boolean(order.fource || order.is_cancelled),
          is_cancelled: Boolean(order.is_cancelled)
        }, (subJson) => {
          if (!subJson) {
            playSound('error');
            quickStatus.textContent = 'Network Error!';
            quickStatus.className = 'quick-badge error';
            quickInput.value = '';
            quickInput.focus();
            return;
          }

          if (subJson.sessionExpired) {
            playSound('error');
            quickStatus.textContent = 'OMS Session Expired!';
            quickStatus.className = 'quick-badge error';
            quickInput.value = '';
            quickInput.focus();
            return;
          }

          if (subJson.success) {
            playSound('success');
            quickStatus.textContent = `✔ [${omsTag}] Submitted!`;
            quickStatus.className = 'quick-badge success';

            const now = new Date();
            const scanItem = {
              id: order.id || Date.now(),
              timestamp: now.toLocaleTimeString(),
              date: getTodayDateString(),
              oms_source: omsTag,
              awb: rawAwb,
              master_sku: order.master_sku || '-',
              marketplace_sku: order.marketplace_sku || '-',
              marketplace: order.marketplace || '-',
              suborder_no: order.suborder_number || order.suborder_no || '-',
              quantity: qty,
              condition: cond,
              status: 'Submitted',
              image_url: order.image_url || ''
            };
            items.unshift(scanItem);
            chrome.storage.local.set({ [todayKey]: items }, updateReturnStats);
            quickInput.value = '';
            quickInput.focus();
          } else {
            playSound('duplicate');
            const msg = (subJson && (subJson.message || subJson.msg || subJson.error)) || 'Submission Failed';
            quickStatus.textContent = msg;
            quickStatus.className = 'quick-badge duplicate';
            quickInput.value = '';
            quickInput.focus();
          }
        });
      });
    });
  }

  if (quickInput) {
    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleQuickReturnScan();
      }
    });
  }
  if (quickBtn) quickBtn.addEventListener('click', handleQuickReturnScan);

  if (openScannerBtn) {
    openScannerBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('scanner.html') });
      window.close();
    });
  }

  // Download Return CSV
  if (quickDownloadBtn) {
    quickDownloadBtn.addEventListener('click', () => {
      const todayKey = getTodayReturnKey();
      chrome.storage.local.get([todayKey], (result) => {
        const items = result[todayKey] || [];
        if (items.length === 0) {
          alert('No returns scanned today yet!');
          return;
        }

        const headers = ['Date', 'Scan Time', 'Return AWB', 'Master SKU', 'Marketplace SKU', 'Marketplace', 'Suborder No', 'Quantity', 'Condition', 'Status', 'Image URL'];
        const rows = items.map(i => [
          `"${i.date || getTodayDateString()}"`,
          `"${i.timestamp || ''}"`,
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

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const filename = `Ugaan_Returns_${getTodayDateString()}.csv`;

        chrome.downloads.download({ url, filename, saveAs: false });
      });
    });
  }

  // Floating Widget Toggle
  if (toggleWidget) {
    toggleWidget.addEventListener('change', (e) => {
      chrome.storage.local.set({ floating_widget_enabled: e.target.checked });
    });
  }

  // =========================================================================
  // TAB 2: VMS PICKUP (VMS-Sync Logic)
  // =========================================================================
  if (selectPriority) {
    selectPriority.addEventListener('change', () => {
      chrome.storage.local.set({ omsPriority: selectPriority.value, oms_priority: selectPriority.value.includes('v1') ? 'v1' : 'v2' });
    });
  }

  if (toggleSync) {
    toggleSync.addEventListener('change', () => {
      chrome.storage.local.set({ syncEnabled: toggleSync.checked });
    });
  }

  // Manual Test Pickup Scan
  function performTestPickupScan() {
    let awb = testInput.value.replace(/^[(\s]+|[)\s]+$/g, '').trim();
    if (!awb) {
      testInput.focus();
      return;
    }

    testResultBox.style.display = 'block';
    testResultBox.className = 'test-result';
    testResultBox.textContent = 'Scanning on OMS...';

    chrome.runtime.sendMessage({ action: 'SYNC_AWB_TO_ELITE', awb }, (res) => {
      if (!res) {
        testResultBox.className = 'test-result err';
        testResultBox.textContent = 'No response received.';
        playSound('error');
        return;
      }

      const omsTag = res.omsSource ? `[${res.omsSource}] ` : '';
      if (res.statusType === 'CANCELLED') {
        testResultBox.className = 'test-result err cancelled-box';
        testResultBox.innerHTML = `⛔ <strong>CANCELLED ORDER:</strong> ${omsTag}${res.message || 'Order is Cancelled! DO NOT PACK!'}`;
        playSound('cancelled');
      } else if (res.success) {
        testResultBox.className = 'test-result ok';
        testResultBox.textContent = `✅ ${omsTag}${res.message || 'Pickup OK'}`;
        playSound('success');
      } else if (res.statusType === 'ALREADY_SCANNED') {
        testResultBox.className = 'test-result warn';
        testResultBox.textContent = `⚠️ ${omsTag}${res.message || 'Already Scanned'}`;
        playSound('warning');
      } else {
        testResultBox.className = 'test-result err';
        testResultBox.textContent = `❌ ${omsTag}${res.message || 'Error'}`;
        playSound('error');
      }

      // Refresh pickup counters
      chrome.runtime.sendMessage({ action: 'GET_STATS' }, (data) => {
        if (data) {
          const s = data.todaySuccess || 0;
          const f = data.todayFailed || 0;
          const c = data.todayCancelled || 0;
          if (statSuccess) statSuccess.textContent = s;
          if (statFailed) statFailed.textContent = f;
          if (statCancelled) statCancelled.textContent = c;
          if (statTotal) statTotal.textContent = s + f + c;
        }
      });
    });
  }

  if (btnTestScan) btnTestScan.addEventListener('click', performTestPickupScan);
  if (testInput) {
    testInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performTestPickupScan();
    });
  }

  // Download Pickup CSV Report
  function formatSeconds(sec) {
    if (isNaN(sec) || sec < 0) return '-';
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ${s}s`;
  }

  function formatDurationHms(sec) {
    if (isNaN(sec) || sec < 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

  function generatePickupCsvReport(logs, todayDate) {
    const dateStr = todayDate || new Date().toISOString().slice(0, 10);
    if (!logs || logs.length === 0) {
      return { csvContent: '', filename: `VMS_OMS_Scans_${dateStr}.csv`, isEmpty: true };
    }

    let startTimestamp = Infinity;
    let endTimestamp = 0;
    let successCount = 0;
    let failedCount = 0;

    logs.forEach(log => {
      const sTime = log.startTimestamp || log.id || 0;
      const eTime = log.endTimestamp || sTime;
      if (sTime > 0 && sTime < startTimestamp) startTimestamp = sTime;
      if (eTime > endTimestamp) endTimestamp = eTime;
      if (log.success) successCount++;
      else failedCount++;
    });

    const batchStartTime = startTimestamp !== Infinity ? new Date(startTimestamp).toLocaleTimeString('en-IN', { hour12: true }) : '-';
    const batchEndTime = endTimestamp > 0 ? new Date(endTimestamp).toLocaleTimeString('en-IN', { hour12: true }) : '-';
    const totalDurationSec = (startTimestamp !== Infinity && endTimestamp >= startTimestamp) ? Math.round((endTimestamp - startTimestamp) / 1000) : 0;
    const totalDurationStr = formatDurationHms(totalDurationSec);

    let csv = '\uFEFF';
    csv += `"=== VMS TO OMS PACKING REPORT ===","","","","","","","",""\r\n`;
    csv += `"Date:","${dateStr}","","","","","","",""\r\n`;
    csv += `"Batch Start Time:","${batchStartTime}","","","","","","",""\r\n`;
    csv += `"Batch End Time:","${batchEndTime}","","","","","","",""\r\n`;
    csv += `"Total Working Duration:","${totalDurationStr}","","","","","","",""\r\n`;
    csv += `"Total Orders:","${logs.length}","Successful:","${successCount}","Failed:","${failedCount}","","",""\r\n`;
    csv += `"","","","","","","","",""\r\n`;
    csv += `"No","AWB Number","OMS Platform","Start Time","End Time","Duration","Video Upload","Status","Message"\r\n`;

    logs.forEach((log, index) => {
      const no = logs.length - index;
      const row = [
        no,
        `"${log.awb || ''}"`,
        `"${log.omsSource || 'V2'}"`,
        `"${log.startTime || log.time || '-'}"`,
        `"${log.endTime || log.startTime || '-'}"`,
        `"${log.duration || (log.durationSec ? formatSeconds(log.durationSec) : '-')}"`,
        `"${log.videoStatus || 'DONE'}"`,
        `"${log.statusType || (log.success ? 'SUCCESS' : 'FAILED')}"`,
        `"${(log.message || '').replace(/"/g, '""')}"`
      ].join(',');
      csv += row + '\r\n';
    });

    return { csvContent: csv, filename: `VMS_OMS_Scans_${dateStr}.csv`, isEmpty: false };
  }

  if (btnDownloadCsv) {
    btnDownloadCsv.addEventListener('click', async () => {
      const data = await chrome.storage.local.get(['scanLogs', 'todayDate']);
      const logs = data.scanLogs || [];
      const report = generatePickupCsvReport(logs, data.todayDate);

      if (report.isEmpty) {
        alert("No pickup scan logs found for today.");
        return;
      }

      const blob = new Blob([report.csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = report.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', async () => {
      if (confirm("Reset today's pickup logs and counters?")) {
        await chrome.storage.local.set({ todaySuccess: 0, todayFailed: 0, todayCancelled: 0, scanLogs: [] });
        if (statSuccess) statSuccess.textContent = 0;
        if (statFailed) statFailed.textContent = 0;
        if (statCancelled) statCancelled.textContent = 0;
        if (statTotal) statTotal.textContent = 0;
        if (testResultBox) testResultBox.style.display = 'none';
        alert("Pickup logs reset.");
      }
    });
  }

  // =========================================================================
  // TAB 3: SETTINGS LOGIC
  // =========================================================================
  // Show / Hide Password
  document.querySelectorAll('.btn-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.textContent = input.type === 'password' ? '👁️' : '🙈';
      }
    });
  });

  // Test V2 Login
  if (btnTestV2Login) {
    btnTestV2Login.addEventListener('click', () => {
      const email = v2Email.value.trim();
      const pass = v2Pass.value.trim();
      if (!email || !pass) {
        v2LoginMsg.className = 'msg-hint error';
        v2LoginMsg.textContent = 'Enter V2 email & password.';
        return;
      }
      v2LoginMsg.className = 'msg-hint';
      v2LoginMsg.textContent = 'Testing V2 Login...';
      btnTestV2Login.disabled = true;

      chrome.runtime.sendMessage({ action: 'LOGIN_V2', email, password: pass }, async (res) => {
        btnTestV2Login.disabled = false;
        if (res && res.success) {
          await chrome.storage.local.set({
            v2LoginEmail: email,
            v2_login_email: email,
            v2LoginPassword: pass,
            v2_login_password: pass,
            autoLoginEnabled: true,
            auto_login_enabled: true,
            v2_logged_in: true
          });
          v2LoginMsg.className = 'msg-hint success';
          v2LoginMsg.textContent = '✅ V2 Login Success & Saved!';
          updatePillStatus('v2', true);
          playSound('success');
        } else {
          v2LoginMsg.className = 'msg-hint error';
          v2LoginMsg.textContent = `❌ ${(res && res.error) || 'Failed'}`;
          updatePillStatus('v2', false);
          playSound('error');
        }
      });
    });
  }

  // Test V1 Login
  if (btnTestV1Login) {
    btnTestV1Login.addEventListener('click', () => {
      const email = v1Email.value.trim();
      const pass = v1Pass.value.trim();
      if (!email || !pass) {
        v1LoginMsg.className = 'msg-hint error';
        v1LoginMsg.textContent = 'Enter V1 email & password.';
        return;
      }
      v1LoginMsg.className = 'msg-hint';
      v1LoginMsg.textContent = 'Testing V1 Login...';
      btnTestV1Login.disabled = true;

      chrome.runtime.sendMessage({ action: 'LOGIN_V1', email, password: pass }, async (res) => {
        btnTestV1Login.disabled = false;
        if (res && res.success) {
          await chrome.storage.local.set({
            v1LoginEmail: email,
            v1_login_email: email,
            v1LoginPassword: pass,
            v1_login_password: pass,
            autoLoginEnabled: true,
            auto_login_enabled: true,
            v1_logged_in: true
          });
          v1LoginMsg.className = 'msg-hint success';
          v1LoginMsg.textContent = '✅ V1 Login Success & Saved!';
          updatePillStatus('v1', true);
          playSound('success');
        } else {
          v1LoginMsg.className = 'msg-hint error';
          v1LoginMsg.textContent = `❌ ${(res && res.error) || 'Failed'}`;
          updatePillStatus('v1', false);
          playSound('error');
        }
      });
    });
  }

  // Google Sheets Apps Script Code Copy
  const GOOGLE_APPS_SCRIPT_CODE = `function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 
    result: "success", 
    status: "active", 
    message: "Ugaan VMS-Sync Google Sheet Webhook is ready!" 
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("Spreadsheet not linked! Please open your Google Sheet and go to Extensions > Apps Script.");
    }
    
    var sheet = ss.getActiveSheet();
    var defaultHeaders = ["Timestamp", "Date", "Time", "AWB Number", "OMS Platform", "Courier", "Status", "Message"];
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(defaultHeaders);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold").setBackground("#dcfce7");
    }

    var contents = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
    if (!contents) {
      return ContentService.createTextOutput(JSON.stringify({ result: "error", error: "No data received" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(contents);

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.date || "",
      data.time || "",
      data.awb || "",
      data.omsSource || data.oms_source || "V2",
      data.courier || "all",
      data.statusType || (data.success ? "SUCCESS" : "ERROR"),
      data.message || ""
    ]);

    return ContentService.createTextOutput(JSON.stringify({ result: "success", count: 1 }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  if (btnCopyScriptCode) {
    btnCopyScriptCode.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
        if (copyScriptMsg) {
          copyScriptMsg.className = 'msg-hint success';
          copyScriptMsg.textContent = '✅ Apps Script Code Copied! Paste (Ctrl+V) into Code.gs';
        }
        btnCopyScriptCode.textContent = '✅ Copied!';
        playSound('success');
        setTimeout(() => {
          btnCopyScriptCode.textContent = '📋 Copy Apps Script';
        }, 2500);
      } catch (err) {
        if (copyScriptMsg) {
          copyScriptMsg.className = 'msg-hint error';
          copyScriptMsg.textContent = 'Copy failed: ' + err.message;
        }
      }
    });
  }

  if (btnOpenSheets) {
    btnOpenSheets.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://sheets.new' });
    });
  }

  // Test Sheet Connection
  if (btnTestSheet) {
    btnTestSheet.addEventListener('click', () => {
      const url = inputSheetUrl.value.trim();
      if (!url) {
        sheetMsg.className = 'msg-hint error';
        sheetMsg.textContent = 'Enter Web App URL.';
        return;
      }
      sheetMsg.className = 'msg-hint';
      sheetMsg.textContent = 'Sending test row...';
      btnTestSheet.disabled = true;

      chrome.runtime.sendMessage({ action: 'TEST_SHEET_SYNC', url }, (res) => {
        btnTestSheet.disabled = false;
        if (res && res.success) {
          sheetMsg.className = 'msg-hint success';
          sheetMsg.textContent = '✅ Google Sheet Connected successfully!';
          playSound('success');
        } else {
          sheetMsg.className = 'msg-hint error';
          sheetMsg.textContent = `❌ ${(res && res.error) || 'Failed'}`;
          playSound('error');
        }
      });
    });
  }

  // Save All Settings
  
  // Manual Update Checker
  const btnManualCheckUpdate = document.getElementById('btn-manual-check-update');
  const btnManualReloadExt = document.getElementById('btn-manual-reload-ext');
  const manualUpdateMsg = document.getElementById('manual-update-msg');

  if (btnManualCheckUpdate) {
    btnManualCheckUpdate.addEventListener('click', async () => {
      btnManualCheckUpdate.disabled = true;
      btnManualCheckUpdate.textContent = '⏳ Checking...';
      if (manualUpdateMsg) {
        manualUpdateMsg.style.display = 'block';
        manualUpdateMsg.style.color = '#3b82f6';
        manualUpdateMsg.textContent = 'Checking GitHub for latest version...';
      }

      try {
        let localSignal = "";
        try {
          const lRes = await fetch(chrome.runtime.getURL('update_signal.txt?t=' + Date.now()), { cache: 'no-store' });
          if (lRes.ok) localSignal = (await lRes.text()).trim();
        } catch (_) {}

        const gitRes = await fetch('https://raw.githubusercontent.com/UGAAN/Ruten-Scen-New/main/update_signal.txt?t=' + Date.now(), { cache: 'no-store' });
        if (!gitRes.ok) throw new Error("Could not reach GitHub");
        const gitSignal = (await gitRes.text()).trim();

        if (gitSignal && localSignal && gitSignal !== localSignal) {
          if (manualUpdateMsg) {
            manualUpdateMsg.style.color = '#059669';
            manualUpdateMsg.textContent = '🚀 New update available on GitHub!';
          }
          if (btnManualReloadExt) btnManualReloadExt.style.display = 'inline-block';
        } else {
          if (manualUpdateMsg) {
            manualUpdateMsg.style.color = '#059669';
            manualUpdateMsg.textContent = '✅ You are running the latest version (v2.0.3)!';
          }
        }
      } catch (err) {
        if (manualUpdateMsg) {
          manualUpdateMsg.style.color = '#dc2626';
          manualUpdateMsg.textContent = '⚠️ Check failed: ' + (err.message || 'Network error');
        }
      } finally {
        btnManualCheckUpdate.disabled = false;
        btnManualCheckUpdate.textContent = '🔍 Check for Updates';
      }
    });
  }

  if (btnManualReloadExt) {
    btnManualReloadExt.addEventListener('click', () => {
      btnManualReloadExt.textContent = 'Reloading...';
      try {
        chrome.runtime.sendMessage({ action: 'RELOAD_EXTENSION' });
      } catch (_) {}
      setTimeout(() => window.close(), 300);
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const courier = inputCourier.value.trim() || 'all';
      const autoLogin = toggleAutoLogin.checked;
      const v2_e = v2Email.value.trim();
      const v2_p = v2Pass.value.trim();
      const v1_e = v1Email.value.trim();
      const v1_p = v1Pass.value.trim();
      const sheetSync = toggleSheetSync.checked;
      const sheetUrl = inputSheetUrl.value.trim();
      const priority = selectPriority ? selectPriority.value : 'auto_v2_first';

      await chrome.storage.local.set({
        courier,
        autoLoginEnabled: autoLogin,
        auto_login_enabled: autoLogin,
        v2LoginEmail: v2_e,
        v2_login_email: v2_e,
        v2LoginPassword: v2_p,
        v2_login_password: v2_p,
        v1LoginEmail: v1_e,
        v1_login_email: v1_e,
        v1LoginPassword: v1_p,
        v1_login_password: v1_p,
        sheetSyncEnabled: sheetSync,
        sheetUrl: sheetUrl,
        sheet_sync_url: sheetUrl,
        omsPriority: priority,
        oms_priority: priority.includes('v1') ? 'v1' : 'v2'
      });

      alert('✅ All Settings Saved Successfully!');
      playSound('success');
    });
  }
});
