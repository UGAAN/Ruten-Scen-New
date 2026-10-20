/**
 * VMS-Sync: Content Script (v2.0.1)
 * Shows exact EliteSecom server messages with high-visibility badges:
 * [ ✅ DONE ], [ ⚠️ ALREADY SCANNED ], [ ⛔ CANCELLED ], [ ❌ NOT FOUND ]
 */

(function () {
  console.log("%c[VMS-Sync] Content script v1.0.5 active on Flipkart VMS", "color: #00C853; font-weight: bold;");

  let recentScansCache = new Map();
  let soundEnabled = true;
  let soundVolume = 100;
  let isMinimized = false;
  let hasActiveScanResult = false;

  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["soundEnabled", "soundVolume"], (data) => {
        if (data && data.soundEnabled !== undefined) {
          soundEnabled = !!data.soundEnabled;
          const sBtn = document.getElementById("vms-sync-sound-toggle");
          if (sBtn) {
            sBtn.textContent = soundEnabled ? "🔊" : "🔇";
            sBtn.title = soundEnabled ? "Sound ON (Click to Mute / Test)" : "Sound OFF (Click to Unmute)";
          }
        }
        if (data && data.soundVolume !== undefined) {
          const v = Number(data.soundVolume);
          soundVolume = (v <= 1.5 && v > 0) ? Math.round(v * 100) : v;
        }
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") {
          if (changes.soundVolume) {
            const v = Number(changes.soundVolume.newValue);
            soundVolume = (v <= 1.5 && v > 0) ? Math.round(v * 100) : v;
          }
          if (changes.soundEnabled) soundEnabled = !!changes.soundEnabled.newValue;
        }
      });
    }
  } catch (e) {}

  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    return audioCtx;
  }

  function unlockAudioContext() {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch (e) {}
  }
  window.addEventListener("click", unlockAudioContext, { capture: true, passive: true });
  window.addEventListener("keydown", unlockAudioContext, { capture: true, passive: true });
  window.addEventListener("mousedown", unlockAudioContext, { capture: true, passive: true });
  window.addEventListener("pointerdown", unlockAudioContext, { capture: true, passive: true });

  async function playSuccessSound() {
    if (!soundEnabled || soundVolume <= 0) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
      const volMul = Math.max(0, Math.min(1.5, soundVolume / 100));
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880.00, now + 0.08); // A5
      gain.gain.setValueAtTime(0.45 * volMul, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch (e) {
      console.warn("[VMS-Sync] Audio play error:", e);
    }
  }

  async function playWarningSound() {
    if (!soundEnabled || soundVolume <= 0) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
      const volMul = Math.max(0, Math.min(1.5, soundVolume / 100));
      const now = ctx.currentTime;
      // Double beep for warning / already scanned
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.45 * volMul, now);
      gain1.gain.linearRampToValueAtTime(0.001, now + 0.11);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(587.33, now + 0.15); // D5
      gain2.gain.setValueAtTime(0.45 * volMul, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.001, now + 0.27);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.29);
    } catch (e) {
      console.warn("[VMS-Sync] Warning audio error:", e);
    }
  }

  async function playAlertSound() {
    if (!soundEnabled || soundVolume <= 0) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
      const volMul = Math.max(0, Math.min(1.5, soundVolume / 100));
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.setValueAtTime(180, now + 0.14);
      gain.gain.setValueAtTime(0.5 * volMul, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch (e) {
      console.warn("[VMS-Sync] Alert audio error:", e);
    }
  }

  // Urgent Emergency Siren for CANCELLED orders (High-Low alternating pulses)
  async function playCancelledSirenSound() {
    if (!soundEnabled || soundVolume <= 0) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }
      const volMul = Math.max(0, Math.min(1.5, soundVolume / 100));
      const now = ctx.currentTime;
      const freqs = [880, 520, 880, 520];
      const duration = 0.18;

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + (idx * 0.2);
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.55 * volMul, start);
        gain.gain.linearRampToValueAtTime(0.01, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
      });
    } catch (e) {
      console.warn("[VMS-Sync] Cancelled siren audio error:", e);
    }
  }

  function isPackingScreenActive() {
    const hash = (window.location.hash || "").toLowerCase();
    const href = (window.location.href || "").toLowerCase();

    // 1. If on Login page or login URL
    if (hash.includes("login") || href.includes("/login")) {
      return false;
    }

    // If password input exists on screen (Login form)
    if (document.querySelector('input[type="password"]')) {
      return false;
    }

    // 2. If on "Connect to Feed" screen
    const feedInput = document.querySelector('input[placeholder*="Feed" i], input[placeholder*="feed" i]');
    if (feedInput) {
      return false;
    }

    // Check if "Connect to Feed" heading or text exists
    const bodyText = document.body ? (document.body.innerText || "") : "";
    if (bodyText.includes("Connect to Feed") || bodyText.includes("Scan the Feed Id on your Desk")) {
      return false;
    }

    // 3. Must be on operator/vms page
    if (!hash.includes("operator") && !hash.includes("vms") && !href.includes("operator/vms")) {
      return false;
    }

    return true;
  }

  function syncOverlayVisibility() {
    const shouldShow = isPackingScreenActive();
    const overlay = document.getElementById("vms-sync-overlay");

    if (!shouldShow) {
      if (overlay && overlay.style.display !== "none") {
        overlay.style.display = "none";
      }
      return;
    }

    if (!overlay) {
      createOverlay();
    } else if (overlay.style.display === "none") {
      overlay.style.display = "block";
    }
  }

  function createOverlay() {
    const existing = document.getElementById("vms-sync-overlay");
    if (existing) {
      existing.style.display = isPackingScreenActive() ? "block" : "none";
      return;
    }

    if (!document.body) return;

    const container = document.createElement("div");
    container.id = "vms-sync-overlay";
    container.style.display = isPackingScreenActive() ? "block" : "none";
    container.innerHTML = `
      <style>
        #vms-sync-overlay {
          position: fixed !important;
          top: 14px;
          right: 20px;
          z-index: 2147483647 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          user-select: none !important;
          -webkit-user-select: none !important;
          touch-action: none;
        }
        .vms-sync-card {
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.16);
          border: 1px solid #cbd5e1;
          padding: 4px 8px;
          color: #1e293b;
          cursor: grab;
          touch-action: none;
          box-sizing: border-box;
          max-width: 95vw;
        }
        .vms-sync-card:active {
          cursor: grabbing;
        }
        .vms-sync-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: grab;
        }
        .vms-sync-brand {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
          cursor: grab;
        }
        .vms-sync-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
          transition: all 0.3s ease;
        }
        .vms-sync-dot.connected {
          background-color: #10b981;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
          cursor: grab;
        }
        .vms-sync-dot.disconnected {
          background-color: #ef4444;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
          cursor: pointer !important;
          animation: vms-pulse 1.5s infinite;
        }
        @keyframes vms-pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.15); box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .vms-sync-title-text {
          font-weight: 700;
          font-size: 12px;
          color: #1e40af;
          letter-spacing: -0.2px;
          cursor: grab;
          white-space: nowrap;
        }
        .vms-sync-counter-badge {
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 8px;
          border: 1px solid #bfdbfe;
          cursor: grab;
        }
        .vms-sync-update-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: #ffffff !important;
          border: 1px solid #047857;
          border-radius: 10px;
          padding: 1px 7px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.3px;
          cursor: pointer !important;
          box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.4);
          animation: vms-update-pulse 1.4s infinite alternate;
          transition: transform 0.15s ease;
          white-space: nowrap;
        }
        .vms-sync-update-pill:hover {
          transform: scale(1.06);
          background: linear-gradient(135deg, #047857 0%, #059669 100%);
        }
        @keyframes vms-update-pulse {
          0% { box-shadow: 0 0 2px rgba(16, 185, 129, 0.4); }
          100% { box-shadow: 0 0 8px rgba(16, 185, 129, 0.9); }
        }
        .vms-sync-status-box {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-left: 3.5px solid #3b82f6;
          border-radius: 5px;
          padding: 2px 7px;
          cursor: grab;
          transition: background 0.2s, border-left-color 0.2s;
          white-space: nowrap;
        }
        .vms-sync-status-box.success {
          background: #ecfdf5;
          border-left-color: #10b981;
        }
        .vms-sync-status-box.warning {
          background: #fffbeb;
          border-left-color: #f59e0b;
        }
        .vms-sync-status-box.cancelled {
          background: #fef2f2 !important;
          border-left-color: #dc2626 !important;
          animation: vms-cancelled-pulse 0.7s infinite alternate !important;
        }
        .vms-sync-status-box.error {
          background: #fef2f2;
          border-left-color: #ef4444;
        }
        .vms-sync-badge-pill {
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.3px;
          cursor: grab;
          flex-shrink: 0;
        }
        .vms-sync-badge-pill.success { background: #059669; color: #fff; }
        .vms-sync-badge-pill.warning { background: #d97706; color: #fff; }
        .vms-sync-badge-pill.cancelled {
          background: #dc2626 !important;
          color: #fff !important;
          animation: vms-badge-pulse 0.7s infinite alternate !important;
        }
        .vms-sync-badge-pill.error { background: #dc2626; color: #fff; }
        .vms-sync-badge-pill.info { background: #2563eb; color: #fff; }

        @keyframes vms-cancelled-pulse {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6); }
          100% { box-shadow: 0 0 10px 3px rgba(220, 38, 38, 0.3); }
        }
        @keyframes vms-badge-pulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }

        .vms-sync-awb-num {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          cursor: grab;
          letter-spacing: 0.2px;
          white-space: nowrap;
        }
        .vms-sync-msg {
          font-size: 10px;
          font-weight: 600;
          color: #475569;
          cursor: grab;
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vms-sync-controls {
          display: flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
          cursor: default;
        }
        .vms-sync-portal-chips {
          display: flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
        }
        .vms-sync-portal-chip {
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-size: 9.5px;
          font-weight: 800;
          padding: 1px 5px;
          line-height: 1.2;
          cursor: pointer !important;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }
        .vms-sync-portal-chip.online {
          background: #ecfdf5;
          color: #065f46;
          border-color: #a7f3d0;
        }
        .vms-sync-portal-chip.offline {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
          animation: vms-chip-blink 1.5s infinite alternate;
        }
        @keyframes vms-chip-blink {
          0% { opacity: 0.8; }
          100% { opacity: 1; box-shadow: 0 0 4px rgba(239, 68, 68, 0.4); }
        }
        .vms-sync-btn-icon {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer !important;
          font-size: 11px;
          padding: 2px 4px;
          line-height: 1;
          color: #475569;
          transition: all 0.15s;
        }
        .vms-sync-btn-icon:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .vms-sync-login-btn {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #dc2626;
          color: #ffffff;
          border: none;
          border-radius: 3px;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer !important;
        }
        .vms-sync-login-btn:hover {
          background: #b91c1c;
        }
        .vms-sync-card.minimized {
          padding: 3px 6px;
        }
        .vms-sync-card.minimized .vms-sync-status-box,
        .vms-sync-card.minimized #vms-sync-inline-settings,
        .vms-sync-card.minimized #vms-sync-csv-btn,
        .vms-sync-card.minimized #vms-sync-settings-btn,
        .vms-sync-card.minimized #vms-sync-sound-toggle {
          display: none !important;
        }
        #vms-sync-inline-settings {
          cursor: default;
        }
        #vms-sync-inline-settings input {
          cursor: text !important;
        }
        #vms-sync-inline-settings button,
        #vms-sync-retry-btn {
          cursor: pointer !important;
        }
      </style>
      <div class="vms-sync-card" id="vms-sync-box">
        <div class="vms-sync-bar">
          <div class="vms-sync-brand">
            <span id="vms-sync-conn-dot" class="vms-sync-dot connected" title="EliteSecom Connected 🟢"></span>
            <span class="vms-sync-title-text">VMS-Sync</span>
            <span class="vms-sync-counter-badge" id="vms-sync-counter" title="Today's Successfully Synced Orders">0</span>
          </div>
          <button id="vms-sync-update-btn" class="vms-sync-update-pill" style="display: none;" title="New Update Pulled from GitHub! Click to 1-Click Reload Extension & Page">
            <span>🚀 UPDATE READY</span>
          </button>
          <div class="vms-sync-portal-chips" id="vms-sync-portal-chips-container">
            <button id="vms-sync-v2-chip" class="vms-sync-portal-chip offline" style="display: none;" title="V2 Logged Out! Click to Login">V2: 🔴 Login</button>
            <button id="vms-sync-v1-chip" class="vms-sync-portal-chip offline" style="display: none;" title="V1 Logged Out! Click to Login">V1: 🔴 Login</button>
          </div>
          <div class="vms-sync-status-box" id="vms-sync-status-container">
            <span class="vms-sync-badge-pill info" id="vms-sync-state-badge" style="display: none;">READY</span>
            <span class="vms-sync-awb-num" id="vms-sync-awb-text">Ready to Scan</span>
            <span class="vms-sync-msg" id="vms-sync-msg-text" style="display: none;"></span>
          </div>
          <div class="vms-sync-controls">
            <button class="vms-sync-btn-icon" id="vms-sync-csv-btn" title="Download Excel">📥</button>
            <button class="vms-sync-btn-icon" id="vms-sync-settings-btn" title="API Settings">⚙️</button>
            <button class="vms-sync-btn-icon" id="vms-sync-sound-toggle" title="Sound Toggle">🔊</button>
            <button class="vms-sync-btn-icon" id="vms-sync-min-toggle" title="Minimize">−</button>
          </div>
        </div>
        <div id="vms-sync-inline-settings" style="display: none; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
          <div style="font-size: 9px; font-weight: 700; color: #1e40af; margin-bottom: 2px;">1. ELITESECOM API URL (OMS):</div>
          <input type="text" id="vms-sync-inline-url" placeholder="https://my.elitesecom.ai/..." style="width: 100%; font-size: 10px; padding: 3px 5px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 4px;" />
          <div style="font-size: 9px; font-weight: 700; color: #1e40af; margin-bottom: 2px;">2. FLIPKART SCAN URL KEYWORD:</div>
          <input type="text" id="vms-sync-inline-fk-pattern" placeholder="awb/scan" style="width: 100%; font-size: 10px; padding: 3px 5px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 5px;" />
          <div style="display: flex; gap: 4px;">
            <button id="vms-sync-inline-save" class="vms-sync-btn-icon" style="flex: 1; background: #00C853; color: white; font-weight: bold; padding: 3px;">SAVE</button>
            <button id="vms-sync-inline-close" class="vms-sync-btn-icon" style="padding: 3px 6px;">CLOSE</button>
          </div>
          <div style="border-top: 1px dashed #cbd5e1; margin-top: 5px; padding-top: 4px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 9px; font-weight: 700; color: #64748b;">Version: 2.0.1</span>
            <button id="vms-sync-inline-check-update" class="vms-sync-btn-icon" style="background: #3b82f6; color: white; font-weight: bold; padding: 2px 6px; font-size: 9px;" title="Check GitHub for Updates">🔍 Check Update</button>
          </div>
          <div id="vms-sync-inline-update-msg" style="font-size: 9px; font-weight: 600; margin-top: 3px; display: none;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const box = document.getElementById("vms-sync-box");

    // Restore saved card position if available
    try {
      const savedPos = JSON.parse(localStorage.getItem("vms_sync_card_pos"));
      if (savedPos && savedPos.left && savedPos.top) {
        let l = parseFloat(savedPos.left);
        let t = parseFloat(savedPos.top);
        if (!isNaN(l) && !isNaN(t)) {
          const maxLeft = Math.max(10, window.innerWidth - 300);
          const maxTop = Math.max(10, window.innerHeight - 50);
          l = Math.max(10, Math.min(l, maxLeft));
          t = Math.max(10, Math.min(t, maxTop));
          container.style.setProperty("right", "auto", "important");
          container.style.setProperty("bottom", "auto", "important");
          container.style.setProperty("left", `${l}px`, "important");
          container.style.setProperty("top", `${t}px`, "important");
        }
      }
    } catch (e) {}

    // Universal Draggable Card: Grab and drag from ANYWHERE on the card (except buttons & inputs)
    let isDragging = false;
    let hasDragged = false;
    let shiftX = 0;
    let shiftY = 0;
    let startClientX = 0;
    let startClientY = 0;

    function isInteractiveTarget(target) {
      if (!target) return false;
      return !!target.closest("button, input, textarea, select, a, .vms-sync-controls, #vms-sync-inline-settings, .vms-sync-dot.disconnected");
    }

    function startDrag(clientX, clientY, target) {
      if (isInteractiveTarget(target)) return false;

      isDragging = true;
      hasDragged = false;
      startClientX = clientX;
      startClientY = clientY;

      const rect = container.getBoundingClientRect();
      shiftX = clientX - rect.left;
      shiftY = clientY - rect.top;

      container.style.setProperty("right", "auto", "important");
      container.style.setProperty("bottom", "auto", "important");
      container.style.setProperty("left", `${rect.left}px`, "important");
      container.style.setProperty("top", `${rect.top}px`, "important");

      box.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      if (document.body.style.webkitUserSelect !== undefined) {
        document.body.style.webkitUserSelect = "none";
      }

      return true;
    }

    function moveDrag(clientX, clientY) {
      if (!isDragging) return;

      const dx = clientX - startClientX;
      const dy = clientY - startClientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDragged = true;
      }

      let newLeft = clientX - shiftX;
      let newTop = clientY - shiftY;

      const maxLeft = Math.max(0, window.innerWidth - container.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - container.offsetHeight);

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      container.style.setProperty("left", `${newLeft}px`, "important");
      container.style.setProperty("top", `${newTop}px`, "important");
      container.style.setProperty("right", "auto", "important");
      container.style.setProperty("bottom", "auto", "important");
    }

    function endDrag(pointerId) {
      if (!isDragging) return;
      isDragging = false;
      box.style.cursor = "grab";
      document.body.style.userSelect = "";
      if (document.body.style.webkitUserSelect !== undefined) {
        document.body.style.webkitUserSelect = "";
      }

      if (pointerId !== undefined) {
        try { box.releasePointerCapture(pointerId); } catch (_) {}
      }

      try {
        localStorage.setItem("vms_sync_card_pos", JSON.stringify({
          left: container.style.left,
          top: container.style.top
        }));
      } catch (e) {}
    }

    // Pointer Events (primary modern handler on box)
    box.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (startDrag(e.clientX, e.clientY, e.target)) {
        try { box.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
      }
    });

    box.addEventListener("pointermove", (e) => {
      moveDrag(e.clientX, e.clientY);
    });

    box.addEventListener("pointerup", (e) => {
      endDrag(e.pointerId);
    });
    box.addEventListener("pointercancel", (e) => {
      endDrag(e.pointerId);
    });

    // Window-level mouse & pointer safety net
    window.addEventListener("pointermove", (e) => {
      if (isDragging) moveDrag(e.clientX, e.clientY);
    });
    window.addEventListener("pointerup", (e) => {
      if (isDragging) endDrag(e.pointerId);
    });
    window.addEventListener("mousemove", (e) => {
      if (isDragging) moveDrag(e.clientX, e.clientY);
    });
    window.addEventListener("mouseup", () => {
      if (isDragging) endDrag();
    });

    const minBtn = document.getElementById("vms-sync-min-toggle");
    minBtn.addEventListener("click", () => {
      isMinimized = !isMinimized;
      box.classList.toggle("minimized", isMinimized);
      minBtn.textContent = isMinimized ? "+" : "−";
      minBtn.title = isMinimized ? "Expand" : "Minimize";
    });
    box.addEventListener("click", (e) => {
      if (isMinimized && e.target !== minBtn) {
        if (hasDragged) return;
        isMinimized = false;
        box.classList.remove("minimized");
        minBtn.textContent = "−";
        minBtn.title = "Minimize";
      }
    });

    const soundBtn = document.getElementById("vms-sync-sound-toggle");
    if (soundBtn) {
      soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
      soundBtn.title = soundEnabled ? "Sound ON (Click to Mute / Test)" : "Sound OFF (Click to Unmute)";
      soundBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
        soundBtn.title = soundEnabled ? "Sound ON (Click to Mute / Test)" : "Sound OFF (Click to Unmute)";
        try { chrome.storage.local.set({ soundEnabled }); } catch (e) {}
        if (soundEnabled) {
          playSuccessSound();
        }
      });
    }

    function formatSeconds(sec) {
      if (isNaN(sec) || sec < 0) return "-";
      if (sec < 60) return `${sec}s`;
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      if (m < 60) return `${m}m ${s}s`;
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m ${s}s`;
    }

    function formatDurationHms(sec) {
      if (isNaN(sec) || sec < 0) return "00:00:00";
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
    }

    function generateCsvReport(logs, todayDate) {
      const dateStr = todayDate || new Date().toISOString().slice(0, 10);
      if (!logs || logs.length === 0) {
        return {
          csvContent: "",
          filename: `VMS_OMS_Scans_${dateStr}.csv`,
          isEmpty: true
        };
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

      const batchStartTime = startTimestamp !== Infinity ? new Date(startTimestamp).toLocaleTimeString('en-IN', { hour12: true }) : "-";
      const batchEndTime = endTimestamp > 0 ? new Date(endTimestamp).toLocaleTimeString('en-IN', { hour12: true }) : "-";
      const totalDurationSec = (startTimestamp !== Infinity && endTimestamp >= startTimestamp) ? Math.round((endTimestamp - startTimestamp) / 1000) : 0;
      const totalDurationStr = formatDurationHms(totalDurationSec);

      let csv = "\uFEFF";
      csv += `"=== VMS TO OMS PACKING REPORT ===","","","","","","",""\r\n`;
      csv += `"Date:","${dateStr}","","","","","",""\r\n`;
      csv += `"Batch Start Time:","${batchStartTime}","","","","","",""\r\n`;
      csv += `"Batch End Time:","${batchEndTime}","","","","","",""\r\n`;
      csv += `"Total Working Duration:","${totalDurationStr}","","","","","",""\r\n`;
      csv += `"Total Orders:","${logs.length}","Successful:","${successCount}","Failed:","${failedCount}","",""\r\n`;
      csv += `"","","","","","","",""\r\n`;
      csv += `"No","AWB Number","Start Time","End Time","Duration","Video Upload","Status","Message"\r\n`;

      logs.forEach((log, index) => {
        const no = logs.length - index;
        const awb = log.awb || "";
        const sTime = log.startTime || log.time || "-";
        const eTime = log.endTime || log.startTime || log.time || "-";
        const duration = log.duration || (log.durationSec ? formatSeconds(log.durationSec) : "-");
        const videoUpload = log.videoStatus || "DONE";
        const status = log.statusType || (log.success ? "SUCCESS" : "FAILED");
        const cleanMsg = (log.message || "").replace(/"/g, '""');

        const row = [
          no,
          `"${awb}"`,
          `"${sTime}"`,
          `"${eTime}"`,
          `"${duration}"`,
          `"${videoUpload}"`,
          `"${status}"`,
          `"${cleanMsg}"`
        ].join(",");
        csv += row + "\r\n";
      });

      return {
        csvContent: csv,
        filename: `VMS_OMS_Scans_${dateStr}.csv`,
        isEmpty: false
      };
    }

    const csvBtn = document.getElementById("vms-sync-csv-btn");
    if (csvBtn) {
      csvBtn.addEventListener("click", async () => {
        try {
          const data = await chrome.storage.local.get(["scanLogs", "todayDate"]);
          const logs = data.scanLogs || [];
          const report = generateCsvReport(logs, data.todayDate);
          if (report.isEmpty) {
            alert("No scan data recorded for today.");
            return;
          }
          const blob = new Blob([report.csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = report.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (e) {
          alert("Failed to export Excel: " + e.message);
        }
      });
    }

    // Inline settings button handlers
    const settingsBtn = document.getElementById("vms-sync-settings-btn");
    const settingsPanel = document.getElementById("vms-sync-inline-settings");
    const inlineUrlInput = document.getElementById("vms-sync-inline-url");
    const inlineFkInput = document.getElementById("vms-sync-inline-fk-pattern");
    const inlineSaveBtn = document.getElementById("vms-sync-inline-save");
    const inlineCloseBtn = document.getElementById("vms-sync-inline-close");

    // Initialize custom Flipkart pattern from storage
    try {
      chrome.storage.local.get(["fkPattern"], (data) => {
        if (data && data.fkPattern) {
          window.postMessage({
            source: "VMS_SYNC_PAGE",
            type: "UPDATE_FK_PATTERN",
            fkPattern: data.fkPattern
          }, "*");
        }
      });
    } catch (e) {}

    if (settingsBtn && settingsPanel) {
      settingsBtn.addEventListener("click", async () => {
        const isHidden = settingsPanel.style.display === "none";
        settingsPanel.style.display = isHidden ? "block" : "none";
        if (isHidden) {
          try {
            const data = await chrome.storage.local.get(["eliteUrl", "fkPattern"]);
            if (inlineUrlInput) {
              inlineUrlInput.value = data.eliteUrl || "https://my.elitesecom.ai/api/scanorders/pickup/pickup_scan";
            }
            if (inlineFkInput) {
              inlineFkInput.value = data.fkPattern || "awb/scan";
            }
          } catch (e) {}
        }
      });

      if (inlineCloseBtn) {
        inlineCloseBtn.addEventListener("click", () => {
          settingsPanel.style.display = "none";
        });
      }

      if (inlineSaveBtn && inlineUrlInput) {
        inlineSaveBtn.addEventListener("click", async () => {
          const val = inlineUrlInput.value.trim();
          const fkVal = inlineFkInput ? inlineFkInput.value.trim() : "awb/scan";
          if (val) {
            try {
              await chrome.storage.local.set({
                eliteUrl: val,
                fkPattern: fkVal || "awb/scan"
              });
              window.postMessage({
                source: "VMS_SYNC_PAGE",
                type: "UPDATE_FK_PATTERN",
                fkPattern: fkVal || "awb/scan"
              }, "*");
              alert("✅ Settings saved successfully!");
              settingsPanel.style.display = "none";
            } catch (e) {
              alert("Failed to save settings: " + e.message);
            }
          }
        });
      }

      // Manual Update Checker in Settings
      const inlineCheckUpdateBtn = document.getElementById("vms-sync-inline-check-update");
      const inlineUpdateMsg = document.getElementById("vms-sync-inline-update-msg");

      if (inlineCheckUpdateBtn) {
        inlineCheckUpdateBtn.addEventListener("click", async () => {
          inlineCheckUpdateBtn.disabled = true;
          inlineCheckUpdateBtn.textContent = "⏳...";
          if (inlineUpdateMsg) {
            inlineUpdateMsg.style.display = "block";
            inlineUpdateMsg.style.color = "#3b82f6";
            inlineUpdateMsg.textContent = "Checking GitHub...";
          }

          try {
            let localSignal = "";
            try {
              const lRes = await fetch(chrome.runtime.getURL("update_signal.txt?t=" + Date.now()), { cache: "no-store" });
              if (lRes.ok) localSignal = (await lRes.text()).trim();
            } catch (_) {}

            const gitRes = await fetch("https://raw.githubusercontent.com/UGAAN/Ruten-Scen-New/main/update_signal.txt?t=" + Date.now(), { cache: "no-store" });
            if (!gitRes.ok) throw new Error("GitHub error");
            const gitSignal = (await gitRes.text()).trim();

            if (gitSignal && localSignal && gitSignal !== localSignal) {
              if (inlineUpdateMsg) {
                inlineUpdateMsg.style.color = "#059669";
                inlineUpdateMsg.textContent = "🚀 Update available! Click 'UPDATE READY' above.";
              }
              const uBtn = document.getElementById("vms-sync-update-btn");
              if (uBtn) uBtn.style.display = "inline-flex";
            } else {
              if (inlineUpdateMsg) {
                inlineUpdateMsg.style.color = "#059669";
                inlineUpdateMsg.textContent = "✅ Latest version v2.0.1";
              }
            }
          } catch (err) {
            if (inlineUpdateMsg) {
              inlineUpdateMsg.style.color = "#dc2626";
              inlineUpdateMsg.textContent = "Check failed: " + err.message;
            }
          } finally {
            inlineCheckUpdateBtn.disabled = false;
            inlineCheckUpdateBtn.textContent = "🔍 Check Update";
          }
        });
      }
    }

    function runConnectionCheck() {
      const connDot = document.getElementById("vms-sync-conn-dot");
      const v2Chip = document.getElementById("vms-sync-v2-chip");
      const v1Chip = document.getElementById("vms-sync-v1-chip");
      const stateBadge = document.getElementById("vms-sync-state-badge");
      const msgText = document.getElementById("vms-sync-msg-text");
      const statusBox = document.getElementById("vms-sync-status-container");
      const awbText = document.getElementById("vms-sync-awb-text");

      try {
        chrome.runtime.sendMessage({ action: "CHECK_CONNECTION" }, (res) => {
          if (chrome.runtime.lastError || !res) return;

          const isV2 = !!res.v2_logged_in;
          const isV1 = !!res.v1_logged_in;
          const isAnyConnected = isV2 || isV1;

          // Only show V2 Chip when LOGGED OUT
          if (v2Chip) {
            if (isV2) {
              v2Chip.style.display = "none";
            } else {
              v2Chip.style.display = "inline-flex";
              v2Chip.className = "vms-sync-portal-chip offline";
              v2Chip.textContent = "V2: 🔴 Login";
              v2Chip.title = "V2 Logged Out! Click to Open Login";
              v2Chip.onclick = () => chrome.runtime.sendMessage({ action: "OPEN_ELITE_TAB", panel: "v2" });
            }
          }

          // Only show V1 Chip when LOGGED OUT
          if (v1Chip) {
            if (isV1) {
              v1Chip.style.display = "none";
            } else {
              v1Chip.style.display = "inline-flex";
              v1Chip.className = "vms-sync-portal-chip offline";
              v1Chip.textContent = "V1: 🔴 Login";
              v1Chip.title = "V1 Logged Out! Click to Open Login";
              v1Chip.onclick = () => chrome.runtime.sendMessage({ action: "OPEN_ELITE_TAB", panel: "v1" });
            }
          }

          // Overall Dot
          if (connDot) {
            if (isV2 && isV1) {
              connDot.className = "vms-sync-dot connected";
              connDot.title = "Both V1 & V2 Connected 🟢";
            } else if (isAnyConnected) {
              connDot.className = "vms-sync-dot connected";
              connDot.title = `Connected (${isV2 ? "V2" : "V1"} Active) 🟢`;
            } else {
              connDot.className = "vms-sync-dot disconnected";
              connDot.title = "Both V1 & V2 Logged Out 🔴 (Click to Login)";
              connDot.onclick = () => chrome.runtime.sendMessage({ action: "OPEN_ELITE_TAB", panel: "v2" });
            }
          }

          if (!hasActiveScanResult) {
            if (isV2 && isV1) {
              if (stateBadge) stateBadge.style.display = "none";
              if (awbText) awbText.textContent = "Ready to Scan";
              if (msgText) msgText.style.display = "none";
              if (statusBox) {
                statusBox.className = "vms-sync-status-box";
                statusBox.title = "EliteSecom Connected (V1+V2) - Ready to scan";
              }
            } else if (isV2) {
              if (stateBadge) stateBadge.style.display = "none";
              if (awbText) awbText.textContent = "Ready (V2 Active)";
              if (msgText) msgText.style.display = "none";
              if (statusBox) {
                statusBox.className = "vms-sync-status-box";
                statusBox.title = "V2 Active, V1 Logged Out";
              }
            } else if (isV1) {
              if (stateBadge) stateBadge.style.display = "none";
              if (awbText) awbText.textContent = "Ready (V1 Active)";
              if (msgText) msgText.style.display = "none";
              if (statusBox) {
                statusBox.className = "vms-sync-status-box";
                statusBox.title = "V1 Active, V2 Logged Out";
              }
            } else {
              if (stateBadge) {
                stateBadge.style.display = "inline-block";
                stateBadge.className = "vms-sync-badge-pill error";
                stateBadge.textContent = "OFFLINE";
              }
              if (awbText) awbText.textContent = "Login Required";
              if (msgText) {
                msgText.innerHTML = '<button class="vms-sync-login-btn" id="vms-sync-inline-v2">🔑 V2</button> <button class="vms-sync-login-btn" id="vms-sync-inline-v1">🔑 V1</button>';
                msgText.style.display = "inline-flex";
                const bV2 = document.getElementById("vms-sync-inline-v2");
                const bV1 = document.getElementById("vms-sync-inline-v1");
                if (bV2) bV2.onclick = () => chrome.runtime.sendMessage({ action: "OPEN_ELITE_TAB", panel: "v2" });
                if (bV1) bV1.onclick = () => chrome.runtime.sendMessage({ action: "OPEN_ELITE_TAB", panel: "v1" });
              }
              if (statusBox) {
                statusBox.className = "vms-sync-status-box error";
                statusBox.title = "Please login to EliteSecom (V2 or V1)";
              }
            }
          }
        });
      } catch (e) {}
    }

    runConnectionCheck();
    setInterval(runConnectionCheck, 15000);
    window.addEventListener("focus", runConnectionCheck);

    // Live Update Notification & 1-Click Reload Button
    const updateBtn = document.getElementById("vms-sync-update-btn");
    if (updateBtn) {
      updateBtn.addEventListener("click", () => {
        updateBtn.innerHTML = "<span>🔄 Reloading...</span>";
        try {
          chrome.runtime.sendMessage({ action: "RELOAD_EXTENSION" });
        } catch (e) {}
        setTimeout(() => {
          window.location.reload();
        }, 500);
      });
    }

    let initialUpdateSignal = null;
    async function checkUpdateSignal() {
      try {
        const localUrl = chrome.runtime.getURL("update_signal.txt?t=" + Date.now());
        const res = await fetch(localUrl, { cache: "no-store" });
        if (res.ok) {
          const text = (await res.text()).trim();
          if (text) {
            if (initialUpdateSignal === null) {
              initialUpdateSignal = text;
            } else if (text !== initialUpdateSignal) {
              const uBtn = document.getElementById("vms-sync-update-btn");
              if (uBtn) uBtn.style.display = "inline-flex";
              return;
            }
          }
        }

        chrome.runtime.sendMessage({ action: "CHECK_UPDATE" }, (resp) => {
          if (chrome.runtime.lastError) return;
          if (resp && resp.updateAvailable) {
            const uBtn = document.getElementById("vms-sync-update-btn");
            if (uBtn) uBtn.style.display = "inline-flex";
          }
        });
      } catch (e) {}
    }

    checkUpdateSignal();
    setInterval(checkUpdateSignal, 20000);
    window.addEventListener("focus", checkUpdateSignal);

    try {
      chrome.runtime.sendMessage({ action: "GET_STATS" }, (res) => {
        if (res) {
          const counterEl = document.getElementById("vms-sync-counter");
          if (counterEl) counterEl.textContent = res.todaySuccess || 0;
        }
      });
    } catch (err) {}
  }

  function updateOverlayStatus(awb, result) {
    syncOverlayVisibility();
    const statusBox = document.getElementById("vms-sync-status-container");
    const stateBadge = document.getElementById("vms-sync-state-badge");
    const awbText = document.getElementById("vms-sync-awb-text");
    const msgText = document.getElementById("vms-sync-msg-text");
    const counterEl = document.getElementById("vms-sync-counter");

    if (!statusBox || !awbText || !msgText || !stateBadge) return;

    hasActiveScanResult = true;
    stateBadge.style.display = "inline-block";
    awbText.textContent = awb;
    statusBox.className = "vms-sync-status-box";
    statusBox.title = (result && result.message) || "";

    const type = (result && result.statusType) || (result && result.success ? "SUCCESS" : "ERROR");
    const omsTag = result && result.omsSource ? `${result.omsSource} ` : "";

    if (type === "SUCCESS") {
      statusBox.classList.add("success");
      stateBadge.className = "vms-sync-badge-pill success";
      stateBadge.textContent = `${omsTag}DONE`;
      msgText.style.display = "none";
      playSuccessSound();
    } else if (type === "ALREADY_SCANNED") {
      statusBox.classList.add("warning");
      stateBadge.className = "vms-sync-badge-pill warning";
      stateBadge.textContent = "ALREADY SCANNED";
      if (result && result.message && result.message !== "Suborders have already been picked up.") {
        msgText.textContent = `(${result.message})`;
        msgText.style.display = "inline";
      } else {
        msgText.style.display = "none";
      }
      playWarningSound();
    } else if (type === "CANCELLED") {
      statusBox.classList.add("cancelled");
      stateBadge.className = "vms-sync-badge-pill cancelled";
      stateBadge.textContent = "⛔ CANCELLED";
      msgText.style.display = "none";
      playCancelledSirenSound();
      triggerScreenAlarmFlash(awb, "CANCELLED ORDER");
    } else if (type === "NOT_FOUND") {
      statusBox.classList.add("error");
      stateBadge.className = "vms-sync-badge-pill error";
      stateBadge.textContent = "NOT FOUND";
      msgText.style.display = "none";
      playAlertSound();
    } else if (type === "AUTH_EXPIRED") {
      statusBox.classList.add("error");
      stateBadge.className = "vms-sync-badge-pill error";
      stateBadge.textContent = "SESSION EXPIRED";
      msgText.innerHTML = `<button class="vms-sync-login-btn" id="vms-sync-inline-login-btn">🔑 Login</button>`;
      msgText.style.display = "inline-flex";
      playAlertSound();
      const lBtn = document.getElementById("vms-sync-inline-login-btn");
      if (lBtn) lBtn.onclick = () => chrome.runtime.sendMessage({ action: "OPEN_ELITE_TAB" });
    } else {
      statusBox.classList.add("error");
      stateBadge.className = "vms-sync-badge-pill error";
      stateBadge.textContent = "ERROR";
      msgText.innerHTML = `<button id="vms-sync-retry-btn" style="background:#1877F2;color:#fff;border:none;border-radius:3px;padding:1px 5px;font-size:9px;font-weight:700;cursor:pointer;">🔄 Retry</button>`;
      msgText.style.display = "inline-flex";
      playAlertSound();
      const retryBtn = document.getElementById("vms-sync-retry-btn");
      if (retryBtn) {
        retryBtn.onclick = () => {
          stateBadge.textContent = "RETRYING...";
          chrome.runtime.sendMessage({ action: "SYNC_AWB_TO_ELITE", awb }, (r) => {
            if (r) updateOverlayStatus(awb, r);
          });
        };
      }
    }

    try {
      chrome.runtime.sendMessage({ action: "GET_STATS" }, (res) => {
        if (res && counterEl) {
          counterEl.textContent = res.todaySuccess || 0;
        }
      });
    } catch (e) {}
  }

  // High-visibility Fullscreen Banner for CANCELLED orders
  function triggerScreenAlarmFlash(awb, msg) {
    let banner = document.getElementById("vms-sync-alarm-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "vms-sync-alarm-banner";
      banner.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        background: #dc2626 !important;
        color: #ffffff !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 16px !important;
        font-weight: 800 !important;
        text-align: center !important;
        padding: 10px 16px !important;
        z-index: 2147483647 !important;
        box-shadow: 0 4px 18px rgba(220, 38, 38, 0.7) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 14px !important;
        animation: pulse 1s infinite alternate !important;
      `;
      document.body.appendChild(banner);
    }
    banner.innerHTML = `<span>⛔ CANCELLED ORDER</span> <span>AWB: ${awb}</span>`;
    banner.style.display = "flex";

    if (banner._hideTimeout) {
      clearTimeout(banner._hideTimeout);
    }
    banner._hideTimeout = setTimeout(() => {
      if (banner && banner.style.display !== "none") {
        banner.style.display = "none";
      }
    }, 2000);
  }

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.source !== "VMS_SYNC_PAGE") return;

    if (event.data.type === "AWB_SCANNED") {
      let { awb, triggerType } = event.data;
      if (!awb) return;
      awb = String(awb).replace(/^[(\s]+|[)\s]+$/g, "").trim();
      if (!awb) return;

      if (!isPackingScreenActive()) {
        console.log(`[VMS-Sync] Ignored scan because not on active packing screen: ${awb}`);
        return;
      }

      const now = Date.now();
      if (recentScansCache.has(awb)) {
        const lastSeen = recentScansCache.get(awb);
        if (now - lastSeen < 3500) {
          return;
        }
      }
      recentScansCache.set(awb, now);

      console.log(`[VMS-Sync] AWB Detected (${triggerType}): ${awb}`);

      syncOverlayVisibility();
      const awbText = document.getElementById("vms-sync-awb-text");
      const msgText = document.getElementById("vms-sync-msg-text");
      const stateBadge = document.getElementById("vms-sync-state-badge");
      const statusBox = document.getElementById("vms-sync-status-container");

      if (awbText && statusBox && stateBadge) {
        hasActiveScanResult = true;
        stateBadge.style.display = "inline-block";
        awbText.textContent = awb;
        statusBox.className = "vms-sync-status-box";
        stateBadge.className = "vms-sync-badge-pill info";
        stateBadge.textContent = "CHECKING...";
        if (msgText) msgText.style.display = "none";
      }

      try {
        chrome.runtime.sendMessage({ action: "SYNC_AWB_TO_ELITE", awb }, (response) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message || "";
            if (errMsg.includes("Extension context invalidated")) {
              if (stateBadge) {
                stateBadge.style.display = "inline-block";
                stateBadge.className = "vms-sync-badge-pill warning";
                stateBadge.textContent = "RELOAD F5";
              }
              if (statusBox) {
                statusBox.className = "vms-sync-status-box warning";
                statusBox.title = "Extension reloaded. Please refresh (F5) page.";
              }
            } else {
              updateOverlayStatus(awb, { success: false, statusType: "ERROR", message: errMsg });
            }
            return;
          }
          if (response) {
            updateOverlayStatus(awb, response);
          }
        });
      } catch (err) {
        if (String(err).includes("Extension context invalidated")) {
          if (stateBadge) {
            stateBadge.style.display = "inline-block";
            stateBadge.className = "vms-sync-badge-pill warning";
            stateBadge.textContent = "RELOAD F5";
          }
          if (statusBox) {
            statusBox.className = "vms-sync-status-box warning";
            statusBox.title = "Extension reloaded. Please refresh (F5) page.";
          }
        }
      }
    }
  });

  window.addEventListener("hashchange", syncOverlayVisibility, { passive: true });
  window.addEventListener("popstate", syncOverlayVisibility, { passive: true });
  setInterval(syncOverlayVisibility, 400);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncOverlayVisibility);
  } else {
    syncOverlayVisibility();
  }

})();
