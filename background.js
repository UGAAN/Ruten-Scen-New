// Ugaan Return Scan & VMS-Sync - Background Service Worker

const RULE_ID_V2_RETURN = 1001;
const RULE_ID_V1_RETURN = 1002;
const RULE_ID_V2_PICKUP = 1003;
const RULE_ID_V1_PICKUP = 1004;

function setupHeaderRules() {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID_V2_RETURN, RULE_ID_V1_RETURN, RULE_ID_V2_PICKUP, RULE_ID_V1_PICKUP],
    addRules: [
      {
        id: RULE_ID_V2_RETURN,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            {
              header: "Referer",
              operation: "set",
              value: "https://my.elitesecom.ai/scanorders/return-entry"
            },
            {
              header: "Origin",
              operation: "set",
              value: "https://my.elitesecom.ai"
            }
          ]
        },
        condition: {
          urlFilter: "https://my.elitesecom.ai/*",
          resourceTypes: ["xmlhttprequest"]
        }
      },
      {
        id: RULE_ID_V1_RETURN,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            {
              header: "Referer",
              operation: "set",
              value: "https://oms.elitesecom.ai/scanorders/return-entry"
            },
            {
              header: "Origin",
              operation: "set",
              value: "https://oms.elitesecom.ai"
            }
          ]
        },
        condition: {
          urlFilter: "https://oms.elitesecom.ai/*",
          resourceTypes: ["xmlhttprequest"]
        }
      },
      {
        id: RULE_ID_V2_PICKUP,
        priority: 2,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            {
              header: "Referer",
              operation: "set",
              value: "https://my.elitesecom.ai/scanorders/pickup-entry"
            },
            {
              header: "Origin",
              operation: "set",
              value: "https://my.elitesecom.ai"
            }
          ]
        },
        condition: {
          urlFilter: "||my.elitesecom.ai/api/scanorders/pickup/*",
          resourceTypes: ["xmlhttprequest", "other"]
        }
      },
      {
        id: RULE_ID_V1_PICKUP,
        priority: 2,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            {
              header: "Referer",
              operation: "set",
              value: "https://oms.elitesecom.ai/scanorders/pickup-entry"
            },
            {
              header: "Origin",
              operation: "set",
              value: "https://oms.elitesecom.ai"
            }
          ]
        },
        condition: {
          urlFilter: "||oms.elitesecom.ai/api/pickup-scan*",
          resourceTypes: ["xmlhttprequest", "other"]
        }
      }
    ]
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn("Error setting declarativeNetRequest rules:", chrome.runtime.lastError);
    } else {
      console.log("DeclarativeNetRequest rules set: Referer & Origin headers attached for Return and Pickup on V2 & V1");
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupHeaderRules();
  performSelfHealingSessionCheck();
  checkAndResetDailyStats();
});

chrome.runtime.onStartup.addListener(() => {
  setupHeaderRules();
  performSelfHealingSessionCheck();
  checkAndResetDailyStats();
});

// Also run immediately
setupHeaderRules();
performSelfHealingSessionCheck();
checkAndResetDailyStats();

// Helper to map return condition strings safely for V1 vs V2
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
      // V2 database only allows good/damaged/wrong/repair/received. Missing items are categorized under 'wrong'
      return "wrong";
    }
    return "good";
  }
}

// Helper to normalize V1 order into standard extension format
function normalizeV1Order(raw, awb) {
  const isCancelledOrZeroReturn = Boolean(
    (raw.return_quantity !== undefined && raw.return_quantity !== null && Number(raw.return_quantity) === 0) ||
    (raw.status && raw.status.toLowerCase().includes('cancel')) ||
    (raw.order_status && raw.order_status.toLowerCase().includes('cancel')) ||
    (raw.return_type && raw.return_type.toLowerCase().includes('cancel'))
  );

  const parsedQty = Number(raw.return_quantity || raw.suborder_item_quantity || raw.quantity || 1);
  const safeQty = parsedQty > 0 ? parsedQty : Number(raw.quantity || raw.suborder_item_quantity || 1);

  return {
    _oms_source: "V1",
    oms_source: "V1",
    id: raw.suborder_number || raw.order_number || Date.now(),
    raw_data: raw,
    master_sku: raw.sku || raw.master_sku || "-",
    marketplace_sku: raw.sku || raw.marketplace_sku || "-",
    marketplace: raw.marketplace || "-",
    suborder_number: raw.suborder_number || raw.order_number || "-",
    suborder_no: raw.suborder_number || raw.order_number || "-",
    return_awb_number: raw.return_awb_number || raw.awb_number || awb,
    awb: raw.return_awb_number || raw.awb_number || awb,
    return_quantity: safeQty,
    quantity: safeQty,
    return_status: raw.return_received_quantity ? "received" : (isCancelledOrZeroReturn ? "cancelled" : "pending"),
    return_type: isCancelledOrZeroReturn ? "Cancelled Order" : (raw.return_type || "Customer Return"),
    is_cancelled: isCancelledOrZeroReturn,
    fource: isCancelledOrZeroReturn,
    image_url: raw.product_image || "",
    product_image: raw.product_image || "",
    rtn_reason: raw.rtn_reason || (isCancelledOrZeroReturn ? "Cancelled" : "")
  };
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

// Helper to perform V2 Login with Native Cookie Jar Synchronization
async function performV2Login(email, password) {
  if (!email || !password) return { success: false, error: "Missing V2 email or password" };
  try {
    console.log(`⚡ [V2 Auto-Login] Authenticating ${email} on my.elitesecom.ai...`);
    const res = await fetch("https://my.elitesecom.ai/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: email, login: email, password: password })
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    const isSuccess = res.ok && (!data || (data.status !== "error" && data.success !== false && !data.error));
    if (isSuccess) {
      // Direct Chrome Cookie Jar Injection (Zero-Tab Persistent Auth)
      if (data && data.session_id) {
        try {
          await chrome.cookies.set({
            url: "https://my.elitesecom.ai",
            name: "session_id",
            value: String(data.session_id).trim(),
            path: "/",
            secure: true,
            sameSite: "lax"
          });
          console.log("🍪 [V2 Auto-Login] session_id cookie written to Chrome jar successfully!");
        } catch (cErr) {
          console.warn("[V2 Auto-Login] Cookie set warning:", cErr);
        }
      }

      chrome.storage.local.set({
        v2_logged_in: true,
        oms_logged_in: true,
        v2_session_id: (data && data.session_id) || "",
        v2_session_checked_at: Date.now()
      });
      return { success: true, message: "V2 Login Successful", data };
    }
    return { success: false, error: (data && (data.message || data.error)) || `V2 Login Failed (HTTP ${res.status})`, data };
  } catch (err) {
    return { success: false, error: "Network error: " + err.message };
  }
}

// Helper to perform V1 Login with Native Cookie Jar Synchronization
async function performV1Login(email, password) {
  if (!email || !password) return { success: false, error: "Missing V1 email or password" };
  try {
    console.log(`⚡ [V1 Auto-Login] Authenticating ${email} on oms.elitesecom.ai...`);
    const res = await fetch("https://oms.elitesecom.ai/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: email, password: password })
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    const isSuccess = res.ok && (!data || (data.status_code === 200 || data.success === true || !data.error));
    if (isSuccess) {
      // Direct Chrome Cookie Jar Injection for V1 x_session
      if (data && data.userDetails) {
        try {
          const sessionObj = {
            uid: String(data.userDetails.uid || ""),
            token: data.userDetails.token || "",
            email: data.userDetails.email || email,
            locationId: data.userDetails.locationId || "",
            sid: data.userDetails.sid || "",
            is_child: Boolean(data.userDetails.is_child)
          };
          const xSessionVal = encodeURIComponent(JSON.stringify(sessionObj));
          await chrome.cookies.set({
            url: "https://oms.elitesecom.ai",
            name: "x_session",
            value: xSessionVal,
            path: "/",
            secure: true
          });
          console.log("🍪 [V1 Auto-Login] x_session cookie written to Chrome jar successfully!");
        } catch (cErr) {
          console.warn("[V1 Auto-Login] Cookie set warning:", cErr);
        }
      }

      chrome.storage.local.set({
        v1_logged_in: true,
        oms_logged_in: true,
        v1_token: (data && data.userDetails && data.userDetails.token) || "",
        v1_session_checked_at: Date.now()
      });
      return { success: true, message: "V1 Login Successful", data };
    }
    return { success: false, error: (data && (data.message || data.error)) || `V1 Login Failed (HTTP ${res.status})`, data };
  } catch (err) {
    return { success: false, error: "Network error: " + err.message };
  }
}

// 🛡️ Proactive Self-Healing Keep-Alive (Like Meesho Engine in Flipkart_OTC_Hub)
async function performSelfHealingSessionCheck() {
  try {
    const creds = await chrome.storage.local.get([
      "v2_login_email", "v2_login_password",
      "v1_login_email", "v1_login_password",
      "auto_login_enabled"
    ]);

    if (creds.auto_login_enabled === false) return;

    // 1. Check & Self-Heal V2 (my.elitesecom.ai - Jkstyle)
    if (creds.v2_login_email && creds.v2_login_password) {
      try {
        const v2Res = await fetch("https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ search_type: "return_awb", value: "__CHECK_AUTH__" })
        });
        const v2Text = await v2Res.text();
        let v2Data = null;
        try { v2Data = JSON.parse(v2Text); } catch (e) {}
        const v2Expired = v2Res.redirected || isV2SessionExpired(v2Res.status, v2Text, v2Data);
        if (v2Expired) {
          console.log("⚡ [Self-Healing] V2 session expired. Automatically re-authenticating in background...");
          await performV2Login(creds.v2_login_email, creds.v2_login_password);
        } else {
          chrome.storage.local.set({ v2_logged_in: true, oms_logged_in: true, v2_session_checked_at: Date.now() });
        }
      } catch (err) {
        console.warn("[Self-Healing] V2 health check error:", err);
      }
    }

    // 2. Check & Self-Heal V1 (oms.elitesecom.ai - Ugaan)
    if (creds.v1_login_email && creds.v1_login_password) {
      try {
        const v1Res = await fetch("https://oms.elitesecom.ai/api/return_order_data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ awbNumber: "__CHECK_AUTH__", refrenceCode: "", subOrderNumber: "" })
        });
        const v1Text = await v1Res.text();
        let v1Data = null;
        try { v1Data = JSON.parse(v1Text); } catch (e) {}
        const v1Expired = v1Res.redirected || isV1SessionExpired(v1Res.status, v1Text, v1Data);
        if (v1Expired) {
          console.log("⚡ [Self-Healing] V1 session expired. Automatically re-authenticating in background...");
          await performV1Login(creds.v1_login_email, creds.v1_login_password);
        } else {
          chrome.storage.local.set({ v1_logged_in: true, oms_logged_in: true, v1_session_checked_at: Date.now() });
        }
      } catch (err) {
        console.warn("[Self-Healing] V1 health check error:", err);
      }
    }
  } catch (outerErr) {
    console.warn("[Self-Healing] Session runner error:", outerErr);
  }
}

// =========================================================================
// FLIPKART VMS -> ELITESECOM DUAL OMS AUTO-PICKUP ENGINE
// =========================================================================

const DEFAULT_PICKUP_V2_URL = "https://my.elitesecom.ai/api/scanorders/pickup/pickup_scan";
const DEFAULT_PICKUP_V1_URL = "https://oms.elitesecom.ai/api/pickup-scan";

function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function checkAndResetDailyStats() {
  const today = getTodayDateString();
  const data = await chrome.storage.local.get(["todayDate"]);
  if (data.todayDate !== today) {
    await chrome.storage.local.set({
      todayDate: today,
      todaySuccess: 0,
      todayFailed: 0,
      todayCancelled: 0
    });
  }
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

// Deep inspect message & content from EliteSecom response
function extractServerDetails(res) {
  let serverMsg = "";
  let fullDump = "";
  const json = res && res.json;

  if (json) {
    try {
      fullDump = JSON.stringify(json).toLowerCase();
    } catch (_) {}

    if (typeof json.message === "string" && json.message.trim()) {
      serverMsg = json.message.trim();
    } else if (typeof json.error === "string" && json.error.trim()) {
      serverMsg = json.error.trim();
    } else if (typeof json.msg === "string" && json.msg.trim()) {
      serverMsg = json.msg.trim();
    } else if (typeof json.errorMessage === "string" && json.errorMessage.trim()) {
      serverMsg = json.errorMessage.trim();
    } else if (json.data) {
      if (typeof json.data.message === "string" && json.data.message.trim()) {
        serverMsg = json.data.message.trim();
      } else if (typeof json.data.error === "string" && json.data.error.trim()) {
        serverMsg = json.data.error.trim();
      } else if (typeof json.data.msg === "string" && json.data.msg.trim()) {
        serverMsg = json.data.msg.trim();
      } else if (typeof json.data.order_status === "string" && json.data.order_status.trim()) {
        serverMsg = `Order status: ${json.data.order_status.trim()}`;
      } else if (typeof json.data.status === "string" && json.data.status.trim()) {
        serverMsg = `Status: ${json.data.status.trim()}`;
      } else if (Array.isArray(json.data) && json.data[0]) {
        const item = json.data[0];
        serverMsg = typeof item === "string" ? item : (item.message || item.error || item.msg || item.order_status || item.status || "");
      }
    } else if (Array.isArray(json.errors) && json.errors.length > 0) {
      serverMsg = json.errors.map(e => typeof e === "string" ? e : (e.message || JSON.stringify(e))).join(", ");
    }
  }

  if (!serverMsg && res && res.text) {
    serverMsg = res.text.length < 200 ? res.text.trim() : res.text.slice(0, 150).trim();
  }
  if (!fullDump && res && res.text) {
    fullDump = String(res.text).toLowerCase();
  }

  return { serverMsg: String(serverMsg || "").trim(), fullDump };
}

// Thorough check for cancellation keywords anywhere in the message or JSON body
function checkIsCancelled(fullDump, serverMsg) {
  const combined = ((fullDump || "") + " " + (serverMsg || "")).toLowerCase();
  return combined.includes("cancel") || 
         combined.includes("cancelled") || 
         combined.includes("canceled") || 
         combined.includes("cancellation") ||
         combined.includes("order_status\":\"cancelled") ||
         combined.includes("suborder_status\":\"cancelled") ||
         combined.includes("status\":\"cancelled") ||
         combined.includes("is_cancelled\":true") ||
         combined.includes("is_cancelled\": 1") ||
         combined.includes("cancelled by customer") ||
         combined.includes("buyer cancelled") ||
         combined.includes("customer cancelled") ||
         combined.includes("already cancelled");
}

function isResultSuccessfulOrHandled(res) {
  if (!res) return false;
  if (res.isExpired) return false;

  const { serverMsg, fullDump } = extractServerDetails(res);
  const combined = (fullDump + " " + serverMsg).toLowerCase();

  // 1. If it's cancelled in this OMS, DO NOT FALLBACK!
  if (checkIsCancelled(fullDump, serverMsg)) {
    return true;
  }

  // 2. If it's already scanned in this OMS, DO NOT FALLBACK!
  if (res.status === 409 || combined.includes("already") || combined.includes("previously picked") || combined.includes("duplicate")) {
    return true;
  }

  // 3. If explicit "Not Found" or "Does not exist", then we SHOULD fallback
  if (res.status === 404 || 
      combined.includes("not found") || 
      combined.includes("does not exist") || 
      combined.includes("invalid number") ||
      combined.includes("invalid awb") ||
      combined.includes("no order available")) {
    return false;
  }

  // 4. If status 200 OK
  if (res.status === 200) {
    if (res.json && (res.json.status === 404 || res.json.status_code === 404)) {
      return false;
    }
    return true;
  }

  return false;
}

// Direct Pickup Request to V2 (with auto-login retry via performV2Login)
async function requestPickupV2(cleanAwb, courier, autoLogin, creds) {
  async function callV2() {
    // 1. Check if in-tab message possible via elite_content.js
    try {
      const tabs = await chrome.tabs.query({ url: "*://my.elitesecom.ai/*" });
      if (tabs && tabs.length > 0) {
        const tabRes = await new Promise((resResolve) => {
          const t = setTimeout(() => resResolve(null), 5000);
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "SCAN_AWB_IN_ELITE",
            awb: cleanAwb,
            courier: courier || "all"
          }, (resp) => {
            clearTimeout(t);
            resResolve(chrome.runtime.lastError ? null : resp);
          });
        });
        if (tabRes && tabRes.status !== undefined) {
          return { resStatus: tabRes.status, json: tabRes.json, text: tabRes.text, ok: tabRes.ok };
        }
      }
    } catch (e) {}

    // 2. Direct fetch
    const res = await fetch(DEFAULT_PICKUP_V2_URL, {
      method: "POST",
      headers: {
        "accept": "*/*",
        "content-type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        awbNumber: cleanAwb,
        location_key: [],
        courier: courier || "all",
        marketplace: []
      })
    });
    let json = null;
    let text = "";
    try {
      text = await res.text();
      json = JSON.parse(text);
    } catch (e) {}
    return { resStatus: res.status, json, text, ok: res.ok };
  }

  let result = await callV2();
  let isExpired = isV2SessionExpired(result.resStatus, result.text, result.json);

  const email = creds.v2_login_email || creds.v2LoginEmail;
  const pass = creds.v2_login_password || creds.v2LoginPassword;

  if (isExpired && autoLogin && email && pass) {
    console.log("[VMS-Sync] V2 session expired during pickup, auto-logging in via cookie jar...");
    const loginRes = await performV2Login(email, pass);
    if (loginRes.success) {
      console.log("[VMS-Sync] V2 auto-login success, retrying pickup scan directly with fresh cookie...");
      try {
        const directRes = await fetch(DEFAULT_PICKUP_V2_URL, {
          method: "POST",
          headers: { "accept": "*/*", "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ awbNumber: cleanAwb, location_key: [], courier: courier || "all", marketplace: [] })
        });
        let directJson = null;
        let directText = "";
        try { directText = await directRes.text(); directJson = JSON.parse(directText); } catch (e) {}
        result = { resStatus: directRes.status, json: directJson, text: directText, ok: directRes.ok };
        isExpired = isV2SessionExpired(result.resStatus, result.text, result.json);
      } catch (err) {
        result = await callV2();
        isExpired = isV2SessionExpired(result.resStatus, result.text, result.json);
      }
    }
  }

  return {
    oms_source: "V2",
    status: result.resStatus,
    ok: result.ok,
    json: result.json,
    text: result.text,
    isExpired
  };
}

// Direct Pickup Request to V1 (with auto-login retry via performV1Login)
async function requestPickupV1(cleanAwb, courier, autoLogin, creds) {
  async function callV1() {
    // 1. Check if in-tab message possible via elite_content.js
    try {
      const tabs = await chrome.tabs.query({ url: "*://oms.elitesecom.ai/*" });
      if (tabs && tabs.length > 0) {
        const tabRes = await new Promise((resResolve) => {
          const t = setTimeout(() => resResolve(null), 5000);
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "SCAN_AWB_IN_ELITE",
            awb: cleanAwb,
            courier: courier || "all"
          }, (resp) => {
            clearTimeout(t);
            resResolve(chrome.runtime.lastError ? null : resp);
          });
        });
        if (tabRes && tabRes.status !== undefined) {
          return { resStatus: tabRes.status, json: tabRes.json, text: tabRes.text, ok: tabRes.ok };
        }
      }
    } catch (e) {}

    // 2. Direct fetch
    const res = await fetch(DEFAULT_PICKUP_V1_URL, {
      method: "POST",
      headers: {
        "accept": "*/*",
        "content-type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        number: cleanAwb,
        location_key: null,
        courier: courier || "all",
        marketplace: []
      })
    });
    let json = null;
    let text = "";
    try {
      text = await res.text();
      json = JSON.parse(text);
    } catch (e) {}
    return { resStatus: res.status, json, text, ok: res.ok };
  }

  let result = await callV1();
  let isExpired = isV1SessionExpired(result.resStatus, result.text, result.json);

  const email = creds.v1_login_email || creds.v1LoginEmail;
  const pass = creds.v1_login_password || creds.v1LoginPassword;

  if (isExpired && autoLogin && email && pass) {
    console.log("[VMS-Sync] V1 session expired during pickup, auto-logging in via cookie jar...");
    const loginRes = await performV1Login(email, pass);
    if (loginRes.success) {
      console.log("[VMS-Sync] V1 auto-login success, retrying pickup scan directly with fresh cookie...");
      try {
        const directRes = await fetch(DEFAULT_PICKUP_V1_URL, {
          method: "POST",
          headers: { "accept": "*/*", "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ number: cleanAwb, location_key: null, courier: courier || "all", marketplace: [] })
        });
        let directJson = null;
        let directText = "";
        try { directText = await directRes.text(); directJson = JSON.parse(directText); } catch (e) {}
        result = { resStatus: directRes.status, json: directJson, text: directText, ok: directRes.ok };
        isExpired = isV1SessionExpired(result.resStatus, result.text, result.json);
      } catch (err) {
        result = await callV1();
        isExpired = isV1SessionExpired(result.resStatus, result.text, result.json);
      }
    }
  }

  return {
    oms_source: "V1",
    status: result.resStatus,
    ok: result.ok,
    json: result.json,
    text: result.text,
    isExpired
  };
}

// Master Dual Pickup Execution with Priority & Auto-Fallback
async function executeDualPickupScan(awb) {
  await checkAndResetDailyStats();
  const settings = await chrome.storage.local.get([
    "syncEnabled", "courier", "scanLogs", "todaySuccess", "todayFailed", "todayCancelled",
    "omsPriority", "oms_priority", "autoLoginEnabled", "auto_login_enabled",
    "v1LoginEmail", "v1LoginPassword", "v1_login_email", "v1_login_password",
    "v2LoginEmail", "v2LoginPassword", "v2_login_email", "v2_login_password",
    "sheetSyncEnabled", "sheetUrl"
  ]);

  if (settings.syncEnabled === false) {
    return {
      success: false,
      skipped: true,
      statusType: "WARNING",
      awb,
      message: "Sync PAUSED in settings."
    };
  }

  const cleanAwb = String(awb).replace(/^[(\s]+|[)\s]+$/g, "").trim();
  const priority = settings.omsPriority || (settings.oms_priority === "v1" ? "auto_v1_first" : "auto_v2_first");
  const autoLogin = settings.autoLoginEnabled !== false && settings.auto_login_enabled !== false;

  let primaryRes = null;
  let secondaryRes = null;
  let finalRes = null;

  if (priority === "only_v2") {
    finalRes = await requestPickupV2(cleanAwb, settings.courier, autoLogin, settings);
  } else if (priority === "only_v1") {
    finalRes = await requestPickupV1(cleanAwb, settings.courier, autoLogin, settings);
  } else if (priority === "auto_v1_first") {
    primaryRes = await requestPickupV1(cleanAwb, settings.courier, autoLogin, settings);
    const isV1Found = isResultSuccessfulOrHandled(primaryRes);
    if (isV1Found) {
      finalRes = primaryRes;
    } else {
      console.log("[VMS-Sync] Order not in V1 or error, falling back to V2...");
      secondaryRes = await requestPickupV2(cleanAwb, settings.courier, autoLogin, settings);
      finalRes = secondaryRes;
    }
  } else {
    // Default: auto_v2_first
    primaryRes = await requestPickupV2(cleanAwb, settings.courier, autoLogin, settings);
    const isV2Found = isResultSuccessfulOrHandled(primaryRes);
    if (isV2Found) {
      finalRes = primaryRes;
    } else {
      console.log("[VMS-Sync] Order not in V2 or error, falling back to V1...");
      secondaryRes = await requestPickupV1(cleanAwb, settings.courier, autoLogin, settings);
      finalRes = secondaryRes;
    }
  }

  return recordResult(cleanAwb, finalRes, settings);
}

// Record Result for Pickup Scans
async function recordResult(awb, res, settings) {
  let statusType = "ERROR";
  let { serverMsg, fullDump } = extractServerDetails(res);
  const omsSource = (res && res.oms_source) || "V2";
  const combined = (fullDump + " " + serverMsg).toLowerCase();

  // 1. Session Expiration
  if (res.isExpired || res.status === 401 || res.status === 403 || combined.includes("session cookie not found") || combined.includes("not authenticated")) {
    statusType = "AUTH_EXPIRED";
    serverMsg = `${omsSource} Session Expired (Please Login)`;
  }
  // 2. CANCELLED (TOP PRIORITY: Even if text has "already", cancellation takes immediate precedence!)
  else if (checkIsCancelled(fullDump, serverMsg)) {
    statusType = "CANCELLED";
    serverMsg = "CANCELLED ORDER";
  }
  // 3. ALREADY SCANNED (Previously Picked)
  else if (res.status === 409 || combined.includes("already") || combined.includes("previously picked") || combined.includes("duplicate")) {
    statusType = "ALREADY_SCANNED";
    if (!serverMsg) serverMsg = "Suborders have already been picked up.";
  }
  // 4. NOT FOUND
  else if (res.status === 404 || combined.includes("not found") || combined.includes("does not exist")) {
    statusType = "NOT_FOUND";
    if (!serverMsg) serverMsg = `Order not found in ${omsSource}`;
  }
  // 5. HTTP 200 OK
  else if (res.status === 200) {
    const isError = res.json && (
      res.json.success === false || 
      res.json.status === false || 
      res.json.status === "error" || 
      res.json.status === "failed" || 
      res.json.error || 
      (typeof res.json.status_code === "number" && res.json.status_code !== 200) ||
      (typeof res.json.status === "number" && res.json.status !== 200)
    );

    if (isError) {
      statusType = "ERROR";
      if (!serverMsg) serverMsg = `${omsSource} Scan Error`;
    } else {
      statusType = "SUCCESS";
      if (!serverMsg) serverMsg = `${omsSource} Pickup Done`;
    }
  }
  // 6. Generic HTTP Error
  else {
    statusType = "ERROR";
    if (!serverMsg) serverMsg = `${omsSource} Error ${res.status}`;
  }

  const isSuccess = statusType === "SUCCESS";
  const isWarning = statusType === "ALREADY_SCANNED";
  const isCancelled = statusType === "CANCELLED";
  const now = Date.now();
  const timeStr = new Date().toLocaleTimeString('en-IN', { hour12: true });

  let logs = settings.scanLogs || [];
  const existingIndex = logs.findIndex(item => item.awb === awb && (now - (item.startTimestamp || item.id || 0) < 15 * 60 * 1000));

  let startTimestamp = now;
  let startTime = timeStr;
  let durationStr = "-";
  let diffSec = 0;

  if (existingIndex !== -1) {
    startTimestamp = logs[existingIndex].startTimestamp || logs[existingIndex].id || now;
    startTime = logs[existingIndex].startTime || logs[existingIndex].time || timeStr;
    diffSec = Math.max(1, Math.round((now - startTimestamp) / 1000));
    durationStr = formatSeconds(diffSec);

    // If it was already marked SUCCESS in this packing session, keep it as SUCCESS on closing scan!
    if (logs[existingIndex].statusType === "SUCCESS" && statusType === "ALREADY_SCANNED") {
      statusType = "SUCCESS";
      serverMsg = `Packed (${durationStr})`;
    }

    logs[existingIndex].endTime = timeStr;
    logs[existingIndex].endTimestamp = now;
    logs[existingIndex].duration = durationStr;
    logs[existingIndex].durationSec = diffSec;
    logs[existingIndex].videoStatus = "DONE";
    logs[existingIndex].statusType = statusType;
    logs[existingIndex].omsSource = omsSource;
    logs[existingIndex].success = (statusType === "SUCCESS");
    logs[existingIndex].status = res.status;
    logs[existingIndex].message = serverMsg;
  } else {
    logs.unshift({
      id: now,
      startTimestamp: now,
      endTimestamp: now,
      awb: awb,
      omsSource: omsSource,
      time: timeStr,
      startTime: timeStr,
      endTime: timeStr,
      duration: "-",
      durationSec: 0,
      videoStatus: "DONE",
      statusType: statusType,
      success: isSuccess,
      status: res.status,
      message: serverMsg
    });
    if (logs.length > 500) logs = logs.slice(0, 500);
  }

  const finalIsSuccess = statusType === "SUCCESS";
  const finalIsWarning = statusType === "ALREADY_SCANNED";
  const finalIsCancelled = statusType === "CANCELLED";

  let successCount = (settings.todaySuccess || 0) + (finalIsSuccess && existingIndex === -1 ? 1 : 0);
  let failedCount = (settings.todayFailed || 0) + (!finalIsSuccess && !finalIsWarning && !finalIsCancelled && existingIndex === -1 ? 1 : 0);
  let cancelledCount = (settings.todayCancelled || 0) + (finalIsCancelled && existingIndex === -1 ? 1 : 0);

  await chrome.storage.local.set({
    scanLogs: logs,
    todaySuccess: successCount,
    todayFailed: failedCount,
    todayCancelled: cancelledCount
  });

  // Live Google Sheets Sync for Pickup
  if (settings.sheetSyncEnabled && settings.sheetUrl) {
    postToGoogleSheet(settings.sheetUrl, {
      timestamp: new Date().toISOString(),
      date: getTodayDateString(),
      time: timeStr,
      awb: awb,
      omsSource: omsSource,
      statusType: statusType,
      success: finalIsSuccess,
      courier: settings.courier || "all",
      message: serverMsg
    }).then(sheetRes => {
      console.log("[VMS-Sync] Google Sheet Pickup Sync result:", sheetRes);
    }).catch(err => {
      console.warn("[VMS-Sync] Google Sheet Pickup Sync error:", err);
    });
  }

  return {
    awb,
    omsSource,
    success: finalIsSuccess,
    statusType: statusType,
    status: res.status,
    message: serverMsg,
    startTime: startTime,
    endTime: timeStr,
    duration: durationStr,
    videoStatus: "DONE"
  };
}

// In-Flight Scans and Recent Scan Cache to guarantee NO double-push to OMS
const activeInFlightScans = new Map(); // cleanAwb -> Promise
const recentCompletedScans = new Map(); // cleanAwb -> { result, timestamp }

// Timeout Wrapper for Pickup Scan with Deduplication Lock
async function handleEliteScanWithTimeout(awb) {
  const cleanAwb = String(awb || "").replace(/^[(\s]+|[)\s]+$/g, "").trim();
  if (!cleanAwb) {
    return { success: false, statusType: "ERROR", message: "Invalid AWB" };
  }

  const now = Date.now();

  // 1. If this exact AWB was completed within the last 4 seconds, return cached result!
  if (recentCompletedScans.has(cleanAwb)) {
    const cached = recentCompletedScans.get(cleanAwb);
    if (now - cached.timestamp < 4000) {
      console.log(`[VMS-Sync] Duplicate scan suppressed for ${cleanAwb}, returning cached result.`);
      return cached.result;
    }
  }

  // 2. If a scan is currently IN-FLIGHT for this exact AWB, piggyback on the same promise!
  if (activeInFlightScans.has(cleanAwb)) {
    console.log(`[VMS-Sync] Scan already in-flight for ${cleanAwb}, awaiting existing promise.`);
    return activeInFlightScans.get(cleanAwb);
  }

  const scanPromise = (async () => {
    let timer = null;
    try {
      const timeoutPromise = new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve({
            awb: cleanAwb,
            success: false,
            statusType: "ERROR",
            status: 408,
            message: "Timeout: EliteSecom server not responding."
          });
        }, 9000);
      });

      const scanExecPromise = executeDualPickupScan(cleanAwb);
      const res = await Promise.race([scanExecPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      return res;
    } catch (err) {
      if (timer) clearTimeout(timer);
      return {
        awb: cleanAwb,
        success: false,
        statusType: "ERROR",
        message: err.message || "Scan error"
      };
    } finally {
      activeInFlightScans.delete(cleanAwb);
    }
  })();

  activeInFlightScans.set(cleanAwb, scanPromise);

  const finalResult = await scanPromise;
  recentCompletedScans.set(cleanAwb, { result: finalResult, timestamp: Date.now() });

  // Keep recent cache size manageable
  if (recentCompletedScans.size > 200) {
    const earliestKey = recentCompletedScans.keys().next().value;
    recentCompletedScans.delete(earliestKey);
  }

  return finalResult;
}

// Google Sheets Sync Helper (compatible with both Apps Script endpoints)
async function postToGoogleSheet(url, payload) {
  if (!url) return { success: false, error: "No Sheet URL configured" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    if (json && json.result === "success") {
      return { success: true, count: json.count || 1 };
    }
    if (res.ok) {
      return { success: true, raw: text };
    }
    return { success: false, error: text.slice(0, 100) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Pure On-Demand / Just-In-Time (JIT) Execution:
// Clear all background alarms so no background timer runs continuously
try {
  if (chrome.alarms) {
    chrome.alarms.clearAll();
  }
} catch (_) {}

// Background Update Detector
let initialLocalSignal = null;
let updateAvailable = false;

async function checkBackgroundUpdates() {
  try {
    const localUrl = chrome.runtime.getURL("update_signal.txt?t=" + Date.now());
    const res = await fetch(localUrl, { cache: "no-store" });
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text) {
        if (initialLocalSignal === null) {
          initialLocalSignal = text;
        } else if (text !== initialLocalSignal) {
          updateAvailable = true;
          console.log("[VMS-Sync] Local update detected on disk!");
        }
      }
    }

    // Check GitHub raw signal
    const gitRes = await fetch("https://raw.githubusercontent.com/UGAAN/Ruten-Scen-New/main/update_signal.txt?t=" + Date.now(), { cache: "no-store" });
    if (gitRes.ok) {
      const gitText = (await gitRes.text()).trim();
      if (gitText && initialLocalSignal && gitText !== initialLocalSignal) {
        updateAvailable = true;
        console.log("[VMS-Sync] Remote update detected on GitHub!");
      }
    }
  } catch (e) {}
}

setInterval(checkBackgroundUpdates, 40000);
checkBackgroundUpdates();

// Listen for messages from popup, content script, or scanner page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CHECK_UPDATE") {
    sendResponse({ updateAvailable });
    return true;
  }

  if (request.action === "RELOAD_EXTENSION") {
    sendResponse({ success: true });
    setTimeout(() => {
      chrome.runtime.reload();
    }, 200);
    return true;
  }

  // --- VMS Pickup Sync Actions ---
  if (request.action === "SYNC_AWB_TO_ELITE") {
    handleEliteScanWithTimeout(request.awb)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({
        success: false,
        statusType: "ERROR",
        awb: request.awb,
        message: err.message || "Request Error"
      }));
    return true;
  }

  if (request.action === "GET_STATS") {
    checkAndResetDailyStats().then(async () => {
      const stats = await chrome.storage.local.get([
        "syncEnabled", "soundEnabled", "soundVolume", "courier",
        "omsPriority", "oms_priority", "autoLoginEnabled", "auto_login_enabled",
        "v1LoginEmail", "v1LoginPassword", "v1_login_email", "v1_login_password",
        "v2LoginEmail", "v2LoginPassword", "v2_login_email", "v2_login_password",
        "sheetSyncEnabled", "sheetUrl",
        "todaySuccess", "todayFailed", "todayCancelled", "todayDate",
        "v1_logged_in", "v2_logged_in", "scanLogs"
      ]);
      sendResponse(stats);
    });
    return true;
  }

  if (request.action === "CHECK_CONNECTION") {
    chrome.storage.local.get(["v2_logged_in", "v1_logged_in"], async (st) => {
      if (st.v2_logged_in === undefined || st.v1_logged_in === undefined) {
        await performSelfHealingSessionCheck();
        const updated = await chrome.storage.local.get(["v2_logged_in", "v1_logged_in"]);
        sendResponse(updated);
      } else {
        sendResponse(st);
      }
    });
    return true;
  }

  if (request.action === "LOGIN_V1") {
    performV1Login(request.email, request.password).then(sendResponse);
    return true;
  }

  if (request.action === "LOGIN_V2") {
    performV2Login(request.email, request.password).then(sendResponse);
    return true;
  }

  if (request.action === "TEST_SHEET_SYNC") {
    postToGoogleSheet(request.url, {
      test: true,
      timestamp: new Date().toISOString(),
      message: "Ugaan VMS-Sync Connection Test",
      awb: "TEST_AWB_123456",
      omsSource: "TEST",
      statusType: "SUCCESS"
    }).then(sendResponse);
    return true;
  }

  if (request.action === "OPEN_ELITE_TAB") {
    const targetUrl = request.panel === "v1" 
      ? "https://oms.elitesecom.ai/scanorders/pickup-entry"
      : "https://my.elitesecom.ai/scanorders/pickup-entry";
    chrome.tabs.create({ url: targetUrl });
    sendResponse({ ok: true });
    return true;
  }
  if (request.action === "open_scanner_tab") {
    const scannerUrl = chrome.runtime.getURL("scanner.html");
    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs.find(t => t.url && t.url.startsWith(scannerUrl));
      if (existingTab) {
        // Switch to the existing scanner tab immediately
        chrome.tabs.update(existingTab.id, { active: true });
        if (existingTab.windowId) {
          chrome.windows.update(existingTab.windowId, { focused: true });
        }
        sendResponse({ status: "success", tabId: existingTab.id, action: "focused" });
      } else {
        // Create new active tab with scanner station
        chrome.tabs.create({ url: scannerUrl, active: true }, (tab) => {
          sendResponse({ status: "success", tabId: tab.id, action: "created" });
        });
      }
    });
    return true;
  }

  // Handle Order Data Fetch with Automatic Fallback (Priority-aware: V1 First / V2 First)
  if (request.action === "get_return_order") {
    const rawAwb = String(request.awb || "").trim();
    const awb = rawAwb.replace(/^[(\s"'\[]+|[)\s"'\]]+$/g, "").replace(/^[\t\r\n]+|[\t\r\n]+$/g, "").trim().toUpperCase();
    if (!awb) {
      sendResponse({ success: false, not_found: true, message: "Invalid AWB barcode" });
      return false;
    }

    (async () => {
      const creds = await chrome.storage.local.get(["oms_priority", "v1_login_email", "v1_login_password", "v2_login_email", "v2_login_password", "auto_login_enabled"]);
      const priority = creds.oms_priority || "v2";

      async function checkV2() {
        let v2Data = null;
        let v2LoginRequired = false;
        try {
          const v2Res = await fetch("https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ search_type: "return_awb", value: awb })
          });
          const v2Text = await v2Res.text();
          try { v2Data = JSON.parse(v2Text); } catch (e) {}
          v2LoginRequired = (v2Res.redirected && v2Res.url && v2Res.url.includes("login")) || isV2SessionExpired(v2Res.status, v2Text, v2Data);

          if (v2LoginRequired && creds.auto_login_enabled !== false && creds.v2_login_email && creds.v2_login_password) {
            const loginRes = await performV2Login(creds.v2_login_email, creds.v2_login_password);
            if (loginRes.success) {
              const retryRes = await fetch("https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ search_type: "return_awb", value: awb })
              });
              try { v2Data = await retryRes.json(); } catch (e) {}
              v2LoginRequired = isV2SessionExpired(retryRes.status, "", v2Data);
            }
          }

          // Fallback search by forward_awb for Flipkart / Ekart RTOs
          if (!v2LoginRequired && (!v2Data || !v2Data.return_orders || v2Data.return_orders.length === 0)) {
            try {
              const fwdRes = await fetch("https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ search_type: "forward_awb", value: awb })
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
              const subRes = await fetch("https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ search_type: "suborder_number", value: awb })
              });
              const subText = await subRes.text();
              let subData = null;
              try { subData = JSON.parse(subText); } catch (e) {}
              if (subData && subData.success && subData.return_orders && subData.return_orders.length > 0) {
                v2Data = subData;
              }
            } catch (e) {}
          }
        } catch (err) {
          console.warn("[Background] V2 search error:", err);
        }

        if (v2Data && v2Data.success && v2Data.return_orders && v2Data.return_orders.length > 0) {
          v2Data.oms_source = "V2";
          v2Data._oms_source = "V2";
          v2Data.return_orders.forEach(o => {
            o._oms_source = "V2";
            o.oms_source = "V2";
            o.awb = o.return_awb_number || o.forward_awb || o.awb || awb;
            o.image_url = o.image_url || o.product_image || (o.images && o.images[0]) || "";
            if (o.is_received === true || o.is_received === 1 || o.is_received === "1" || (o.received_date && o.received_date !== "-")) {
              o.return_status = "received";
            }
          });
          return { found: true, data: v2Data, loginRequired: false };
        }
        return { found: false, data: null, loginRequired: v2LoginRequired };
      }

      async function checkV1() {
        let v1Data = null;
        let v1LoginRequired = false;
        try {
          const v1Res = await fetch("https://oms.elitesecom.ai/api/return_order_data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ awbNumber: awb, refrenceCode: "", subOrderNumber: "" })
          });
          const v1Text = await v1Res.text();
          try { v1Data = JSON.parse(v1Text); } catch (e) {}
          v1LoginRequired = (v1Res.redirected && v1Res.url && v1Res.url.includes("login")) || isV1SessionExpired(v1Res.status, v1Text, v1Data);

          if (v1LoginRequired && creds.auto_login_enabled !== false && creds.v1_login_email && creds.v1_login_password) {
            const loginRes = await performV1Login(creds.v1_login_email, creds.v1_login_password);
            if (loginRes.success) {
              const retryRes = await fetch("https://oms.elitesecom.ai/api/return_order_data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ awbNumber: awb, refrenceCode: "", subOrderNumber: "" })
              });
              try { v1Data = await retryRes.json(); } catch (e) {}
              v1LoginRequired = isV1SessionExpired(retryRes.status, "", v1Data);
            }
          }

          // Fallback search by subOrderNumber or refrenceCode
          if (!v1LoginRequired && (!v1Data || !v1Data.orders || v1Data.orders.length === 0)) {
            try {
              const subRes = await fetch("https://oms.elitesecom.ai/api/return_order_data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ awbNumber: "", refrenceCode: awb, subOrderNumber: awb })
              });
              const subData = await subRes.json();
              if (subData && subData.orders && subData.orders.length > 0) {
                v1Data = subData;
              }
            } catch (e) {}
          }
        } catch (err) {
          console.warn("[Background] V1 search error:", err);
        }

        if (v1Data && v1Data.orders && v1Data.orders.length > 0) {
          const normalizedOrders = v1Data.orders.map(o => normalizeV1Order(o, awb));
          return {
            found: true,
            data: {
              success: true,
              oms_source: "V1",
              _oms_source: "V1",
              return_orders: normalizedOrders,
              orders: v1Data.orders
            },
            loginRequired: false
          };
        }
        return { found: false, data: null, loginRequired: v1LoginRequired };
      }

      let firstRes = null;
      let secondRes = null;
      const isV2Priority = priority !== "v1"; // Default: V2 First (my.elitesecom.ai - Jkstyle)

      if (isV2Priority) {
        firstRes = await checkV2();
        if (firstRes.found) {
          sendResponse(firstRes.data);
          return;
        }
        secondRes = await checkV1();
        if (secondRes.found) {
          sendResponse(secondRes.data);
          return;
        }
      } else {
        firstRes = await checkV1();
        if (firstRes.found) {
          sendResponse(firstRes.data);
          return;
        }
        secondRes = await checkV2();
        if (secondRes.found) {
          sendResponse(secondRes.data);
          return;
        }
      }

      const v1LoginReq = isV2Priority ? (secondRes && secondRes.loginRequired) : (firstRes && firstRes.loginRequired);
      const v2LoginReq = isV2Priority ? (firstRes && firstRes.loginRequired) : (secondRes && secondRes.loginRequired);

      if (v1LoginReq && v2LoginReq) {
        sendResponse({ success: false, sessionExpired: true, message: "Both V1 and V2 sessions expired." });
        return;
      } else if (v1LoginReq) {
        sendResponse({ success: false, sessionExpired: true, panel: "V1", message: "V1 session expired." });
        return;
      } else if (v2LoginReq) {
        sendResponse({ success: false, sessionExpired: true, panel: "V2", message: "V2 session expired." });
        return;
      }

      // Check scan_mode setting for smart auto fallback on same-day cancel
      const settings = await chrome.storage.local.get(["scan_mode"]);
      const mode = settings.scan_mode || "auto";

      if (mode === "auto") {
        console.log(`[Background] AWB ${awb} not found in Detail Mode. Attempting direct return scan for Same Day Cancel...`);
        // 1. Try V2 direct return scan
        try {
          const directRes = await fetch("https://my.elitesecom.ai/api/scanorders/return/return_scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              awbNumber: awb,
              return_condition: mapConditionForOms(request.condition, "V2")
            })
          });
          const directText = await directRes.text();
          let directData = null;
          try { directData = JSON.parse(directText); } catch (e) {}

          if (directData && directData.success) {
            const ord = (directData.order || directData.data || {});
            sendResponse({
              success: true,
              oms_source: "V2",
              _oms_source: "V2",
              is_same_day_cancel: true,
              already_submitted: true,
              return_orders: [{
                _oms_source: "V2",
                oms_source: "V2",
                id: ord.id || Date.now(),
                master_sku: ord.master_sku || ord.sku || "Same Day Cancel",
                marketplace_sku: ord.marketplace_sku || ord.sku || "-",
                marketplace: ord.marketplace || "-",
                suborder_number: ord.suborder_number || ord.suborder_no || awb,
                awb: awb,
                return_quantity: 1,
                quantity: 1,
                return_status: "Submitted",
                return_type: "Same Day Cancel",
                is_same_day_cancel: true,
                image_url: ord.image_url || ord.product_image || ""
              }],
              message: directData.message || "Same Day Cancel Scanned"
            });
            return;
          }
        } catch (err) {
          console.warn("[Background] Same-day cancel V2 fallback error:", err);
        }

        // 2. Try V1 direct return scan (ee-scanOrders with fource: true)
        try {
          let v1Suborder = awb;
          let v1Ord = null;
          try {
            const v1Lookup = await fetch("https://oms.elitesecom.ai/api/return_order_data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ awbNumber: awb, refrenceCode: "", subOrderNumber: "" })
            });
            const v1LookData = await v1Lookup.json();
            if (v1LookData && v1LookData.orders && v1LookData.orders[0]) {
              v1Ord = v1LookData.orders[0];
              v1Suborder = v1Ord.suborder_number || v1Ord.order_number || awb;
            }
          } catch (e) {}

          const v1DirectRes = await fetch("https://oms.elitesecom.ai/api/ee-scanOrders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              suborderNumber: String(v1Suborder),
              return_condition: mapConditionForOms(request.condition, "V1"),
              fource: true,
              location_key: null
            })
          });
          const v1DirectText = await v1DirectRes.text();
          let v1DirectData = null;
          try { v1DirectData = JSON.parse(v1DirectText); } catch (e) {}

          if (v1DirectRes.status === 200 && (!v1DirectData || v1DirectData.status_code === 200 || v1DirectData.success === true)) {
            sendResponse({
              success: true,
              oms_source: "V1",
              _oms_source: "V1",
              is_same_day_cancel: true,
              already_submitted: true,
              return_orders: [{
                _oms_source: "V1",
                oms_source: "V1",
                id: (v1Ord && v1Ord.suborder_number) || Date.now(),
                master_sku: (v1Ord && (v1Ord.sku || v1Ord.master_sku)) || "Cancelled Order",
                marketplace_sku: (v1Ord && (v1Ord.sku || v1Ord.marketplace_sku)) || "-",
                marketplace: (v1Ord && v1Ord.marketplace) || "Meesho",
                suborder_number: v1Suborder,
                awb: awb,
                return_quantity: 1,
                quantity: 1,
                return_status: "Submitted",
                return_type: "Cancelled Order",
                is_same_day_cancel: true,
                image_url: (v1Ord && v1Ord.product_image) || ""
              }],
              message: (v1DirectData && v1DirectData.message) || "V1 Cancelled Order Scanned"
            });
            return;
          }
        } catch (err) {
          console.warn("[Background] Same-day cancel V1 fallback error:", err);
        }
      }

      sendResponse({
        success: false,
        not_found: true,
        message: "Order not found in V1 or V2."
      });
    })();

    return true; // Keep channel open for async response
  }

  // Handle Return Submission API (Dynamic Routing: V1 vs V2 with Auto-Relogin)
  if (request.action === "submit_return_scan") {
    request.awb = String(request.awb || "").replace(/^[(\s"'\[]+|[)\s"'\]]+$/g, "").trim().toUpperCase();
    const isV1 = request.oms_source === "V1" || request._oms_source === "V1";

    (async () => {
      if (isV1) {
        // Submit to V1 (oms.elitesecom.ai)
        const conditionVal = mapConditionForOms(request.condition, "V1");

        let targetSuborder = String(request.suborder_number || request.suborderNumber || "");
        let targetQty = Number(request.quantity || 1);
        const shouldForce = Boolean(request.fource || request.is_cancelled || request.fource === true);

        // Suborder number is essential in V1 ee-scanOrders. If missing or equal to AWB barcode, resolve it:
        if ((!targetSuborder || targetSuborder === "-" || targetSuborder === String(request.awb)) && request.awb) {
          try {
            const lookupRes = await fetch("https://oms.elitesecom.ai/api/return_order_data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ awbNumber: request.awb, refrenceCode: request.awb, subOrderNumber: request.awb })
            });
            const lookupData = await lookupRes.json();
            if (lookupData && lookupData.orders && lookupData.orders[0]) {
              targetSuborder = lookupData.orders[0].suborder_number || lookupData.orders[0].order_number || targetSuborder;
              targetQty = Number(lookupData.orders[0].suborder_item_quantity || lookupData.orders[0].quantity || targetQty || 1);
            }
          } catch (e) {}
        }

        async function doSubmitV1(forceParam = shouldForce) {
          const isForced = Boolean(forceParam || shouldForce || request.is_cancelled || Number(request.return_quantity) === 0);
          const v1Body = {
            suborderNumber: String(targetSuborder || request.awb || ""),
            return_condition: conditionVal,
            fource: isForced,
            location_key: null
          };
          // CRITICAL FOR V1: When order is cancelled or fource: true, NEVER send receive_quantity!
          // Sending receive_quantity > 0 causes V1 backend 400 error "receive_quantity (1) cannot exceed returned quantity (0)"
          if (!isForced && targetQty > 0) {
            v1Body.receive_quantity = Number(targetQty);
          }

          const res = await fetch("https://oms.elitesecom.ai/api/ee-scanOrders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(v1Body)
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch (e) {}
          const isAuthError = isV1SessionExpired(res.status, text, data);
          const isSuccess = !isAuthError && res.status === 200 && (!data || data.status_code === 200 || data.success === true || (!data.error && data.status !== 401));
          return { res, data, text, isAuthError, isSuccess };
        }

        let result = await doSubmitV1();
        if (result.isAuthError) {
          const creds = await chrome.storage.local.get(["v1_login_email", "v1_login_password", "auto_login_enabled"]);
          if (creds.auto_login_enabled !== false && creds.v1_login_email && creds.v1_login_password) {
            const loginRes = await performV1Login(creds.v1_login_email, creds.v1_login_password);
            if (loginRes.success) {
              result = await doSubmitV1();
            }
          }
        }

        if (result.isAuthError) {
          sendResponse({ success: false, sessionExpired: true, oms_source: "V1" });
          return;
        }

        // Auto-Force Retry for Cancelled or 0-quantity returns in V1
        if (!result.isSuccess && !result.isAuthError && result.text && (
          result.text.toLowerCase().includes("cannot exceed returned quantity") ||
          result.text.toLowerCase().includes("returned quantity (0)") ||
          result.text.toLowerCase().includes("cancel") ||
          result.text.toLowerCase().includes("force")
        )) {
          console.warn("[Background] V1 returned quantity limit reached. Retrying with fource: true without receive_quantity...");
          result = await doSubmitV1(true);
        }

        if (!result.isSuccess && result.text && result.text.includes("cannot exceed returned quantity")) {
          console.warn("[Background] V1 return qty is 0 after force. Retrying on V2 (Jkstyle)...");
          const v2Fallback = await fetch("https://my.elitesecom.ai/api/scanorders/return/return_scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              awbNumber: request.awb,
              return_condition: mapConditionForOms(request.condition, "V2")
            })
          });
          const v2Text = await v2Fallback.text();
          let v2Data = null;
          try { v2Data = JSON.parse(v2Text); } catch (e) {}
          if (v2Data && v2Data.success) {
            sendResponse({
              success: true,
              oms_source: "V2",
              _oms_source: "V2",
              data: v2Data,
              message: v2Data.message || "Submitted to V2"
            });
            return;
          }
        }

        sendResponse({
          success: result.isSuccess,
          oms_source: "V1",
          data: result.data,
          message: (result.data && result.data.message) || result.text
        });

      } else {
        // Submit to V2 (my.elitesecom.ai)
        async function doSubmitV2(customCondition) {
          const conditionToSend = customCondition || mapConditionForOms(request.condition, "V2");
          const res = await fetch("https://my.elitesecom.ai/api/scanorders/return/return_scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              awbNumber: request.awb,
              return_condition: conditionToSend
            })
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch (e) {}
          const isAuthError = isV2SessionExpired(res.status, text, data) || res.redirected;
          return { res, data, text, isAuthError, isSuccess: Boolean(data && data.success) };
        }

        let result = await doSubmitV2();
        if (result.isAuthError) {
          const creds = await chrome.storage.local.get(["v2_login_email", "v2_login_password", "auto_login_enabled"]);
          if (creds.auto_login_enabled !== false && creds.v2_login_email && creds.v2_login_password) {
            const loginRes = await performV2Login(creds.v2_login_email, creds.v2_login_password);
            if (loginRes.success) {
              result = await doSubmitV2();
            }
          }
        }

        // Auto-Retry for 500 Internal Server Error (e.g. backend database enum crash)
        if (!result.isSuccess && !result.isAuthError && (result.res.status === 500 || (result.text && result.text.includes("Internal Server Error")))) {
          console.warn("[Background] V2 returned 500 Internal Server Error. Retrying with safe fallback condition 'wrong'...");
          const retryRes = await doSubmitV2("wrong");
          if (retryRes.isSuccess) {
            result = retryRes;
          }
        }

        if (result.isAuthError) {
          sendResponse({ success: false, sessionExpired: true, oms_source: "V2" });
          return;
        }

        if (result.data) result.data.oms_source = "V2";
        sendResponse(result.data || { success: result.isSuccess });
      }
    })().catch((err) => {
      sendResponse({ success: false, error: err.message });
    });

    return true; // Keep channel open for async response
  }

  // Probe OMS Authentication Session for Both Panels (with On-Demand JIT Auto-Healing)
  if (request.action === "check_oms_session") {
    (async () => {
      const creds = await chrome.storage.local.get([
        "v2_login_email", "v2_login_password",
        "v1_login_email", "v1_login_password",
        "auto_login_enabled"
      ]);

      async function checkAndHealV2() {
        try {
          const res = await fetch("https://my.elitesecom.ai/api/scanorders/return/get_return_orders_data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ search_type: "return_awb", value: "__CHECK_AUTH__" })
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch (e) {}
          const isExpired = isV2SessionExpired(res.status, text, data) || (res.redirected && res.url && res.url.includes("login"));
          if (!isExpired && res.status === 200) return true;

          // JIT Auto-login if expired and credentials exist
          if (creds.auto_login_enabled !== false && creds.v2_login_email && creds.v2_login_password) {
            console.log("⚡ [JIT Auto-Login] V2 session expired during check. Authenticating on-demand...");
            const loginRes = await performV2Login(creds.v2_login_email, creds.v2_login_password);
            return Boolean(loginRes.success);
          }
          return false;
        } catch (_) {
          return false;
        }
      }

      async function checkAndHealV1() {
        try {
          const res = await fetch("https://oms.elitesecom.ai/api/return_order_data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ awbNumber: "__CHECK_AUTH__", refrenceCode: "", subOrderNumber: "" })
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch (e) {}
          const isExpired = isV1SessionExpired(res.status, text, data) || (res.redirected && res.url && res.url.includes("login"));
          if (!isExpired && res.status === 200) return true;

          // JIT Auto-login if expired and credentials exist
          if (creds.auto_login_enabled !== false && creds.v1_login_email && creds.v1_login_password) {
            console.log("⚡ [JIT Auto-Login] V1 session expired during check. Authenticating on-demand...");
            const loginRes = await performV1Login(creds.v1_login_email, creds.v1_login_password);
            return Boolean(loginRes.success);
          }
          return false;
        } catch (_) {
          return false;
        }
      }

      const [v2LoggedIn, v1LoggedIn] = await Promise.all([checkAndHealV2(), checkAndHealV1()]);

      chrome.storage.local.set({
        oms_logged_in: v2LoggedIn || v1LoggedIn,
        v2_logged_in: v2LoggedIn,
        v1_logged_in: v1LoggedIn,
        oms_session_checked_at: Date.now()
      });

      sendResponse({
        success: true,
        v2_logged_in: v2LoggedIn,
        v1_logged_in: v1LoggedIn,
        loggedIn: v2LoggedIn || v1LoggedIn
      });
    })().catch(() => {
      sendResponse({ success: false, v2_logged_in: false, v1_logged_in: false, loggedIn: false });
    });
    return true;
  }

  // Cross-Tab Broadcast for OMS Auth Changes (from OMS content script or login tab)
  if (request.action === "oms_auth_change") {
    const loggedIn = Boolean(request.loggedIn);
    const panel = request.panel; // 'v2' or 'v1'

    chrome.storage.local.get(["v2_logged_in", "v1_logged_in"], (res) => {
      let v2LoggedIn = res.v2_logged_in;
      let v1LoggedIn = res.v1_logged_in;

      if (panel === "v2") v2LoggedIn = loggedIn;
      else if (panel === "v1") v1LoggedIn = loggedIn;
      else {
        v2LoggedIn = loggedIn;
        v1LoggedIn = loggedIn;
      }

      const anyLoggedIn = Boolean(v2LoggedIn || v1LoggedIn);

      chrome.storage.local.set({
        oms_logged_in: anyLoggedIn,
        v2_logged_in: v2LoggedIn,
        v1_logged_in: v1LoggedIn,
        oms_session_checked_at: Date.now()
      });

      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              action: "oms_auth_updated",
              panel: panel,
              loggedIn: loggedIn,
              v2_logged_in: v2LoggedIn,
              v1_logged_in: v1LoggedIn,
              anyLoggedIn: anyLoggedIn
            }).catch(() => {});
          }
        });
      });
    });

    sendResponse({ success: true, broadcasted: true });
    return true;
  }

  // Live Google Sheet Sync Handler (Bypasses CORS and reads true Apps Script response)
  if (request.action === "sync_to_google_sheet") {
    const { url, payload } = request;
    if (!url) {
      sendResponse({ success: false, error: "No Google Sheet Web App URL provided." });
      return true;
    }

    // Standard POST to Google Apps Script Web App
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}

        if (json && json.result === 'success') {
          sendResponse({ success: true, count: json.count || 1 });
        } else if (json && json.result === 'error') {
          sendResponse({ success: false, error: json.error });
        } else if (res.ok) {
          sendResponse({ success: true, raw: text });
        } else if (res.status === 404 || (text && text.includes('unable to open the file'))) {
          sendResponse({
            success: false,
            status: 404,
            error: "Web App URL Not Found (HTTP 404): In Google Sheet Apps Script, ensure: 1) Deploy > 'Who has access' is set to 'Anyone', 2) The URL ends with /exec, and 3) Copy the complete Web App URL without missing letters."
          });
        } else if (res.status === 401 || res.status === 403 || (text && text.includes('accounts.google.com'))) {
          sendResponse({
            success: false,
            status: res.status,
            error: "Google Sheet Access Denied: In Apps Script Deploy settings, set 'Who has access' to 'Anyone'."
          });
        } else {
          const cleanErr = text && text.includes('<html') ? `HTTP ${res.status}: Check Web App URL deployment in Google Sheet.` : text;
          sendResponse({
            success: false,
            status: res.status,
            error: cleanErr
          });
        }
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }

  // Login to V2 (my.elitesecom.ai)
  if (request.action === "login_oms_v2") {
    performV2Login(request.email, request.password).then(sendResponse);
    return true;
  }

  // Login to V1 (oms.elitesecom.ai)
  if (request.action === "login_oms_v1") {
    performV1Login(request.email, request.password).then(sendResponse);
    return true;
  }

  // Attempt automatic re-login using saved credentials
  if (request.action === "auto_login_oms") {
    chrome.storage.local.get([
      "v2_login_email",
      "v2_login_password",
      "v1_login_email",
      "v1_login_password",
      "auto_login_enabled"
    ], async (creds) => {
      if (creds.auto_login_enabled === false) {
        sendResponse({ success: false, skipped: true, message: "Auto-login is disabled in settings." });
        return;
      }

      const results = { v2: null, v1: null };

      if (creds.v2_login_email && creds.v2_login_password) {
        const v2Res = await performV2Login(creds.v2_login_email, creds.v2_login_password);
        results.v2 = v2Res.success;
      }

      if (creds.v1_login_email && creds.v1_login_password) {
        const v1Res = await performV1Login(creds.v1_login_email, creds.v1_login_password);
        results.v1 = v1Res.success;
      }

      const anySuccess = Boolean(results.v2 || results.v1);
      if (anySuccess) chrome.storage.local.set({ oms_logged_in: true });
      sendResponse({ success: anySuccess, results });
    });
    return true;
  }
});

// Guaranteed Content Script Injection across all webpages (excluding Flipkart VMS where vms_content runs)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url) {
    const url = tab.url.toLowerCase();
    if (url.includes('fkvms.synlabs.io')) return;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (chrome.scripting) {
        chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['content.css']
        }).catch(() => {});

        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }).catch(() => {});
      }
    }
  }
});

