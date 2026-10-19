# ⚡ Ugaan Hub: Return Scan & Flipkart VMS Auto-Pickup

All-in-One High-Speed Warehouse Station Chrome Extension.
Combines:
1. **📦 Return QC Scanning Station**: Big Image Preview, Multi-Qty Protection, Auto-Submit, Condition Selection, Daily Excel Export, and Marketplace Sidebar Widget.
2. **⚡ Flipkart VMS Auto-Pickup Sync**: Real-Time Network Interception on `fkvms.synlabs.io`, Dual OMS Pickup Entry (`my.elitesecom.ai` V2 & `oms.elitesecom.ai` V1), Live VMS HUD Overlay, and **Emergency Cancelled Order Siren**.

---

## 🚀 How to Install / Reload in Google Chrome

1. Open **Google Chrome**.
2. Visit `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** (or click the **Reload 🔄** button if already installed).
5. Select this folder:
   ```
   c:\Ugaan-QC-Station
   ```
6. Pin **Ugaan Hub** to your Chrome toolbar 🧩.

---

## 🌟 Complete Merged Feature Set

### 1. 📦 Return Scanning Station (`scanner.html`)
* **Big Visual Preview**: High-resolution product image, Master SKU, Marketplace SKU, Marketplace badge.
* **Return Conditions**: Good, Received, Repair, Wrong, Damaged, Missing QT, RTO Wrong, Non Barcode RTO.
* **Multi-Qty Fraud Protection**: Immediately pauses and alerts operator on orders with Qty > 1.
* **Smart Scan Modes**: Smart Auto Mode, Direct Return Scan, and Detail Mode.
* **Daily Excel Export**: Generates clean `.csv` with all details.
* **Marketplace Floating Widget**: Slide-out scanning panel on Meesho, Flipkart Seller, Amazon Seller, OMS.

### 2. ⚡ Flipkart VMS Auto-Pickup (`fkvms.synlabs.io`)
* **Zero-Touch Auto-Pickup**: When packing parcels on Flipkart VMS camera station, network requests (`/api/awb/scan`) are intercepted and sent directly to EliteSecom OMS for pickup entry.
* **⛔ Emergency Cancelled Order Siren**: If a scanned order is cancelled by the customer, a loud alternating high-low emergency siren sounds and a fullscreen alarm banner flashes so the parcel is never dispatched!
* **Live HUD Overlay**: Draggable badge showing `[ ✅ DONE ]`, `[ ⚠️ ALREADY SCANNED ]`, `[ ⛔ CANCELLED ]`, `[ ❌ NOT FOUND ]`, sound mute/unmute, and count.
* **Same-Origin In-Tab Bridge (`elite_content.js`)**: Executes pickup scans in active authenticated OMS tabs for maximum session resilience.
* **Pickup Daily CSV Report**: Downloads detailed packing report with working time, duration, and video upload status.

### 3. 🔐 Zero-Tab Persistent Auto-Login & Session Check (Ruten Scen Core)
* **Chrome Cookie Jar Injection**:
  * Injects `session_id` directly for V2 (`my.elitesecom.ai`).
  * Injects `x_session` token directly for V1 (`oms.elitesecom.ai`).
* **Self-Healing Session Check**: Background check automatically detects expired sessions and refreshes authentication cookies silently without opening annoying popup tabs.
* **Dual OMS Support**: Configurable Priority (Auto V2 First, Auto V1 First, V2 Only, V1 Only).

### 4. 🎛️ Unified Popup UI (`popup.html`)
* **Header Status**: Live V2 and V1 online/offline indicators (clickable to open portals) + Light/Dark mode toggle.
* **Tab 1: 📦 Return QC**: Quick Scan input, Open Return Station button, today's return counters, download return Excel.
* **Tab 2: ⚡ VMS Pickup**: OMS priority selector, Auto-Sync toggle, today's pickup counters (Total, Success, Cancelled, Failed), CSV download, manual test scan, reset logs.
* **Tab 3: ⚙️ Settings**: Volume slider (0–150%) with audio test, Floating return button toggle, Auto-Login credentials for V1 & V2 with test buttons, Courier filter, Google Sheets Live Sync with 1-click Apps Script copy.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| **Enter** | Trigger Scan / Quick Scan |
| **F2** | Confirm Multi-Quantity Submit (Return Station) |
| **F8** | Download Today's Return Excel |
| **ESC** | Cancel Current Scan / Clear Input |
