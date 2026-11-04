/**
 * VMS-Sync: Main World Interceptor
 * Injected into the page context of https://fkvms.synlabs.io/*
 * Hooks fetch and XMLHttpRequest to reliably detect AWB scans without breaking VMS camera/ui.
 * Also extracts product photos, SKUs, and order details from Flipkart VMS API responses!
 */

(function () {
  console.log("%c[Ugaan VMS-Sync] Interceptor Active on Flipkart VMS", "background: #1877F2; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;");

  let customFkPattern = "awb/scan";

  let activeSecondaryAwb = null;

  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "UPDATE_FK_PATTERN" && event.data.fkPattern) {
      customFkPattern = event.data.fkPattern.trim();
      console.log("[Ugaan VMS-Sync] Updated Flipkart scan pattern keyword to:", customFkPattern);
    }
    if (event.data && event.data.type === "UPDATE_MEESHO_BAG_LINK") {
      activeSecondaryAwb = event.data.secondaryAwb;
      console.log("%c[Ugaan VMS-Sync] Interceptor linked Meesho Bag ID: " + activeSecondaryAwb, "color: #ec4899; font-weight: bold;");
    }
  });

  // Auto-capture Synlabs Credentials
  let capturedAuthToken = null;
  let capturedFeedId = null;

  function captureSynlabsCredentials(headers, body, url) {
    try {
      let token = null;
      if (headers) {
        if (typeof headers.get === "function") {
          token = headers.get("Authorization") || headers.get("authorization");
        } else if (typeof headers === "object") {
          token = headers["Authorization"] || headers["authorization"] || headers["Authorization".toLowerCase()];
        }
      }
      if (token && typeof token === "string" && token.startsWith("Bearer ")) {
        const cleanTok = token.replace("Bearer ", "").trim();
        if (cleanTok && cleanTok.length > 20 && cleanTok !== capturedAuthToken) {
          capturedAuthToken = cleanTok;
          window.postMessage({
            source: "VMS_SYNC_PAGE",
            type: "SYNLABS_AUTH_CAPTURED",
            token: cleanTok
          }, "*");
        }
      }

      if (body) {
        try {
          const parsed = typeof body === "string" ? JSON.parse(body) : body;
          if (parsed && parsed.feedId && parsed.feedId !== capturedFeedId) {
            capturedFeedId = parsed.feedId;
            window.postMessage({
              source: "VMS_SYNC_PAGE",
              type: "SYNLABS_FEED_CAPTURED",
              feedId: parsed.feedId
            }, "*");
          }
        } catch (_) {}
      }

      if (url && typeof url === "string") {
        if (url.includes("signed") || url.includes("update?") || url.includes("connection")) {
          window.postMessage({
            source: "VMS_SYNC_PAGE",
            type: "SYNLABS_ENDPOINT_CAPTURED",
            url: url
          }, "*");
        }
      }
    } catch (_) {}
  }

  // Initial localStorage scan for Synlabs credentials
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const val = localStorage.getItem(k);
      if (!val) continue;
      if (k.toLowerCase().includes("token") || k.toLowerCase().includes("auth")) {
        const cleanTok = val.replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "");
        if (cleanTok.length > 20) {
          captureSynlabsCredentials({ Authorization: "Bearer " + cleanTok }, null, "localStorage");
        }
      }
      if (k.toLowerCase().includes("feed")) {
        const cleanFeed = val.replace(/^["']|["']$/g, "");
        if (cleanFeed.length > 5) {
          captureSynlabsCredentials(null, { feedId: cleanFeed }, "localStorage");
        }
      }
    }
  } catch (_) {}

  function isFkVmsScanUrl(url) {
    if (!url) return false;
    if (customFkPattern && url.includes(customFkPattern)) return true;
    return url.includes("/api/awb/scan") ||
           url.includes("/awb/scan") ||
           (url.includes("/awb/") && url.includes("signed")) ||
           url.includes("/scan/signed");
  }

  function extractAwbFromBody(body) {
    if (!body) return null;
    try {
      const parsed = typeof body === "string" ? JSON.parse(body) : body;
      return parsed.awb || parsed.awbNumber || parsed.awb_number || parsed.trackingId || parsed.barcode || null;
    } catch (e) {
      return null;
    }
  }

  // Deep scanner for product metadata in any Flipkart VMS response
  function extractProductFromPayload(data) {
    if (!data || typeof data !== "object") return null;
    let found = null;

    function deepSearch(obj, depth) {
      if (!obj || depth > 5 || found) return;
      if (Array.isArray(obj)) {
        for (const item of obj) deepSearch(item, depth + 1);
        return;
      }
      if (typeof obj !== "object") return;

      const img = obj.image_url || obj.product_image || obj.image || obj.imageUrl || obj.productImageUrl ||
                  obj.img_url || obj.img || obj.thumbnail ||
                  (Array.isArray(obj.images) && obj.images[0]) || "";
      const sku = obj.master_sku || obj.sku || obj.marketplace_sku || obj.seller_sku || obj.sellerSku || obj.fsn || "";
      const title = obj.product_title || obj.item_title || obj.title || obj.product_name || obj.name || "";
      const qty = Number(obj.quantity || obj.suborder_item_quantity || obj.qty || 1);
      const suborder = obj.suborder_number || obj.suborder_no || obj.subOrderNumber || obj.order_id || "";

      if (img || sku) {
        found = {
          image_url: img,
          product_image: img,
          master_sku: sku,
          marketplace_sku: obj.marketplace_sku || sku,
          product_title: title,
          quantity: isNaN(qty) || qty < 1 ? 1 : qty,
          suborder_number: suborder,
          source: "FLIPKART_VMS"
        };
        return;
      }

      for (const k of Object.keys(obj)) {
        if (typeof obj[k] === "object") {
          deepSearch(obj[k], depth + 1);
        }
      }
    }

    deepSearch(data, 0);
    return found;
  }

  let lastNotifiedAwb = "";
  let lastNotifiedTime = 0;

  function notifyAwbScan(awb, originUrl, triggerType) {
    if (!awb) return;
    const cleanAwb = String(awb).replace(/^[(\s]+|[)\s]+$/g, "").trim();
    if (!cleanAwb || cleanAwb.length < 5) return;

    const now = Date.now();
    if (lastNotifiedAwb === cleanAwb && (now - lastNotifiedTime < 3500)) {
      console.log(`[Ugaan VMS-Sync] Interceptor suppressed duplicate notification for ${cleanAwb} (${triggerType})`);
      return;
    }
    lastNotifiedAwb = cleanAwb;
    lastNotifiedTime = now;

    window.postMessage({
      source: "VMS_SYNC_PAGE",
      type: "AWB_SCANNED",
      awb: cleanAwb,
      url: originUrl || "",
      triggerType: triggerType || "NETWORK",
      timestamp: now
    }, "*");
  }

  function notifyProductData(awb, product) {
    if (!product || (!product.image_url && !product.master_sku)) return;
    window.postMessage({
      source: "VMS_SYNC_PAGE",
      type: "VMS_PRODUCT_DATA",
      awb: awb || "",
      product: product
    }, "*");
  }


  // =========================================================================
  // UGAAN CLOUD VMS VIDEO CLONER & SYNC
  // Clones packing video recordings / uploads to Flipkart VMS and relays to Ugaan Cloud
  // =========================================================================
  const capturedAwbChunks = {};
  const awbFinalizeTimers = {};
  const recentlyDispatchedAwbs = new Map();

  function getActiveAwbFromDom() {
    try {
      const syncEl = document.getElementById("vms-sync-awb-text");
      if (syncEl && syncEl.textContent) {
        const val = syncEl.textContent.trim();
        const low = val.toLowerCase();
        if (
          val.length >= 8 &&
          val.length <= 40 &&
          !low.includes("ready") &&
          !low.includes("login") &&
          !low.includes("scan") &&
          !low.includes("check")
        ) {
          return val;
        }
      }

      const inputs = document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"]');
      for (const inp of inputs) {
        const val = (inp.value || "").trim();
        const low = val.toLowerCase();
        if (
          val.length >= 8 &&
          val.length <= 40 &&
          !low.includes("feed") &&
          !low.includes("http") &&
          !low.includes("ready") &&
          !low.includes("login")
        ) {
          return val;
        }
      }

      const trackingEls = document.querySelectorAll('[class*="tracking"], [class*="awb"], [id*="tracking"], [id*="awb"]');
      for (const el of trackingEls) {
        const val = (el.textContent || "").trim();
        if (val.length >= 8 && val.length <= 40 && /^[a-zA-Z0-9_-]+$/.test(val)) {
          return val;
        }
      }
    } catch (_) {}
    return null;
  }

  function extractAwbFromUrl(url) {
    if (!url) return null;
    try {
      const trMatch = url.match(/[?&]trackingId=([^&#]+)/i);
      if (trMatch) return decodeURIComponent(trMatch[1]).trim();

      const awbParam = url.match(/[?&]awb=([^&#]+)/i);
      if (awbParam) return decodeURIComponent(awbParam[1]).trim();

      const fileMatch = url.match(/\/([A-Za-z0-9_\-]{8,35})(?:-[0-9a-fA-F]{8,})?/i);
      if (fileMatch) {
        const candidate = fileMatch[1].split("-")[0].trim();
        if (candidate.length >= 8 && candidate.length <= 35) {
          return candidate;
        }
      }
    } catch (_) {}
    return null;
  }

  function bufferVideoChunk(awb, rawBody, originUrl) {
    if (!awb) return;
    const cleanAwb = String(awb).replace(/^[(\s]+|[)\s]+$/g, "").trim();
    if (!cleanAwb || cleanAwb.length < 5) return;

    let chunkBlob = null;
    try {
      if (rawBody instanceof Blob) {
        chunkBlob = rawBody.slice(0, rawBody.size, rawBody.type || "video/webm");
      } else if (rawBody instanceof ArrayBuffer) {
        chunkBlob = new Blob([rawBody], { type: "video/webm" });
      } else if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(rawBody)) {
        chunkBlob = new Blob([rawBody.buffer], { type: "video/webm" });
      } else if (typeof FormData !== "undefined" && rawBody instanceof FormData) {
        for (const [k, v] of rawBody.entries()) {
          if (v instanceof Blob && v.size > 1000) {
            chunkBlob = v.slice(0, v.size, v.type || "video/webm");
            break;
          }
        }
      }
    } catch (e) {
      console.warn("[Ugaan VMS Cloner] Error extracting blob chunk:", e);
    }

    if (!chunkBlob || chunkBlob.size < 1000) return;

    if (!capturedAwbChunks[cleanAwb]) {
      if (Object.keys(capturedAwbChunks).length > 100) {
        for (const k of Object.keys(capturedAwbChunks)) {
          delete capturedAwbChunks[k];
        }
      }
      capturedAwbChunks[cleanAwb] = [];
    }
    capturedAwbChunks[cleanAwb].push(chunkBlob);
    console.log(`%c[Ugaan VMS Cloner] Buffered video chunk #${capturedAwbChunks[cleanAwb].length} (${chunkBlob.size} bytes) for AWB: ${cleanAwb}`, "color: #10b981; font-weight: bold;");

    // Debounce timer to auto-dispatch video (only for HTTP chunk uploads, NOT active MediaRecorder!)
    if (originUrl !== "MediaRecorder") {
      if (awbFinalizeTimers[cleanAwb]) {
        clearTimeout(awbFinalizeTimers[cleanAwb]);
      }
      awbFinalizeTimers[cleanAwb] = setTimeout(() => {
        dispatchClonedVideo(cleanAwb);
      }, 3500);
    }
  }

  function dispatchClonedVideo(awb, explicitBlob) {
    if (!awb) return;
    const cleanAwb = String(awb).replace(/^[(\s]+|[)\s]+$/g, "").trim();
    if (!cleanAwb || cleanAwb.length < 5) return;

    if (awbFinalizeTimers[cleanAwb]) {
      clearTimeout(awbFinalizeTimers[cleanAwb]);
      delete awbFinalizeTimers[cleanAwb];
    }

    const now = Date.now();
    const lastSent = recentlyDispatchedAwbs.get(cleanAwb);
    if (lastSent && (now - lastSent < 3000)) {
      console.log(`[Ugaan VMS Cloner] Suppressed duplicate video dispatch for ${cleanAwb}`);
      delete capturedAwbChunks[cleanAwb];
      return;
    }

    let finalBlob = explicitBlob;
    const chunks = capturedAwbChunks[cleanAwb];
    delete capturedAwbChunks[cleanAwb];

    if (!finalBlob && chunks && chunks.length > 0) {
      try {
        finalBlob = new Blob(chunks, { type: "video/webm" });
      } catch (err) {
        console.warn("[Ugaan VMS Cloner] Failed to combine video chunks:", err);
      }
    }

    if (!finalBlob || finalBlob.size < 1000) {
      return;
    }

    if (recentlyDispatchedAwbs.size > 200) {
      recentlyDispatchedAwbs.clear();
    }
    recentlyDispatchedAwbs.set(cleanAwb, now);

    try {
      console.log(`%c[Ugaan VMS Cloner] Video complete for AWB ${cleanAwb}: ${finalBlob.size} bytes. Relaying to Ugaan Cloud...`, "background: #10b981; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;");

      const reader = new FileReader();
      reader.onloadend = function () {
        const base64Data = reader.result;
        window.postMessage({
          source: "VMS_SYNC_PAGE",
          type: "CLONE_VIDEO_TO_UGAAN",
          awb: cleanAwb,
          secondaryAwb: activeSecondaryAwb,
          marketplace: activeSecondaryAwb ? "MEESHO" : "FLIPKART",
          videoDataUrl: base64Data,
          size: finalBlob.size
        }, "*");
        activeSecondaryAwb = null;
      };
      reader.readAsDataURL(finalBlob);
    } catch (err) {
      console.warn("[Ugaan VMS Cloner] Error creating video blob payload:", err);
    }
  }

  // Hook window.MediaRecorder for capturing packing video recordings directly on Flipkart VMS
  if (typeof window.MediaRecorder !== "undefined") {
    const OriginalMediaRecorder = window.MediaRecorder;
    window.MediaRecorder = function (stream, options) {
      const recorder = new OriginalMediaRecorder(stream, options);
      let recorderChunks = [];

      recorder.addEventListener("dataavailable", function (event) {
        if (event.data && event.data.size > 0) {
          recorderChunks.push(event.data);
          const activeAwb = getActiveAwbFromDom() || lastNotifiedAwb;
          if (activeAwb) {
            bufferVideoChunk(activeAwb, event.data, "MediaRecorder");
          }
        }
      });

      recorder.addEventListener("stop", function () {
        const activeAwb = getActiveAwbFromDom() || lastNotifiedAwb;
        console.log(`%c[Ugaan VMS Cloner] MediaRecorder stopped for AWB: ${activeAwb} (${recorderChunks.length} chunks)`, "color: #10b981; font-weight: bold;");
        if (activeAwb) {
          try {
            let fullBlob = null;
            if (recorderChunks.length > 0) {
              const mimeType = recorder.mimeType || (options && options.mimeType) || "video/webm";
              fullBlob = new Blob(recorderChunks, { type: mimeType });
            }
            dispatchClonedVideo(activeAwb, fullBlob);
          } catch (e) {
            console.warn("[Ugaan VMS Cloner] Error in MediaRecorder stop handler:", e);
          }
        }
        recorderChunks = [];
      });

      return recorder;
    };
    window.MediaRecorder.prototype = OriginalMediaRecorder.prototype;
    Object.setPrototypeOf(window.MediaRecorder, OriginalMediaRecorder);
    if (OriginalMediaRecorder.isTypeSupported) {
      window.MediaRecorder.isTypeSupported = OriginalMediaRecorder.isTypeSupported.bind(OriginalMediaRecorder);
    }
  }

  // 1. Hook window.fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let capturedAwb = null;
    let isTarget = false;
    try {
      const [resource, config] = args;
      const url = typeof resource === "string" ? resource : (resource && resource.url) || "";

      // Capture Synlabs credentials & endpoints
      captureSynlabsCredentials(config && config.headers, config && config.body, url);

      if (isFkVmsScanUrl(url)) {
        isTarget = true;
        const body = config && config.body;
        capturedAwb = extractAwbFromBody(body);
        if (capturedAwb) {
          notifyAwbScan(capturedAwb, url, "FETCH");
        }
      }
    } catch (err) {
      console.warn("[Ugaan VMS-Sync] Fetch inspect warning:", err);
    }

    // Inspect fetch payload for video chunks
    try {
      const [, config] = args;
      if (config && config.body) {
        const b = config.body;
        const isBin = (
          (b instanceof Blob && b.size > 1000) ||
          (b instanceof ArrayBuffer && b.byteLength > 1000) ||
          (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(b) && b.byteLength > 1000) ||
          (typeof FormData !== "undefined" && b instanceof FormData)
        );
        if (isBin) {
          const [res] = args;
          const u = typeof res === "string" ? res : (res && res.url) || "";
          const targetAwb = extractAwbFromUrl(u) || getActiveAwbFromDom() || lastNotifiedAwb;
          if (targetAwb) {
            bufferVideoChunk(targetAwb, b, u);
          }
        }
        const [res] = args;
        const u = typeof res === "string" ? res : (res && res.url) || "";
        if (u.includes("update?") || u.includes("/update")) {
          const finAwb = extractAwbFromUrl(u) || lastNotifiedAwb;
          if (finAwb) {
            setTimeout(() => dispatchClonedVideo(finAwb), 400);
          }
        }
      }
    } catch (_) {}

    const response = await originalFetch.apply(this, args);

    if (isTarget) {
      try {
        const clone = response.clone();
        clone.json().then(data => {
          const product = extractProductFromPayload(data);
          if (product) {
            console.log("[Ugaan VMS-Sync] Found product in VMS response:", product);
            notifyProductData(capturedAwb || lastNotifiedAwb, product);
          }
        }).catch(() => {});
      } catch (_) {}
    }

    return response;
  };

  // 2. Hook XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._vms_sync_url = url;
    this._vms_headers = {};
    return originalXhrOpen.call(this, method, url, ...rest);
  };

  const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (!this._vms_headers) this._vms_headers = {};
    this._vms_headers[header] = value;
    return origSetRequestHeader.call(this, header, value);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      const url = this._vms_sync_url || "";

      // Capture Synlabs credentials & endpoints
      captureSynlabsCredentials(this._vms_headers, body, url);

      // 1. Intercept video chunk uploads (Blob / ArrayBuffer > 10KB)
      const isBinaryChunk = body && (
        (body instanceof Blob && body.size > 1000) ||
        (body instanceof ArrayBuffer && body.byteLength > 1000) ||
        (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(body) && body.byteLength > 1000) ||
        (typeof FormData !== "undefined" && body instanceof FormData)
      );

      if (isBinaryChunk) {
        const awbFromUrl = extractAwbFromUrl(url);
        const targetAwb = awbFromUrl || getActiveAwbFromDom() || lastNotifiedAwb;
        if (targetAwb) {
          bufferVideoChunk(targetAwb, body, url);
        }
      }

      // 2. Intercept video finalization (update?trackingId=...)
      if (url.includes("update?") || url.includes("/update")) {
        const finAwb = extractAwbFromUrl(url) || lastNotifiedAwb;
        if (finAwb) {
          setTimeout(() => dispatchClonedVideo(finAwb), 400);
        }
      }

      // 3. Existing Flipkart AWB scan detection
      if (isFkVmsScanUrl(url)) {
        const awb = extractAwbFromBody(body);
        if (awb) {
          notifyAwbScan(awb, url, "XHR");
          const self = this;
          this.addEventListener("load", function () {
            try {
              const data = JSON.parse(self.responseText);
              const product = extractProductFromPayload(data);
              if (product) {
                console.log("[Ugaan VMS-Sync] Found product in XHR response:", product);
                notifyProductData(awb, product);
              }
            } catch (_) {}
          });
        }
      }
    } catch (err) {
      console.warn("[Ugaan VMS-Sync] XHR inspect warning:", err);
    }
    return originalXhrSend.call(this, body);
  };

  // 3. Fallback: Input keydown watcher (Enter key on AWB input box)
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const hash = (window.location.hash || "").toLowerCase();
      if (hash.includes("login")) return;

      const target = e.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (target.type === "password") return;
        const ph = (target.placeholder || "").toLowerCase();
        if (ph.includes("feed") || ph.includes("username") || ph.includes("password")) return;

        const id = (target.id || "").toLowerCase();
        if (id.includes("feed") || id.includes("login") || id.includes("pass")) return;

        const bodyText = document.body ? (document.body.innerText || "") : "";
        if (bodyText.includes("Connect to Feed") || bodyText.includes("Scan the Feed Id on your Desk")) return;

        const val = (target.value || "").trim();
        // AWB barcodes are typically 8 to 40 characters
        if (val.length >= 8 && val.length <= 40) {
          notifyAwbScan(val, "DOM_INPUT", "KEYBOARD");
        }
      }
    }
  }, true);


  // Watch for Flipkart VMS "Stop" button click to immediately prepare cloned video
  document.addEventListener("click", function (e) {
    try {
      const btn = e.target && (e.target.closest("button") || e.target);
      if (!btn) return;
      const txt = (btn.innerText || btn.textContent || "").trim().toUpperCase();
      if (txt === "STOP" || txt.includes("STOP")) {
        const activeAwb = getActiveAwbFromDom() || lastNotifiedAwb;
        if (activeAwb) {
          console.log(`[Ugaan VMS Cloner] Stop button clicked for AWB: ${activeAwb}`);
          setTimeout(() => {
            dispatchClonedVideo(activeAwb);
          }, 600);
        }
      }
    } catch (_) {}
  }, true);

})();
