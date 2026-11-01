/**
 * VMS-Sync: Content Script (v2.0.4)
 * Shows exact EliteSecom server messages with high-visibility badges:
 * [ ✅ DONE ], [ ⚠️ ALREADY SCANNED ], [ ⛔ CANCELLED ], [ ❌ NOT FOUND ]
 */

(function () {
  console.log("%c[VMS-Sync] Content script v2.1.2 active on Flipkart VMS", "color: #00C853; font-weight: bold;");

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
    const prodOverlay = document.getElementById("vms-product-overlay");

    if (!shouldShow) {
      if (overlay && overlay.style.display !== "none") {
        overlay.style.display = "none";
      }
      if (prodOverlay && prodOverlay.style.display !== "none") {
        prodOverlay.style.display = "none";
      }
      return;
    }

    if (!overlay) {
      createOverlay();
    } else if (overlay.style.display === "none") {
      overlay.style.display = "block";
    }

    if (!prodOverlay) {
      createProductPreviewOverlay();
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
        .vms-sync-card.minimized #vms-sync-img-toggle,
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

        /* ========================================================================= */
        /* VMS PRODUCT VERIFICATION & BIG IMAGE PREVIEW STYLES                       */
        /* ========================================================================= */
        #vms-product-overlay {
          position: fixed !important;
          top: 72px;
          right: 20px;
          width: 315px;
          max-width: 94vw;
          z-index: 2147483646 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #ffffff;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          transition: box-shadow 0.25s ease, border-color 0.25s ease;
          user-select: none;
          box-sizing: border-box;
        }
        #vms-product-overlay.cancelled {
          border-color: #dc2626 !important;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.4), 0 12px 28px rgba(220, 38, 38, 0.3) !important;
          animation: vms-prod-cancelled-glow 0.8s infinite alternate !important;
        }
        @keyframes vms-prod-cancelled-glow {
          0% { box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.4); }
          100% { box-shadow: 0 0 18px 4px rgba(220, 38, 38, 0.8); }
        }
        .vms-prod-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #0f172a;
          color: #f8fafc;
          padding: 7px 10px;
          cursor: grab;
          font-weight: 700;
          font-size: 11px;
          border-bottom: 1px solid #1e293b;
          box-sizing: border-box;
        }
        .vms-prod-header:active {
          cursor: grabbing;
        }
        .vms-prod-title-group {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
        }
        .vms-prod-oms-badge {
          background: #2563eb;
          color: #ffffff;
          font-size: 9px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 4px;
          letter-spacing: 0.3px;
        }
        .vms-prod-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .vms-prod-btn {
          background: rgba(255, 255, 255, 0.14);
          color: #ffffff;
          border: none;
          border-radius: 4px;
          width: 20px;
          height: 20px;
          font-size: 11px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer !important;
          transition: background 0.15s ease;
        }
        .vms-prod-btn:hover {
          background: rgba(255, 255, 255, 0.32);
        }
        .vms-prod-btn.close:hover {
          background: #dc2626;
        }
        .vms-prod-body {
          padding: 8px 10px 10px 10px;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 7px;
          box-sizing: border-box;
        }
        .vms-prod-img-box {
          position: relative;
          width: 100%;
          height: 200px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }
        .vms-prod-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #ffffff;
          transition: transform 0.2s ease;
          cursor: pointer;
        }
        .vms-prod-img:hover {
          transform: scale(1.04);
        }
        .vms-prod-zoom-btn {
          position: absolute;
          bottom: 6px;
          right: 6px;
          background: rgba(15, 23, 42, 0.82);
          color: #ffffff;
          border: none;
          border-radius: 4px;
          padding: 3px 7px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer !important;
          opacity: 0.88;
          transition: opacity 0.15s ease;
        }
        .vms-prod-zoom-btn:hover {
          opacity: 1;
          background: #2563eb;
        }
        .vms-prod-size-badge {
          position: absolute !important;
          top: 6px;
          left: 6px;
          background: #dc2626 !important; /* Bold Vibrant Red */
          color: #ffffff !important;
          border: 2px solid #ffffff;
          border-radius: 6px;
          padding: 3px 8px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-weight: 900;
          display: flex;
          align-items: center;
          gap: 5px;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.5);
          z-index: 10;
          pointer-events: none;
          text-transform: uppercase;
          line-height: 1;
        }
        .vms-prod-size-lbl {
          font-size: 10px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.95);
          letter-spacing: 0.5px;
        }
        .vms-prod-size-val {
          font-size: 18px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.5px;
        }
        .vms-prod-shimmer {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #64748b;
          font-size: 11px;
          font-weight: 600;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: vms-prod-shimmer 1.5s infinite;
        }
        @keyframes vms-prod-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .vms-prod-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #cbd5e1;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: vms-spin 0.8s linear infinite;
        }
        .vms-prod-no-img {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 600;
        }
        .vms-prod-status-banner {
          padding: 5px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
          letter-spacing: 0.2px;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }
        .vms-prod-status-banner.success {
          background: #ecfdf5;
          color: #065f46;
          border-color: #a7f3d0;
        }
        .vms-prod-status-banner.warning {
          background: #fffbeb;
          color: #92400e;
          border-color: #fde68a;
        }
        .vms-prod-status-banner.cancelled {
          background: #fef2f2 !important;
          color: #991b1b !important;
          border-color: #fecaca !important;
          animation: vms-prod-status-pulse 0.7s infinite alternate;
        }
        @keyframes vms-prod-status-pulse {
          0% { background: #fee2e2; }
          100% { background: #ef4444; color: #ffffff; }
        }
        .vms-prod-qty-banner {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          color: #334155;
        }
        .vms-prod-qty-banner.multi {
          background: #fef3c7 !important;
          color: #92400e !important;
          border: 1.5px dashed #f59e0b !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          animation: vms-prod-qty-pulse 1s infinite alternate;
        }
        @keyframes vms-prod-qty-pulse {
          0% { transform: scale(0.99); }
          100% { transform: scale(1.02); }
        }
        .vms-prod-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .vms-prod-sku-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          padding: 5px 8px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          gap: 6px;
        }
        .vms-prod-sku-label {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .vms-prod-sku-val {
          font-size: 11.5px;
          font-weight: 800;
          color: #0f172a;
          cursor: pointer;
          flex: 1;
          text-align: right;
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.3;
        }
        .vms-prod-mpsku-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #eff6ff;
          padding: 5px 8px;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
          margin-top: 3px;
          gap: 6px;
        }
        .vms-prod-mpsku-label {
          font-size: 10px;
          font-weight: 700;
          color: #1d4ed8;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .vms-prod-mpsku-val {
          font-size: 11.5px;
          font-weight: 800;
          color: #1e3a8a;
          cursor: pointer;
          flex: 1;
          text-align: right;
          word-break: break-word;
          overflow-wrap: anywhere;
          line-height: 1.3;
        }
        .vms-prod-copy-btn {
          background: transparent;
          border: none;
          cursor: pointer !important;
          font-size: 11px;
          padding: 0 2px;
          opacity: 0.7;
        }
        .vms-prod-copy-btn:hover {
          opacity: 1;
        }
        .vms-prod-name {
          font-size: 11px;
          color: #334155;
          line-height: 1.35;
          max-height: 30px;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }
        .vms-prod-meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
        }
        .vms-prod-mini-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: #ffffff;
          font-size: 11px;
          font-weight: 700;
        }
        .vms-prod-mini-pill {
          background: #eff6ff;
          color: #1d4ed8;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 10px;
        }

        /* Fullscreen Zoom Modal */
        #vms-prod-zoom-modal {
          position: fixed !important;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.88);
          z-index: 2147483647 !important;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: zoom-out;
        }
        .vms-zoom-content {
          position: relative;
          max-width: 85vw;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: default;
        }
        .vms-zoom-content img {
          max-width: 85vw;
          max-height: 80vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
          background: #ffffff;
        }
        .vms-zoom-close {
          position: absolute;
          top: -34px;
          right: 0;
          color: #ffffff;
          font-size: 26px;
          font-weight: bold;
          cursor: pointer !important;
          background: rgba(255, 255, 255, 0.2);
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .vms-zoom-caption {
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          margin-top: 8px;
          text-align: center;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
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
            <button class="vms-sync-btn-icon" id="vms-sync-img-toggle" title="Toggle Product Image Preview (🖼️)">🖼️</button>
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
            <span style="font-size: 9px; font-weight: 700; color: #64748b;">Version: 2.0.4</span>
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
          const maxLeft = Math.max(10, window.innerWidth - 325);
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
      csv += `"No","AWB Number","Master SKU","Quantity","Product Title","Image URL","Start Time","End Time","Duration","Video Upload","Status","Message"\r\n`;

      logs.forEach((log, index) => {
        const no = logs.length - index;
        const awb = log.awb || "";
        const sku = (log.master_sku || "").replace(/"/g, '""');
        const qty = log.quantity || 1;
        const title = (log.product_title || "").replace(/"/g, '""');
        const imgUrl = (log.image_url || log.product_image || "").replace(/"/g, '""');
        const sTime = log.startTime || log.time || "-";
        const eTime = log.endTime || log.startTime || log.time || "-";
        const duration = log.duration || (log.durationSec ? formatSeconds(log.durationSec) : "-");
        const videoUpload = log.videoStatus || "DONE";
        const status = log.statusType || (log.success ? "SUCCESS" : "FAILED");
        const cleanMsg = (log.message || "").replace(/"/g, '""');

        const row = [
          no,
          `"${awb}"`,
          `"${sku}"`,
          qty,
          `"${title}"`,
          `"${imgUrl}"`,
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

    const imgToggleBtn = document.getElementById("vms-sync-img-toggle");
    if (imgToggleBtn) {
      imgToggleBtn.addEventListener("click", () => {
        createProductPreviewOverlay();
        const pOverlay = document.getElementById("vms-product-overlay");
        if (pOverlay) {
          if (pOverlay.style.display === "none") {
            pOverlay.style.display = "block";
          } else {
            pOverlay.style.display = "none";
          }
        }
      });
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
                inlineUpdateMsg.textContent = "✅ Latest version v2.0.4";
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

  // =========================================================================
  // LIVE PRODUCT VERIFICATION & BIG IMAGE PREVIEW COMPONENT
  // =========================================================================
  function createProductPreviewOverlay() {
    if (document.getElementById("vms-product-overlay")) return;
    if (!document.body) return;

    const prodOverlay = document.createElement("div");
    prodOverlay.id = "vms-product-overlay";
    prodOverlay.className = "vms-prod-card";
    prodOverlay.style.display = "none"; // Shown when first scan happens or when image button is toggled

    prodOverlay.innerHTML = `
      <div class="vms-prod-header" id="vms-prod-header">
        <div class="vms-prod-title-group">
          <span style="font-size: 13px;">📦</span>
          <span style="font-weight: 700; letter-spacing: -0.2px;">Product Verification</span>
          <span class="vms-prod-oms-badge" id="vms-prod-oms-badge">V2</span>
        </div>
        <div class="vms-prod-actions">
          <button class="vms-prod-btn" id="vms-prod-min-btn" title="Minimize / Expand">−</button>
          <button class="vms-prod-btn close" id="vms-prod-close-btn" title="Close Preview">✕</button>
        </div>
      </div>

      <div class="vms-prod-body" id="vms-prod-body">
        <div class="vms-prod-img-box" id="vms-prod-img-box">
          <div class="vms-prod-size-badge" id="vms-prod-size-badge" style="display: none;">
            <span class="vms-prod-size-lbl">SIZE:</span>
            <span class="vms-prod-size-val" id="vms-prod-size-val">-</span>
          </div>
          <div class="vms-prod-shimmer" id="vms-prod-shimmer" style="display: none;">
            <div class="vms-prod-spinner"></div>
            <span>Fetching Product Photo...</span>
          </div>
          <img id="vms-prod-img" class="vms-prod-img" src="" alt="Product Photo" style="display: none;" />
          <div class="vms-prod-no-img" id="vms-prod-no-img" style="display: none;">
            <span style="font-size: 32px;">🖼️</span>
            <span id="vms-prod-no-img-text">No Image Found in OMS</span>
            <button class="vms-prod-retry-btn" id="vms-prod-retry-btn" type="button" style="margin-top: 6px; padding: 4px 10px; font-size: 11px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">🔍 Deep Search OMS</button>
          </div>
          <button class="vms-prod-zoom-btn" id="vms-prod-zoom-btn" title="View Fullscreen" style="display: none;">🔍 Zoom</button>
        </div>

        <div class="vms-prod-status-banner" id="vms-prod-status-banner">
          <span id="vms-prod-status-text">Ready to Scan</span>
        </div>

        <div class="vms-prod-qty-banner" id="vms-prod-qty-banner">
          <span id="vms-prod-qty-text">Qty: 1</span>
        </div>

        <div class="vms-prod-info">
          <div class="vms-prod-sku-row">
            <span class="vms-prod-sku-label">Master SKU:</span>
            <span class="vms-prod-sku-val" id="vms-prod-sku-val" title="Click to copy Master SKU">-</span>
            <button class="vms-prod-copy-btn" id="vms-prod-copy-btn" title="Copy Master SKU">📋</button>
          </div>
          <div class="vms-prod-mpsku-row" id="vms-prod-mpsku-row">
            <span class="vms-prod-mpsku-label">MP SKU:</span>
            <span class="vms-prod-mpsku-val" id="vms-prod-mpsku-val" title="Click to copy MP SKU">-</span>
            <button class="vms-prod-copy-btn" id="vms-prod-copy-mp-btn" title="Copy MP SKU">📋</button>
          </div>
          <div class="vms-prod-name" id="vms-prod-name" style="display: none;">-</div>
          <div class="vms-prod-meta-row">
            <span class="vms-prod-awb" id="vms-prod-awb">AWB: -</span>
            <span class="vms-prod-suborder" id="vms-prod-suborder">-</span>
          </div>
        </div>
      </div>

      <div class="vms-prod-mini-bar" id="vms-prod-mini-bar" style="display: none;">
        <span id="vms-prod-mini-sku">SKU: -</span>
        <span id="vms-prod-mini-qty" class="vms-prod-mini-pill">Qty: 1</span>
        <button class="vms-prod-btn expand" id="vms-prod-expand-btn" title="Expand Preview">□</button>
      </div>
    `;

    document.body.appendChild(prodOverlay);

    // Zoom modal element
    let zoomModal = document.getElementById("vms-prod-zoom-modal");
    if (!zoomModal) {
      zoomModal = document.createElement("div");
      zoomModal.id = "vms-prod-zoom-modal";
      zoomModal.style.display = "none";
      zoomModal.innerHTML = `
        <div class="vms-zoom-content" id="vms-zoom-content">
          <span class="vms-zoom-close" id="vms-zoom-close">✕</span>
          <img id="vms-zoom-img" src="" alt="Full Zoom Image" />
          <div class="vms-zoom-caption" id="vms-zoom-caption">-</div>
        </div>
      `;
      document.body.appendChild(zoomModal);

      zoomModal.addEventListener("click", (e) => {
        if (e.target.id === "vms-prod-zoom-modal" || e.target.id === "vms-zoom-close") {
          zoomModal.style.display = "none";
        }
      });
    }

    // Restore saved card position if available
    try {
      const savedPos = JSON.parse(localStorage.getItem("vms_prod_card_pos"));
      if (savedPos && savedPos.left && savedPos.top) {
        let l = parseFloat(savedPos.left);
        let t = parseFloat(savedPos.top);
        if (!isNaN(l) && !isNaN(t)) {
          const maxLeft = Math.max(10, window.innerWidth - 325);
          const maxTop = Math.max(10, window.innerHeight - 100);
          l = Math.max(10, Math.min(l, maxLeft));
          t = Math.max(10, Math.min(t, maxTop));
          prodOverlay.style.setProperty("right", "auto", "important");
          prodOverlay.style.setProperty("bottom", "auto", "important");
          prodOverlay.style.setProperty("left", `${l}px`, "important");
          prodOverlay.style.setProperty("top", `${t}px`, "important");
        }
      }
    } catch (e) {}

    // Restore minimized state
    try {
      if (localStorage.getItem("vms_prod_card_minimized") === "true") {
        const bodyEl = document.getElementById("vms-prod-body");
        const miniEl = document.getElementById("vms-prod-mini-bar");
        if (bodyEl && miniEl) {
          bodyEl.style.display = "none";
          miniEl.style.display = "flex";
        }
      }
    } catch (e) {}

    // Dragging setup for #vms-product-overlay
    const headerEl = document.getElementById("vms-prod-header");
    let isDragging = false;
    let shiftX = 0;
    let shiftY = 0;

    if (headerEl) {
      headerEl.addEventListener("mousedown", (e) => {
        if (e.target.closest("button")) return;
        isDragging = true;
        const rect = prodOverlay.getBoundingClientRect();
        shiftX = e.clientX - rect.left;
        shiftY = e.clientY - rect.top;
        headerEl.style.cursor = "grabbing";
        e.preventDefault();
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        let newX = e.clientX - shiftX;
        let newY = e.clientY - shiftY;
        const maxLeft = Math.max(10, window.innerWidth - prodOverlay.offsetWidth - 10);
        const maxTop = Math.max(10, window.innerHeight - prodOverlay.offsetHeight - 10);
        newX = Math.max(10, Math.min(newX, maxLeft));
        newY = Math.max(10, Math.min(newY, maxTop));
        prodOverlay.style.setProperty("right", "auto", "important");
        prodOverlay.style.setProperty("bottom", "auto", "important");
        prodOverlay.style.setProperty("left", `${newX}px`, "important");
        prodOverlay.style.setProperty("top", `${newY}px`, "important");
      });

      window.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          headerEl.style.cursor = "grab";
          try {
            localStorage.setItem("vms_prod_card_pos", JSON.stringify({
              left: prodOverlay.style.left,
              top: prodOverlay.style.top
            }));
          } catch (e) {}
        }
      });
    }

    // Card minimize / expand buttons
    const minBtn = document.getElementById("vms-prod-min-btn");
    const expandBtn = document.getElementById("vms-prod-expand-btn");
    const closeBtn = document.getElementById("vms-prod-close-btn");
    const bodyEl = document.getElementById("vms-prod-body");
    const miniEl = document.getElementById("vms-prod-mini-bar");

    if (minBtn && bodyEl && miniEl) {
      minBtn.addEventListener("click", () => {
        bodyEl.style.display = "none";
        miniEl.style.display = "flex";
        try { localStorage.setItem("vms_prod_card_minimized", "true"); } catch (e) {}
      });
    }

    if (expandBtn && bodyEl && miniEl) {
      expandBtn.addEventListener("click", () => {
        bodyEl.style.display = "flex";
        miniEl.style.display = "none";
        try { localStorage.setItem("vms_prod_card_minimized", "false"); } catch (e) {}
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        prodOverlay.style.display = "none";
      });
    }

    // SKU Copy Button (Master SKU)
    const copyBtn = document.getElementById("vms-prod-copy-btn");
    const skuVal = document.getElementById("vms-prod-sku-val");
    if (copyBtn && skuVal) {
      const handleCopy = () => {
        const text = skuVal.textContent.trim();
        if (text && text !== "-" && text !== "Loading...") {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.textContent = "✅";
            setTimeout(() => { copyBtn.textContent = "📋"; }, 1500);
          }).catch(() => {});
        }
      };
      copyBtn.addEventListener("click", handleCopy);
      skuVal.addEventListener("click", handleCopy);
    }

    // MP SKU Copy Button
    const copyMpBtn = document.getElementById("vms-prod-copy-mp-btn");
    const mpSkuVal = document.getElementById("vms-prod-mpsku-val");
    if (copyMpBtn && mpSkuVal) {
      const handleCopyMp = () => {
        const text = mpSkuVal.textContent.trim();
        if (text && text !== "-" && text !== "Loading...") {
          navigator.clipboard.writeText(text).then(() => {
            copyMpBtn.textContent = "✅";
            setTimeout(() => { copyMpBtn.textContent = "📋"; }, 1500);
          }).catch(() => {});
        }
      };
      copyMpBtn.addEventListener("click", handleCopyMp);
      mpSkuVal.addEventListener("click", handleCopyMp);
    }

    // Zoom Image click
    const imgEl = document.getElementById("vms-prod-img");
    const zoomBtn = document.getElementById("vms-prod-zoom-btn");
    const openZoom = () => {
      const modal = document.getElementById("vms-prod-zoom-modal");
      const zImg = document.getElementById("vms-zoom-img");
      const zCap = document.getElementById("vms-zoom-caption");
      const skuText = document.getElementById("vms-prod-sku-val") ? document.getElementById("vms-prod-sku-val").textContent : "";
      const mpText = document.getElementById("vms-prod-mpsku-val") ? document.getElementById("vms-prod-mpsku-val").textContent : "";
      if (modal && zImg && imgEl && imgEl.src) {
        zImg.src = imgEl.src;
        if (zCap) zCap.textContent = `Master: ${skuText} | MP: ${mpText}`;
        modal.style.display = "flex";
      }
    };
    if (imgEl) {
      imgEl.addEventListener("click", openZoom);
      imgEl.onerror = () => {
        imgEl.style.display = "none";
        const noImg = document.getElementById("vms-prod-no-img");
        if (noImg) noImg.style.display = "flex";
      };
    }
    if (zoomBtn) zoomBtn.addEventListener("click", openZoom);

    // Deep Search retry button handler
    const retryBtn = document.getElementById("vms-prod-retry-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        const awbEl = document.getElementById("vms-prod-awb");
        const currentAwb = awbEl ? awbEl.textContent.replace("AWB:", "").trim() : "";
        if (!currentAwb || currentAwb === "-") return;
        retryBtn.textContent = "⏳ Searching...";
        retryBtn.disabled = true;
        chrome.runtime.sendMessage({ action: "GET_PICKUP_ORDER_DETAILS", awb: currentAwb }, (details) => {
          retryBtn.textContent = "🔍 Deep Search OMS";
          retryBtn.disabled = false;
          if (details && (details.image_url || details.master_sku)) {
            updateProductCard(currentAwb, details);
          } else {
            const noImgText = document.getElementById("vms-prod-no-img-text");
            if (noImgText) noImgText.textContent = "Product Not Found in OMS";
          }
        });
      });
    }
  }

  // Extract apparel size from product object or SKU string
  function extractProductSize(item) {
    if (!item) return "";
    if (item.size && typeof item.size === "string" && item.size.trim() && item.size !== "false") {
      return item.size.trim().toUpperCase();
    }
    const sku = item.master_sku || item.marketplace_sku || item.sku || "";
    if (!sku) return "";
    const s = String(sku).trim().toUpperCase();
    const endMatch = s.match(/[_\-\s]+(XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|6XL|FREE\s*SIZE|FS|[234][0-9])$/i);
    if (endMatch) return endMatch[1].replace(/\s+/g, "");
    const embeddedMatch = s.match(/[_\-\s]+(XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|6XL|FS|[234][0-9])(?=[_\-\s]|$)/i);
    if (embeddedMatch) return embeddedMatch[1];
    return "";
  }

  // Render prominent red size highlight badge on top-left of image
  function renderSizeBadge(item) {
    const sizeBadge = document.getElementById("vms-prod-size-badge");
    const sizeVal = document.getElementById("vms-prod-size-val");
    if (!sizeBadge || !sizeVal) return;
    const size = extractProductSize(item);
    if (size) {
      sizeVal.textContent = size;
      sizeBadge.style.display = "flex";
    } else {
      sizeBadge.style.display = "none";
    }
  }

  function showProductCardLoading(awb) {
    try {
      chrome.storage.local.get(["vmsImagePreviewEnabled"], (st) => {
        if (st && st.vmsImagePreviewEnabled === false) return;

        createProductPreviewOverlay();
        const overlay = document.getElementById("vms-product-overlay");
        if (!overlay) return;

        overlay.style.display = "block";
        overlay.classList.remove("cancelled");

        const sizeBadge = document.getElementById("vms-prod-size-badge");
        if (sizeBadge) sizeBadge.style.display = "none";

        const shimmer = document.getElementById("vms-prod-shimmer");
        const imgEl = document.getElementById("vms-prod-img");
        const noImg = document.getElementById("vms-prod-no-img");
        const zoomBtn = document.getElementById("vms-prod-zoom-btn");
        const statusBanner = document.getElementById("vms-prod-status-banner");
        const statusText = document.getElementById("vms-prod-status-text");
        const qtyBanner = document.getElementById("vms-prod-qty-banner");
        const qtyText = document.getElementById("vms-prod-qty-text");
        const skuVal = document.getElementById("vms-prod-sku-val");
        const mpSkuVal = document.getElementById("vms-prod-mpsku-val");
        const prodName = document.getElementById("vms-prod-name");
        const awbEl = document.getElementById("vms-prod-awb");
        const subEl = document.getElementById("vms-prod-suborder");
        const miniSku = document.getElementById("vms-prod-mini-sku");
        const miniQty = document.getElementById("vms-prod-mini-qty");

        if (shimmer) shimmer.style.display = "flex";
        if (imgEl) { imgEl.style.display = "none"; imgEl.src = ""; }
        if (noImg) noImg.style.display = "none";
        if (zoomBtn) zoomBtn.style.display = "none";

        if (statusBanner && statusText) {
          statusBanner.className = "vms-prod-status-banner";
          statusText.textContent = "⏳ SCANNING...";
        }
        if (qtyBanner && qtyText) {
          qtyBanner.className = "vms-prod-qty-banner";
          qtyText.textContent = "Qty: ...";
        }
        if (skuVal) skuVal.textContent = "Loading...";
        if (mpSkuVal) mpSkuVal.textContent = "Loading...";
        if (prodName) prodName.textContent = "Searching EliteSecom OMS for product...";
        if (awbEl) awbEl.textContent = `AWB: ${awb}`;
        if (subEl) subEl.textContent = "";
        if (miniSku) miniSku.textContent = `AWB: ${awb}`;
        if (miniQty) miniQty.textContent = "Checking...";
      });
    } catch (e) {}
  }

  function updateProductCard(awb, result) {
    try {
      chrome.storage.local.get(["vmsImagePreviewEnabled"], (st) => {
        if (st && st.vmsImagePreviewEnabled === false) return;

        createProductPreviewOverlay();
        const overlay = document.getElementById("vms-product-overlay");
        if (!overlay) return;

        overlay.style.display = "block";

        const shimmer = document.getElementById("vms-prod-shimmer");
        const imgEl = document.getElementById("vms-prod-img");
        const noImg = document.getElementById("vms-prod-no-img");
        const zoomBtn = document.getElementById("vms-prod-zoom-btn");
        const statusBanner = document.getElementById("vms-prod-status-banner");
        const statusText = document.getElementById("vms-prod-status-text");
        const qtyBanner = document.getElementById("vms-prod-qty-banner");
        const qtyText = document.getElementById("vms-prod-qty-text");
        const skuVal = document.getElementById("vms-prod-sku-val");
        const mpSkuVal = document.getElementById("vms-prod-mpsku-val");
        const prodName = document.getElementById("vms-prod-name");
        const awbEl = document.getElementById("vms-prod-awb");
        const subEl = document.getElementById("vms-prod-suborder");
        const omsBadge = document.getElementById("vms-prod-oms-badge");
        const miniSku = document.getElementById("vms-prod-mini-sku");
        const miniQty = document.getElementById("vms-prod-mini-qty");

        if (shimmer) shimmer.style.display = "none";

        const type = (result && result.statusType) || (result && result.success ? "SUCCESS" : "ERROR");
        const omsSource = (result && result.omsSource) || "V2";
        if (omsBadge) omsBadge.textContent = omsSource;

        // Status Banner Styling
        if (statusBanner && statusText) {
          statusBanner.className = "vms-prod-status-banner";
          if (type === "SUCCESS") {
            statusBanner.classList.add("success");
            statusText.textContent = `✅ ${omsSource} DONE - READY TO PACK`;
            overlay.classList.remove("cancelled");
          } else if (type === "ALREADY_SCANNED") {
            statusBanner.classList.add("warning");
            statusText.textContent = `⚠️ ALREADY SCANNED`;
            overlay.classList.remove("cancelled");
          } else if (type === "CANCELLED") {
            statusBanner.classList.add("cancelled");
            statusText.textContent = `⛔ CANCELLED ORDER - DO NOT PACK!`;
            overlay.classList.add("cancelled");
          } else if (type === "NOT_FOUND") {
            statusBanner.classList.add("warning");
            statusText.textContent = `❌ NOT FOUND IN OMS`;
            overlay.classList.remove("cancelled");
          } else {
            statusBanner.classList.add("warning");
            statusText.textContent = `⚠️ ${result && result.message ? result.message : "SCAN ERROR"}`;
            overlay.classList.remove("cancelled");
          }
        }

        // Image URL Handling (Direct, Cache or Background Deep Lookup)
        const imgUrl = (result && (result.image_url || result.product_image)) || "";
        if (imgUrl) {
          if (imgEl) {
            imgEl.src = imgUrl;
            imgEl.style.display = "block";
          }
          if (noImg) noImg.style.display = "none";
          if (zoomBtn) zoomBtn.style.display = "block";
        } else {
          // Check local persistent caches first
          chrome.storage.local.get(["awb_product_cache", "vms_product_cache"], (cacheData) => {
            const cached = (cacheData.awb_product_cache && cacheData.awb_product_cache[awb]) ||
                           (cacheData.vms_product_cache && cacheData.vms_product_cache[awb]) || null;
            if (cached && (cached.image_url || cached.master_sku)) {
              if (cached.image_url && imgEl) {
                imgEl.src = cached.image_url;
                imgEl.style.display = "block";
                if (noImg) noImg.style.display = "none";
                if (zoomBtn) zoomBtn.style.display = "block";
              }
              if (cached.master_sku && skuVal && (!skuVal.textContent || skuVal.textContent === "-" || skuVal.textContent === "Loading..." || skuVal.textContent === awb)) {
                skuVal.textContent = cached.master_sku;
                if (miniSku) miniSku.textContent = `SKU: ${cached.master_sku}`;
              }
              if (mpSkuVal) {
                mpSkuVal.textContent = cached.marketplace_sku || cached.master_sku || "-";
              }
              if (cached.product_title && prodName && (!prodName.textContent || prodName.textContent.includes("Searching"))) {
                prodName.textContent = cached.product_title;
              }
              if (cached.quantity && cached.quantity > 1 && qtyBanner && qtyText) {
                qtyBanner.className = "vms-prod-qty-banner multi";
                qtyText.textContent = `🚨 MULTI-QTY: ${cached.quantity} PCS — PACK ALL!`;
                if (miniQty) miniQty.textContent = `Qty: ${cached.quantity}`;
              }
              renderSizeBadge(cached);
              return;
            }

            // If not found in cache, display placeholder and trigger background deep search
            if (imgEl) {
              imgEl.style.display = "none";
              imgEl.src = "";
            }
            if (noImg) noImg.style.display = "flex";
            if (zoomBtn) zoomBtn.style.display = "none";

            chrome.runtime.sendMessage({ action: "GET_PICKUP_ORDER_DETAILS", awb }, (details) => {
              if (chrome.runtime.lastError) return;
              if (details && (details.image_url || details.master_sku)) {
                if (details.image_url && imgEl) {
                  imgEl.src = details.image_url;
                  imgEl.style.display = "block";
                  if (noImg) noImg.style.display = "none";
                  if (zoomBtn) zoomBtn.style.display = "block";
                }
                if (details.master_sku && skuVal && (!skuVal.textContent || skuVal.textContent === "-" || skuVal.textContent === "Loading..." || skuVal.textContent === awb)) {
                  skuVal.textContent = details.master_sku;
                  if (miniSku) miniSku.textContent = `SKU: ${details.master_sku}`;
                }
                if (mpSkuVal) {
                  mpSkuVal.textContent = details.marketplace_sku || details.master_sku || "-";
                }
                if (details.product_title && prodName && (!prodName.textContent || prodName.textContent.includes("Searching"))) {
                  prodName.textContent = details.product_title;
                }
                if (details.quantity && details.quantity > 1 && qtyBanner && qtyText) {
                  qtyBanner.className = "vms-prod-qty-banner multi";
                  qtyText.textContent = `🚨 MULTI-QTY: ${details.quantity} PCS — PACK ALL!`;
                  if (miniQty) miniQty.textContent = `Qty: ${details.quantity}`;
                }
                renderSizeBadge(details);
              }
            });
          });
        }

        // Master SKU
        const masterSku = (result && (result.master_sku || result.sku)) || awb;
        if (skuVal) skuVal.textContent = masterSku;
        if (miniSku) miniSku.textContent = `SKU: ${masterSku}`;

        // MP SKU
        const mpSku = (result && (result.marketplace_sku || result.marketplaceSku)) ||
                      (result && result.master_sku) || "-";
        if (mpSkuVal) mpSkuVal.textContent = mpSku;

        // Title / Name
        const title = (result && (result.product_title || result.item_title)) || "-";
        if (prodName) prodName.textContent = title;

        // Size Badge Highlight
        renderSizeBadge(result);

        // AWB & Suborder
        if (awbEl) awbEl.textContent = `AWB: ${awb}`;
        if (subEl) {
          subEl.textContent = result && result.suborder_number ? `Sub: ${result.suborder_number}` : "";
        }

        // Quantity Display
        const qty = Number((result && result.quantity) || 1);
        if (qtyBanner && qtyText) {
          if (qty > 1) {
            qtyBanner.className = "vms-prod-qty-banner multi";
            qtyText.textContent = `🚨 MULTI-QTY: ${qty} PCS — PACK ALL ITEMS!`;
          } else {
            qtyBanner.className = "vms-prod-qty-banner";
            qtyText.textContent = `📦 Quantity: 1 Pc`;
          }
        }
        if (miniQty) miniQty.textContent = `Qty: ${qty}`;
      });
    } catch (e) {
      console.warn("[VMS-Sync] updateProductCard error:", e);
    }
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
      stateBadge.textContent = `${omsTag}ALREADY SCANNED`;
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

    try {
      updateProductCard(awb, result);
    } catch (e) {
      console.warn("[VMS-Sync] updateProductCard error:", e);
    }
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

    // Live Product Photo & Details intercepted directly from Flipkart VMS API
    if (event.data.type === "VMS_PRODUCT_DATA") {
      const { awb, product } = event.data;
      if (awb && product) {
        console.log("[VMS-Sync] Live product details captured from VMS response:", awb, product);
        chrome.storage.local.get(["vms_product_cache"], (d) => {
          const cache = d.vms_product_cache || {};
          cache[awb] = product;
          chrome.storage.local.set({ vms_product_cache: cache });
        });
        chrome.runtime.sendMessage({ action: "SAVE_PRODUCT_CACHE", awb, product });

        // If current verification card is showing this AWB, update it immediately!
        const awbEl = document.getElementById("vms-prod-awb");
        if (awbEl && awbEl.textContent && awbEl.textContent.includes(awb)) {
          const imgEl = document.getElementById("vms-prod-img");
          const noImg = document.getElementById("vms-prod-no-img");
          const zoomBtn = document.getElementById("vms-prod-zoom-btn");
          const skuVal = document.getElementById("vms-prod-sku-val");
          const mpSkuVal = document.getElementById("vms-prod-mpsku-val");
          const prodName = document.getElementById("vms-prod-name");
          const qtyBanner = document.getElementById("vms-prod-qty-banner");
          const qtyText = document.getElementById("vms-prod-qty-text");

          const img = product.image_url || product.product_image;
          if (img && imgEl) {
            imgEl.src = img;
            imgEl.style.display = "block";
            if (noImg) noImg.style.display = "none";
            if (zoomBtn) zoomBtn.style.display = "block";
          }
          if (product.master_sku && skuVal) {
            skuVal.textContent = product.master_sku;
          }
          if (mpSkuVal) {
            mpSkuVal.textContent = product.marketplace_sku || product.master_sku || "-";
          }
          if (product.product_title && prodName) {
            prodName.textContent = product.product_title;
          }
          if (product.quantity && product.quantity > 1 && qtyBanner && qtyText) {
            qtyBanner.className = "vms-prod-qty-banner multi";
            qtyText.textContent = `🚨 MULTI-QTY: ${product.quantity} PCS — PACK ALL!`;
          }
          renderSizeBadge(product);
        }
      }
      return;
    }

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
        showProductCardLoading(awb);
      } catch (e) {}

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
              try { updateProductCard(awb, { success: false, statusType: "ERROR", message: errMsg }); } catch (_) {}
            }
            return;
          }
          if (response) {
            updateOverlayStatus(awb, response);
            try { updateProductCard(awb, response); } catch (_) {}
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
