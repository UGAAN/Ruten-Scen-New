// Ugaan Return Scan - Content Script
// Injected into marketplace pages (Meesho, OMS, Flipkart, Amazon)

(function () {
  // On Flipkart VMS packing station, vms_content.js runs the dedicated HUD and siren
  if (window.location && window.location.hostname && window.location.hostname.includes('fkvms.synlabs.io')) return;

  // Guard against multiple injections
  if (window.__UGAAN_WIDGET_INJECTED__) return;
  window.__UGAAN_WIDGET_INJECTED__ = true;

  // --- Date & Storage Keys ---
  function getTodayKey() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `elitesecom_returns_${year}_${month}_${day}`;
  }

  function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  }

  // --- Web Audio API Sound Synthesizer with Extra Volume Booster & Compressor ---
  let audioCtx = null;
  let compressor = null;
  let masterGain = null;
  let limiter = null;
  let soundVolume = 1.0;
  let soundEnabled = true;

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
          console.warn("Audio setup error", e);
          if (masterGain) masterGain.connect(audioCtx.destination);
        }
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!soundEnabled || soundVolume <= 0) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      updateMasterGain();

      function tone(freq, duration, wave = 'sine', delay = 0, vol = 1.0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
        osc.connect(gain);
        if (masterGain) {
          gain.connect(masterGain);
        } else {
          gain.connect(ctx.destination);
        }
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      }

      if (type === 'success') {
        tone(784, 0.12, 'sine', 0, 0.95);
        tone(784 * 2, 0.08, 'triangle', 0, 0.35);
        tone(1046.5, 0.22, 'sine', 0.10, 1.0);
        tone(1046.5 * 2, 0.15, 'triangle', 0.10, 0.40);
      } else if (type === 'duplicate') {
        tone(520, 0.11, 'square', 0, 0.95);
        tone(520, 0.11, 'square', 0.15, 0.95);
      } else if (type === 'not_found') {
        tone(260, 0.22, 'sawtooth', 0, 1.0);
        tone(150, 0.38, 'sawtooth', 0.20, 1.0);
      } else if (type === 'warning') {
        tone(620, 0.14, 'triangle', 0, 1.0);
        tone(620, 0.14, 'triangle', 0.16, 1.0);
        tone(880, 0.28, 'triangle', 0.32, 1.1);
      } else if (type === 'error') {
        tone(180, 0.38, 'sawtooth', 0, 1.0);
      }
    } catch (e) {
      console.warn('[Ugaan Return Scan Widget] Audio error:', e);
    }
  }

  // --- SVG Icons for Themes ---
  const THEME_ICONS = {
    emerald: `
      <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
        <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
        <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
        <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
        <path d="M9 12l2 2 4-4"></path>
      </svg>`,
    cyber: `
      <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4"></rect>
        <line x1="7" y1="8" x2="7" y2="16"></line>
        <line x1="11" y1="8" x2="11" y2="16"></line>
        <line x1="14" y1="8" x2="14" y2="16"></line>
        <line x1="17" y1="8" x2="17" y2="16"></line>
        <line x1="2" y1="12" x2="22" y2="12" stroke="#0ea5e9" stroke-dasharray="2 2"></line>
      </svg>`,
    amber: `
      <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>`
  };

  // --- Inject Widget HTML into DOM ---
  const widgetRoot = document.createElement('div');
  widgetRoot.id = 'es-widget-root';
  widgetRoot.innerHTML = `
    <!-- Floating Action Button -->
    <div id="es-fab-btn" class="theme-emerald" title="Open Ugaan Return Scan">
      <div class="es-fab-icon" id="es-fab-icon-container">
        ${THEME_ICONS.emerald}
      </div>
      <span id="es-fab-badge">0</span>
    </div>

    <!-- Slide-out Backdrop -->
    <div id="es-backdrop"></div>

    <!-- Slide-out Sidebar Panel -->
    <div id="es-side-panel">
      <!-- Header -->
      <div class="es-panel-header">
        <div class="es-brand-box">
          <span style="font-size: 20px;">⚡</span>
          <div>
            <div class="es-brand-title">Ugaan Return Scan</div>
            <span class="es-brand-sub">Return QC</span>
          </div>
        </div>
        <div class="es-header-actions">
          <button class="es-btn-icon" id="es-btn-toggle-settings" title="Settings (Style, Size, Volume)">⚙️</button>
          <button class="es-btn-icon" id="es-btn-open-full" title="Open Station">⤢</button>
          <button class="es-btn-icon" id="es-btn-close-panel" title="Close">✕</button>
        </div>
      </div>

      <!-- Collapsible Settings Drawer (Under ⚙️) -->
      <div id="es-settings-drawer" class="es-settings-drawer" style="display: none;">
        <!-- Theme Selector Bar -->
        <div class="es-theme-bar">
          <span class="es-theme-label">STYLE:</span>
          <div class="es-theme-pills">
            <button class="es-theme-pill active" data-theme="emerald">Emerald</button>
            <button class="es-theme-pill" data-theme="cyber">Cyber</button>
            <button class="es-theme-pill" data-theme="amber">Amber</button>
          </div>
        </div>

        <!-- Button Size Selector Bar -->
        <div class="es-theme-bar" style="background: #090e1a !important;">
          <span class="es-theme-label">SIZE:</span>
          <div class="es-theme-pills es-size-pills">
            <button class="es-size-pill" data-size="small">Small</button>
            <button class="es-size-pill active" data-size="medium">Medium</button>
            <button class="es-size-pill" data-size="large">Large</button>
          </div>
        </div>

        <!-- Volume Bar -->
        <div class="es-volume-bar" title="Volume">
          <div class="es-vol-left">
            <span id="es-sound-icon" title="Toggle Sound" style="cursor:pointer; font-size: 13px;">🔊</span>
            <span class="es-theme-label">VOLUME:</span>
          </div>
          <div class="es-vol-right">
            <input type="range" id="es-volume-slider" min="0" max="150" value="100" class="es-vol-slider" title="Volume">
            <span id="es-volume-val" class="es-vol-val">100%</span>
          </div>
        </div>

        <!-- Turn Off Floating Button Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 6px; margin-top: 6px;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #fca5a5;">Floating Button</div>
            <div style="font-size: 10px; color: #94a3b8;">Hide on webpages</div>
          </div>
          <button id="es-btn-hide-widget" style="background: #ef4444; color: #ffffff; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer;">Turn Off</button>
        </div>
      </div>

      <!-- Body Content -->
      <div class="es-panel-body">
        <!-- Return Condition Selection -->
        <div class="es-control-row">
          <div class="es-condition-group">
            <label class="es-field-label">CONDITION</label>
            <select class="es-select" id="es-condition-select">
              <option value="good" selected>Good</option>
              <option value="received">Received</option>
              <option value="repair">Repair</option>
              <option value="wrong">Wrong</option>
              <option value="damaged">Damaged</option>
              <option value="used">Used</option>
              <option value="non_barcode_rto">Non Barcode RTO</option>
              <option value="rto_wrong">RTO Wrong</option>
              <option value="missing_mq">Missing MQ</option>
              <option value="missing_qt" style="display:none;">Missing QT</option>
            </select>
          </div>
        </div>

        <!-- Scanner Barcode Input Card -->
        <div class="es-input-card">
          <label class="es-field-label">SCAN AWB</label>
          <div class="es-input-group">
            <input 
              type="text" 
              class="es-input" 
              id="es-awb-input" 
              placeholder="Scan AWB..." 
              autocomplete="off" 
              spellcheck="false"
            />
            <button class="es-btn-scan" id="es-btn-scan">SCAN</button>
          </div>
        </div>

        <!-- Result Card -->
        <div class="es-result-card" id="es-result-card" style="display: none;">
          <div class="es-result-top">
            <img class="es-result-img" id="es-result-img" src="" alt="Product Image" style="display: none;" />
            <div class="es-result-details">
              <div class="es-sku-title" id="es-sku-title">-</div>
              <div class="es-meta-tag" id="es-meta-marketplace">-</div>
              <div class="es-meta-tag" id="es-meta-suborder">-</div>
              <div class="es-qty-badge" id="es-qty-badge">Qty: 1</div>
            </div>
          </div>

          <!-- Status Banner -->
          <div class="es-status-banner" id="es-status-banner" style="display: none;"></div>

          <!-- Multi-Quantity Alert -->
          <div class="es-multi-alert" id="es-multi-alert" style="display: none;">
            <div class="es-multi-alert-title">Multi-Quantity Detected</div>
            <div style="font-size: 11px; color: #fde68a;">
              Order contains <span id="es-multi-qty-val">2</span> units. Verify before submitting.
            </div>
            <button class="es-btn-confirm-multi" id="es-btn-confirm-multi">
              Confirm & Submit (<span id="es-multi-btn-qty">2</span> units)
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="es-panel-footer">
        <div class="es-footer-stat" id="es-footer-stat">Today: 0 Scanned</div>
        <button class="es-btn-download" id="es-btn-download">
          <span>📥</span> Excel
        </button>
      </div>
    </div>
  `;

  // Safely attach to DOM regardless of document readiness or framework mounting
  function attachWidgetToDOM() {
    try {
      const target = document.body || document.documentElement;
      if (target) {
        if (!document.getElementById('es-widget-root')) {
          target.appendChild(widgetRoot);
        }
      } else {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', attachWidgetToDOM, { once: true });
        } else {
          setTimeout(attachWidgetToDOM, 50);
        }
      }
    } catch (e) {
      console.warn('[Ugaan Return Scan] DOM attach error:', e);
    }
  }

  attachWidgetToDOM();

  // --- Element References ---
  const fabBtn = document.getElementById('es-fab-btn');
  const fabIconContainer = document.getElementById('es-fab-icon-container');
  const fabBadge = document.getElementById('es-fab-badge');
  const backdrop = document.getElementById('es-backdrop');
  const sidePanel = document.getElementById('es-side-panel');
  const btnClose = document.getElementById('es-btn-close-panel');
  const btnOpenFull = document.getElementById('es-btn-open-full');
  const btnToggleSettings = document.getElementById('es-btn-toggle-settings');
  const settingsDrawer = document.getElementById('es-settings-drawer');
  const btnHideWidget = document.getElementById('es-btn-hide-widget');

  // --- Floating Widget Visibility State & Live Synchronization ---
  let isWidgetEnabled = true;

  function updateWidgetDisplay(enabled) {
    isWidgetEnabled = enabled;
    if (widgetRoot) {
      widgetRoot.style.display = enabled ? '' : 'none';
    }
  }

  // Initial read from storage
  chrome.storage.local.get(['floating_widget_enabled'], (res) => {
    const enabled = res.floating_widget_enabled !== undefined ? Boolean(res.floating_widget_enabled) : true;
    updateWidgetDisplay(enabled);
  });

  // Real-time synchronization across all tabs without page reload
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.floating_widget_enabled !== undefined) {
      updateWidgetDisplay(Boolean(changes.floating_widget_enabled.newValue));
    }
  });

  // Turn Off Button in Drawer
  if (btnHideWidget) {
    btnHideWidget.addEventListener('click', () => {
      chrome.storage.local.set({ floating_widget_enabled: false });
    });
  }

  // Right-click on FAB Button -> Quick Turn Off Shortcut
  if (fabBtn) {
    fabBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm("Turn OFF Floating Scan Button?\n\n(You can turn it back ON anytime by clicking the Ugaan Return Scan extension icon in your Chrome toolbar)")) {
        chrome.storage.local.set({ floating_widget_enabled: false });
      }
    });
  }

  if (btnToggleSettings && settingsDrawer) {
    btnToggleSettings.addEventListener('click', () => {
      const isHidden = settingsDrawer.style.display === 'none';
      settingsDrawer.style.display = isHidden ? 'block' : 'none';
      btnToggleSettings.classList.toggle('active', isHidden);
    });
  }
  const themePills = document.querySelectorAll('.es-theme-pill');
  const conditionSelect = document.getElementById('es-condition-select');
  const awbInput = document.getElementById('es-awb-input');
  const btnScan = document.getElementById('es-btn-scan');
  const resultCard = document.getElementById('es-result-card');
  const resultImg = document.getElementById('es-result-img');
  const skuTitle = document.getElementById('es-sku-title');
  const metaMarketplace = document.getElementById('es-meta-marketplace');
  const metaSuborder = document.getElementById('es-meta-suborder');
  const qtyBadge = document.getElementById('es-qty-badge');
  const statusBanner = document.getElementById('es-status-banner');
  const multiAlert = document.getElementById('es-multi-alert');
  const multiQtyVal = document.getElementById('es-multi-qty-val');
  const multiBtnQty = document.getElementById('es-multi-btn-qty');
  const btnConfirmMulti = document.getElementById('es-btn-confirm-multi');
  const footerStat = document.getElementById('es-footer-stat');
  const btnDownload = document.getElementById('es-btn-download');

  const esVolumeSlider = document.getElementById('es-volume-slider');
  const esVolumeVal = document.getElementById('es-volume-val');
  const esSoundIcon = document.getElementById('es-sound-icon');

  let currentPendingMultiOrder = null;

  // --- Theme Switching ---
  function applyTheme(themeName) {
    const validThemes = ['emerald', 'cyber', 'amber'];
    const theme = validThemes.includes(themeName) ? themeName : 'emerald';

    fabBtn.className = `theme-${theme}`;
    fabIconContainer.innerHTML = THEME_ICONS[theme] || THEME_ICONS.emerald;

    themePills.forEach(pill => {
      if (pill.getAttribute('data-theme') === theme) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    chrome.storage.local.set({ es_preferred_theme: theme });
  }

  themePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const theme = pill.getAttribute('data-theme');
      applyTheme(theme);
    });
  });

  // --- Button Size Switching (Small: 42px / Medium: 58px / Large: 74px & Wheel Resize) ---
  const sizePills = document.querySelectorAll('.es-size-pill');

  function applyFabSize(sizeVal) {
    let px = 58;
    let sizeName = 'medium';

    if (typeof sizeVal === 'string') {
      if (sizeVal === 'small') { px = 42; sizeName = 'small'; }
      else if (sizeVal === 'large') { px = 74; sizeName = 'large'; }
      else if (!isNaN(parseInt(sizeVal, 10))) { px = parseInt(sizeVal, 10); }
    } else if (typeof sizeVal === 'number') {
      px = sizeVal;
    }

    px = Math.max(36, Math.min(88, px));
    if (px <= 46) sizeName = 'small';
    else if (px >= 68) sizeName = 'large';
    else sizeName = 'medium';

    if (fabBtn) {
      fabBtn.style.setProperty('--fab-size', `${px}px`);
    }

    sizePills.forEach(pill => {
      if (pill.getAttribute('data-size') === sizeName) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    chrome.storage.local.set({ es_fab_size: px });
  }

  sizePills.forEach(pill => {
    pill.addEventListener('click', () => {
      applyFabSize(pill.getAttribute('data-size'));
    });
  });

  // Alt + Mouse Wheel on button to quickly resize smoothly!
  if (fabBtn) {
    fabBtn.addEventListener('wheel', (e) => {
      if (e.altKey || e.ctrlKey) {
        e.preventDefault();
        const currentPx = parseInt(fabBtn.style.getPropertyValue('--fab-size') || '58', 10);
        const delta = e.deltaY < 0 ? 4 : -4;
        const newPx = Math.max(36, Math.min(88, currentPx + delta));
        applyFabSize(newPx);
      }
    }, { passive: false });
  }

  // --- Volume UI & Sync ---
  function formatVolumeLabel(pct) {
    if (pct > 100) return `${pct}% ⚡`;
    return `${pct}%`;
  }

  let esLivePreviewTimer = null;

  function updateSidebarVolumeUI() {
    const pct = Math.round(soundVolume * 100);
    if (esVolumeSlider) esVolumeSlider.value = pct;
    if (esVolumeVal) esVolumeVal.textContent = formatVolumeLabel(pct);
    if (esSoundIcon) esSoundIcon.textContent = (soundEnabled && soundVolume > 0) ? '🔊' : '🔇';
    updateMasterGain();
  }

  if (esVolumeSlider) {
    esVolumeSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      soundVolume = val / 100;
      soundEnabled = val > 0;
      updateMasterGain();
      if (esVolumeVal) esVolumeVal.textContent = formatVolumeLabel(val);
      if (esSoundIcon) esSoundIcon.textContent = (soundEnabled && soundVolume > 0) ? '🔊' : '🔇';

      if (esLivePreviewTimer) clearTimeout(esLivePreviewTimer);
      if (soundEnabled && soundVolume > 0) {
        esLivePreviewTimer = setTimeout(() => {
          playSound('success');
        }, 130);
      }
    });

    esVolumeSlider.addEventListener('change', (e) => {
      const val = Number(e.target.value);
      soundVolume = val / 100;
      soundEnabled = val > 0;
      updateMasterGain();
      chrome.storage.local.set({ soundVolume, soundEnabled });
      if (soundEnabled && soundVolume > 0) playSound('success');
    });
  }

  if (esSoundIcon) {
    esSoundIcon.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (soundEnabled && soundVolume <= 0) soundVolume = 1.0;
      updateMasterGain();
      chrome.storage.local.set({ soundEnabled, soundVolume });
      updateSidebarVolumeUI();
      if (soundEnabled) playSound('success');
    });
  }

  // Restore saved theme, condition, position, size & volume
  chrome.storage.local.get(['es_preferred_theme', 'es_fab_size', 'batchCondition', 'es_fab_pos', 'soundVolume', 'soundEnabled'], (res) => {
    if (res.es_preferred_theme) {
      applyTheme(res.es_preferred_theme);
    }
    if (res.es_fab_size) {
      applyFabSize(res.es_fab_size);
    }
    if (res.batchCondition && conditionSelect) {
      conditionSelect.value = res.batchCondition;
    }
    if (res.soundVolume !== undefined) {
      soundVolume = Number(res.soundVolume);
      if (soundVolume > 1.5) soundVolume = soundVolume / 100;
    }
    if (res.soundEnabled !== undefined) {
      soundEnabled = res.soundEnabled;
    }
    updateSidebarVolumeUI();

    if (fabBtn && res.es_fab_pos && res.es_fab_pos.left && res.es_fab_pos.top) {
      const leftVal = parseInt(res.es_fab_pos.left, 10);
      const topVal = parseInt(res.es_fab_pos.top, 10);
      if (!isNaN(leftVal) && !isNaN(topVal) && leftVal >= 0 && leftVal < (window.innerWidth || 1920) && topVal >= 0 && topVal < (window.innerHeight || 1080)) {
        fabBtn.style.left = res.es_fab_pos.left;
        fabBtn.style.top = res.es_fab_pos.top;
        fabBtn.style.right = 'auto';
        fabBtn.style.bottom = 'auto';
      }
    }
  });

  // Listen for storage changes across tabs
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.es_fab_size !== undefined) {
        applyFabSize(changes.es_fab_size.newValue);
      }
      if (changes.es_preferred_theme) {
        applyTheme(changes.es_preferred_theme.newValue);
      }
      if (changes.soundVolume) {
        soundVolume = Number(changes.soundVolume.newValue);
        if (soundVolume > 1.5) soundVolume = soundVolume / 100;
      }
      if (changes.soundEnabled !== undefined) {
        soundEnabled = changes.soundEnabled.newValue;
      }
      updateSidebarVolumeUI();
    }
  });

  if (conditionSelect) {
    conditionSelect.addEventListener('change', () => {
      chrome.storage.local.set({ batchCondition: conditionSelect.value });
    });
  }

  // --- Panel Open / Close ---
  function openPanel() {
    sidePanel.classList.add('open');
    backdrop.classList.add('active');
    fabBtn.classList.add('hidden');
    setTimeout(() => awbInput.focus(), 250);
  }

  function closePanel() {
    sidePanel.classList.remove('open');
    backdrop.classList.remove('active');
    fabBtn.classList.remove('hidden');
  }

  btnClose.addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);

  btnOpenFull.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const scannerUrl = chrome.runtime.getURL('scanner.html');
    chrome.runtime.sendMessage({ action: 'open_scanner_tab' }, (res) => {
      if (chrome.runtime.lastError || !res) {
        window.open(scannerUrl, '_blank');
      }
    });
  });

  // --- Draggable FAB Button ---
  let isDragging = false;
  let dragMoved = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  fabBtn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only primary button
    isDragging = true;
    dragMoved = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = fabBtn.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.hypot(dx, dy) > 4) {
      dragMoved = true;
      let newLeft = origLeft + dx;
      let newTop = origTop + dy;

      // Keep within viewport boundaries
      newLeft = Math.max(10, Math.min(window.innerWidth - 68, newLeft));
      newTop = Math.max(10, Math.min(window.innerHeight - 68, newTop));

      fabBtn.style.left = `${newLeft}px`;
      fabBtn.style.top = `${newTop}px`;
      fabBtn.style.right = 'auto';
      fabBtn.style.bottom = 'auto';
    }
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    if (!dragMoved) {
      // It was a click, not a drag
      if (sidePanel.classList.contains('open')) {
        closePanel();
      } else {
        openPanel();
      }
    } else {
      // Save dragged position permanently
      chrome.storage.local.set({
        es_fab_pos: {
          left: fabBtn.style.left,
          top: fabBtn.style.top
        }
      });
    }
  }

  // --- Live Badge & Stats Update ---
  function updateTodayCount() {
    const todayKey = getTodayKey();
    chrome.storage.local.get([todayKey], (result) => {
      const items = result[todayKey] || [];
      const total = items.length;
      fabBadge.textContent = total;
      footerStat.textContent = `Today: ${total} Scanned`;
    });
  }

  updateTodayCount();

  // Listen for storage changes from scanner.html or popup.html
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      const todayKey = getTodayKey();
      if (changes[todayKey]) {
        updateTodayCount();
      }
      if (changes.batchCondition && conditionSelect) {
        conditionSelect.value = changes.batchCondition.newValue;
      }
      if (changes.es_preferred_theme) {
        applyTheme(changes.es_preferred_theme.newValue);
      }
    }
  });

  // --- Status Banner Helper ---
  function showStatus(text, type = 'info') {
    statusBanner.textContent = text;
    statusBanner.className = `es-status-banner show ${type}`;
  }

  // --- Quick Scan Logic ---
  async function handleScan() {
    let rawAwb = (awbInput.value || '').trim().toUpperCase();
    rawAwb = rawAwb.replace(/^[(\s"'\[]+|[)\s"'\]]+$/g, '').trim();
    if (!rawAwb) return;
    awbInput.value = rawAwb;

    // Reset view
    resultCard.style.display = 'flex';
    resultImg.classList.remove('show');
    multiAlert.classList.remove('show');
    currentPendingMultiOrder = null;

    skuTitle.textContent = `AWB: ${rawAwb}`;
    metaMarketplace.textContent = 'Searching OMS database...';
    metaSuborder.textContent = '';
    qtyBadge.textContent = '';
    showStatus('Fetching return data...', 'info');

    const todayKey = getTodayKey();

    // 1. Check Local Duplicate
    chrome.storage.local.get([todayKey], (res) => {
      const items = res[todayKey] || [];
      const existing = items.find(i => (i.awb || '').toLowerCase() === rawAwb.toLowerCase());

      if (existing) {
        playSound('duplicate');
        showStatus('⚠️ Order already qc passed', 'duplicate');
        skuTitle.textContent = existing.master_sku || rawAwb;
        metaMarketplace.textContent = `Marketplace: ${existing.marketplace || '-'}`;
        metaSuborder.textContent = `Scanned at ${existing.timestamp} | Condition: ${existing.condition || 'Good'}`;
        qtyBadge.textContent = `Quantity: ${existing.quantity || 1}`;

        const existingImg = existing.image_url || '';
        if (existingImg) {
          resultImg.src = existingImg;
          resultImg.classList.add('show');
        } else {
          // Quietly fetch order data to display the product image
          chrome.runtime.sendMessage({ action: 'get_return_order', awb: rawAwb }, (fetchRes) => {
            if (fetchRes && fetchRes.return_orders && fetchRes.return_orders[0]) {
              const ord = fetchRes.return_orders[0];
              const ordImg = ord.image_url || ord.product_image || (ord.images && ord.images[0]);
              if (ordImg) {
                resultImg.src = ordImg;
                resultImg.classList.add('show');
                existing.image_url = ordImg;
                chrome.storage.local.set({ [todayKey]: items });
              }
            }
          });
        }

        awbInput.value = '';
        awbInput.focus();
        return;
      }

      // 2. Fetch from EliteSECOM OMS via Background Service Worker (bypasses CORS on Meesho/Flipkart/Amazon)
      chrome.runtime.sendMessage({ action: 'get_return_order', awb: rawAwb }, async (data) => {
        if (!data) {
          playSound('error');
          showStatus('❌ Connection error or background script unreachable', 'error');
          awbInput.value = '';
          awbInput.focus();
          return;
        }

        if (data.sessionExpired) {
          playSound('error');
          showStatus('🔒 OMS Session Expired! Please log in to OMS', 'error');
          metaMarketplace.innerHTML = `<a href="https://my.elitesecom.ai/login" target="_blank" style="color: #38bdf8; text-decoration: underline; font-weight: bold;">🔑 Click to Open OMS Login Tab</a>`;
          return;
        }

        if (!data.success || !data.return_orders || data.return_orders.length === 0) {
          playSound('not_found');
          showStatus('❌ ORDER NOT FOUND in OMS! Verify barcode label', 'error');
          metaMarketplace.textContent = 'No matching return order found.';
          awbInput.value = '';
          awbInput.focus();
          return;
        }

        const order = data.return_orders[0];
        const qty = Number(order.return_quantity || order.suborder_item_quantity || 1);

        // Display Order Details
        skuTitle.textContent = order.master_sku || rawAwb;
        metaMarketplace.textContent = `Marketplace: ${order.marketplace || 'Direct'}`;
        metaSuborder.textContent = `Suborder: ${order.suborder_number || '-'}`;
        qtyBadge.textContent = `Quantity: ${qty}`;

        const imgUrl = order.image_url || order.product_image || (order.images && order.images[0]) || '';
        if (imgUrl) {
          resultImg.src = imgUrl;
          resultImg.classList.add('show');
        } else {
          resultImg.classList.remove('show');
        }

        // Check if already submitted via same-day cancel direct scan
        if (data.already_submitted) {
          playSound('success');
          const finalOms = order._oms_source || order.oms_source || 'V2';
          showStatus(`✔ SUBMITTED (SAME DAY CANCEL - ${finalOms})`, 'success');

          const todayKey = getTodayKey();
          chrome.storage.local.get([todayKey], (res) => {
            const items = res[todayKey] || [];
            const now = new Date();
            const scanItem = {
              id: order.id || Date.now(),
              timestamp: now.toLocaleTimeString(),
              date: getTodayDateString(),
              oms_source: finalOms,
              _oms_source: finalOms,
              awb: rawAwb,
              master_sku: order.master_sku || 'Same Day Cancel',
              marketplace_sku: order.marketplace_sku || '-',
              marketplace: order.marketplace || '-',
              suborder_no: order.suborder_number || rawAwb,
              quantity: 1,
              condition: conditionSelect.value || 'good',
              status: 'Submitted',
              return_type: 'Same Day Cancel',
              is_same_day_cancel: true,
              image_url: order.image_url || ''
            };
            items.unshift(scanItem);
            chrome.storage.local.set({ [todayKey]: items }, () => {
              updateTodayCount();
            });

            chrome.storage.local.get(['sheet_sync_url', 'sheet_sync_enabled', 'station_pc_name'], (sRes) => {
              if (sRes && sRes.sheet_sync_enabled && sRes.sheet_sync_url) {
                const sendItem = Object.assign({}, scanItem, {
                  pc_name: (sRes && sRes.station_pc_name) || 'PC-1'
                });
                chrome.runtime.sendMessage({
                  action: 'sync_to_google_sheet',
                  url: sRes.sheet_sync_url,
                  payload: sendItem
                });
              }
            });
          });

          awbInput.value = '';
          awbInput.focus();
          return;
        }

        // Check if already QC passed in OMS
        const isAlreadyQc = (order.return_status || '').toLowerCase().includes('qc');
        if (isAlreadyQc) {
          playSound('duplicate');
          showStatus('⚠️ Order already qc passed', 'duplicate');
          metaSuborder.textContent = `OMS Status: ${order.return_status || 'QC Passed'}`;
          awbInput.value = '';
          awbInput.focus();
          return;
        }

        // Multi-Quantity Check
        if (qty > 1) {
          playSound('error');
          multiQtyVal.textContent = qty;
          multiBtnQty.textContent = qty;
          multiAlert.classList.add('show');
          currentPendingMultiOrder = { order, rawAwb, qty };
          showStatus(`⚠️ MULTI-QTY ORDER (${qty} PIECES)! Manual verification required`, 'duplicate');
          return;
        }

        // Single Qty -> Instant Submit
        await submitReturn(order, rawAwb, qty);
      });
    });
  }

  // --- Submit Return API ---
  async function submitReturn(order, rawAwb, qty) {
    const cond = conditionSelect.value || 'good';
    showStatus(`Submitting as ${cond.toUpperCase()}...`, 'info');

    chrome.runtime.sendMessage(
      {
        action: 'submit_return_scan',
        awb: rawAwb,
        condition: cond.toLowerCase(),
        oms_source: order._oms_source || order.oms_source || 'V1',
        _oms_source: order._oms_source || order.oms_source || 'V1',
        suborder_number: order.suborder_number || order.suborder_no,
        quantity: qty,
        fource: Boolean(order.fource || order.is_cancelled),
        is_cancelled: Boolean(order.is_cancelled)
      },
      (subJson) => {
        if (!subJson) {
          playSound('error');
          showStatus('❌ Network error during submission', 'error');
          awbInput.value = '';
          awbInput.focus();
          return;
        }

        if (subJson.sessionExpired) {
          playSound('error');
          showStatus('🔒 OMS Session Expired! Please log in to OMS', 'error');
          return;
        }

        if (subJson.success) {
          playSound('success');
          const finalOms = order._oms_source || order.oms_source || 'V1';
          showStatus(`✔ QC PASSED & SUBMITTED (${finalOms})`, 'success');

          // Save to today's history
          const todayKey = getTodayKey();
          chrome.storage.local.get([todayKey], (res) => {
            const items = res[todayKey] || [];
            const now = new Date();
            const scanItem = {
              id: order.id || Date.now(),
              timestamp: now.toLocaleTimeString(),
              date: getTodayDateString(),
              oms_source: finalOms,
              _oms_source: finalOms,
              awb: rawAwb,
              master_sku: order.master_sku || '-',
              marketplace_sku: order.marketplace_sku || '-',
              marketplace: order.marketplace || '-',
              suborder_no: order.suborder_number || '-',
              quantity: qty,
              condition: cond,
              status: 'Submitted',
              image_url: order.image_url || ''
            };

            items.unshift(scanItem);
            chrome.storage.local.set({ [todayKey]: items }, () => {
              updateTodayCount();
            });

            // Live Auto-Sync to Google Sheet
            chrome.storage.local.get(['sheet_sync_url', 'sheet_sync_enabled', 'station_pc_name'], (sRes) => {
              if (sRes && sRes.sheet_sync_enabled && sRes.sheet_sync_url) {
                const sendItem = Object.assign({}, scanItem, {
                  pc_name: (sRes && sRes.station_pc_name) || 'PC-1'
                });
                chrome.runtime.sendMessage({
                  action: 'sync_to_google_sheet',
                  url: sRes.sheet_sync_url,
                  payload: sendItem
                });
              }
            });
          });

          // Clear input for next scan
          awbInput.value = '';
          awbInput.focus();

        } else {
          playSound('duplicate');
          const isQc = (order.return_status || '').toLowerCase().includes('qc');
          const msg = subJson.message || subJson.msg || subJson.error || (isQc ? 'Order already qc passed' : 'Submission Failed');
          showStatus(`⚠️ ${msg}`, 'duplicate');
          awbInput.value = '';
          awbInput.focus();
        }
      }
    );
  }

  // --- Confirm Multi-Qty Handler ---
  btnConfirmMulti.addEventListener('click', async () => {
    if (!currentPendingMultiOrder) return;
    const { order, rawAwb, qty } = currentPendingMultiOrder;
    multiAlert.classList.remove('show');
    await submitReturn(order, rawAwb, qty);
    currentPendingMultiOrder = null;
  });

  // --- Input Key Listeners ---
  awbInput.addEventListener('input', () => {
    const val = awbInput.value;
    const upper = val.toUpperCase();
    if (val !== upper) {
      const start = awbInput.selectionStart;
      const end = awbInput.selectionEnd;
      awbInput.value = upper;
      if (start !== null && end !== null) {
        try { awbInput.setSelectionRange(start, end); } catch (e) {}
      }
    }
  });

  awbInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  });

  btnScan.addEventListener('click', handleScan);

  // --- Export Excel directly from Page ---
  btnDownload.addEventListener('click', () => {
    const todayKey = getTodayKey();
    chrome.storage.local.get([todayKey], (result) => {
      const items = result[todayKey] || [];
      if (items.length === 0) {
        alert('No returns scanned today yet!');
        return;
      }

      const headers = [
        'Date',
        'Scan Time',
        'Return AWB',
        'Master SKU',
        'Marketplace SKU',
        'Marketplace',
        'Suborder No',
        'Quantity',
        'Condition',
        'Status',
        'Image URL'
      ];

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

      const a = document.createElement('a');
      a.href = url;
      a.download = `Ugaan_Returns_${getTodayDateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  // --- Ensure Widget ALWAYS Stays on Top of Any Other Extensions & Survives SPA Rerenders ---
  function keepOnTop() {
    if (!isWidgetEnabled) return;
    try {
      const target = document.body || document.documentElement;
      if (target && widgetRoot) {
        if (!document.getElementById('es-widget-root')) {
          target.appendChild(widgetRoot);
        } else if (target.lastElementChild !== widgetRoot) {
          target.appendChild(widgetRoot);
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // Periodic check & event triggers so other extensions/frameworks never cover or remove our scanner
  setInterval(keepOnTop, 1200);
  window.addEventListener('focus', keepOnTop);
  if (fabBtn) fabBtn.addEventListener('mouseenter', keepOnTop);
  if (sidePanel) sidePanel.addEventListener('mouseenter', keepOnTop);

  // MutationObserver immediately re-attaches widgetRoot if React/Vue/Angular rerenders the DOM
  try {
    const observer = new MutationObserver(() => {
      if (!isWidgetEnabled) return;
      const target = document.body || document.documentElement;
      if (target && widgetRoot && !document.getElementById('es-widget-root')) {
        target.appendChild(widgetRoot);
      }
    });
    observer.observe(document.documentElement || document.body, { childList: true, subtree: false });
  } catch (e) {}

  // --- Auto OMS Session Detection & Webpage Auto-Fill (Cross-Tab Live Broadcast) ---
  if (window.location.hostname.includes('elitesecom.ai')) {
    function isLoginPage() {
      const pathname = window.location.pathname.toLowerCase();
      if (pathname.includes('login') || pathname.includes('sign-in') || pathname.includes('signin') || pathname.includes('/auth')) {
        return true;
      }
      // Also check presence of login form in DOM
      if (document.querySelector('input[type="password"]') && (document.querySelector('input[type="email"]') || document.querySelector('input[name="login"]') || document.querySelector('input[name="email"]'))) {
        return true;
      }
      return false;
    }

    function reportOmsSessionStatus() {
      const isLogin = isLoginPage();
      const isV1 = window.location.hostname.startsWith('oms.');
      const panel = isV1 ? 'v1' : 'v2';
      const isLoggedIn = !isLogin;

      chrome.runtime.sendMessage({
        action: 'oms_auth_change',
        panel: panel,
        loggedIn: isLoggedIn
      }).catch(() => {});
    }

    reportOmsSessionStatus();

    // Helper to set input value compatible with React / Next.js / Vue / Vanilla
    function setSyntheticInputValue(input, val) {
      if (!input || input.value === val) return;
      try {
        const proto = Object.getPrototypeOf(input);
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set ||
                            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (valueSetter) {
          valueSetter.call(input, val);
        } else {
          input.value = val;
        }
      } catch (e) {
        input.value = val;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    let hasAutoSubmitted = false;

    // Auto-fill login credentials on Elite OMS web pages
    function tryAutoFillLoginPage() {
      if (!isLoginPage()) return;

      const isV1 = window.location.hostname.startsWith('oms.');

      chrome.storage.local.get([
        'v2_login_email',
        'v2LoginEmail',
        'v2_login_password',
        'v2LoginPassword',
        'v1_login_email',
        'v1LoginEmail',
        'v1_login_password',
        'v1LoginPassword',
        'auto_login_enabled',
        'autoLoginEnabled'
      ], (creds) => {
        // If user turned off auto login in settings, exit immediately
        if (creds.auto_login_enabled === false || creds.autoLoginEnabled === false) return;

        // Strictly get credentials only if saved in settings by the user
        const email = (isV1 
          ? (creds.v1_login_email || creds.v1LoginEmail || '') 
          : (creds.v2_login_email || creds.v2LoginEmail || '')).trim();
        const password = (isV1 
          ? (creds.v1_login_password || creds.v1LoginPassword || '') 
          : (creds.v2_login_password || creds.v2LoginPassword || '')).trim();

        // If user hasn't explicitly entered and saved credentials in settings, DO NOTHING
        if (!email || !password) return;

        const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="login"], input[id*="email" i], input[id*="login" i], input[placeholder*="email" i], input[placeholder*="user" i]');
        const passInput = document.querySelector('input[type="password"], input[name="password"], input[id*="password" i], input[placeholder*="password" i]');

        if (emailInput && (!emailInput.value || emailInput.value !== email)) {
          setSyntheticInputValue(emailInput, email);
        }

        if (passInput && (!passInput.value || passInput.value !== password)) {
          setSyntheticInputValue(passInput, password);
        }

        // Auto submit if credentials filled and not already submitted
        if (emailInput && passInput && emailInput.value === email && passInput.value === password && !hasAutoSubmitted) {
          hasAutoSubmitted = true;
          setTimeout(() => {
            const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]') ||
              Array.from(document.querySelectorAll('button')).find(b => {
                const text = (b.innerText || b.textContent || '').trim().toLowerCase();
                return text === 'log in' || text === 'login' || text === 'sign in' || text === 'signin' || text === 'submit';
              });
            if (submitBtn && !submitBtn.disabled) {
              console.log('⚡ [Auto-Login Content] Submitting login credentials automatically...');
              submitBtn.click();
            }
          }, 450);
        }
      });
    }

    // Try auto-fill immediately, after DOM ready, and with periodic polling for slow SPA hydration
    tryAutoFillLoginPage();
    setTimeout(tryAutoFillLoginPage, 400);
    setTimeout(tryAutoFillLoginPage, 1000);
    setTimeout(tryAutoFillLoginPage, 2000);

    // Watch for dynamic DOM changes (e.g. Next.js router transitions)
    const loginObserver = new MutationObserver(() => {
      if (isLoginPage() && !hasAutoSubmitted) {
        tryAutoFillLoginPage();
      }
    });
    loginObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });

    // Detect login form submissions
    document.addEventListener('submit', () => {
      setTimeout(reportOmsSessionStatus, 1200);
      setTimeout(reportOmsSessionStatus, 2500);
    });

    window.addEventListener('focus', () => {
      reportOmsSessionStatus();
      tryAutoFillLoginPage();
    });
  }

})();

