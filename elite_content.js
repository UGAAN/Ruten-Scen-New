/**
 * VMS-Sync: EliteSecom Content Script (elite_content.js)
 * Runs directly inside https://my.elitesecom.ai/* and https://oms.elitesecom.ai/*
 * Executes pickup scans within the authenticated EliteSecom page context,
 * and extracts product photos and order info from the live page DOM / API.
 */

(function () {
  console.log("%c[Ugaan VMS-Sync] EliteSecom Handler Ready", "background: #00C853; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;");

  function scrapeProductFromDom(awb) {
    if (!awb) return null;
    try {
      const allRows = document.querySelectorAll("tr, .ant-table-row, .el-table__row, .table-row, [role='row']");
      for (const row of allRows) {
        const text = row.innerText || row.textContent || "";
        if (text.includes(awb)) {
          // Found matching row in current table
          const img = row.querySelector("img");
          const imgSrc = (img && (img.src || img.getAttribute("data-src") || img.getAttribute("data-original"))) || "";
          
          let sku = "";
          const skuEl = row.querySelector(".sku, [data-sku], .master-sku, .product-sku");
          if (skuEl) sku = skuEl.innerText.trim();

          let title = "";
          const titleEl = row.querySelector(".title, .product-title, .name, .product-name");
          if (titleEl) title = titleEl.innerText.trim();

          let qty = 1;
          const qtyEl = row.querySelector(".quantity, .qty, [data-qty]");
          if (qtyEl) {
            const parsed = parseInt(qtyEl.innerText.trim(), 10);
            if (!isNaN(parsed) && parsed > 0) qty = parsed;
          }

          if (imgSrc || sku) {
            return {
              image_url: imgSrc,
              product_image: imgSrc,
              master_sku: sku,
              product_title: title,
              quantity: qty,
              source: "ELITE_PAGE_DOM"
            };
          }
        }
      }
    } catch (e) {
      console.warn("[Ugaan VMS-Sync] DOM scrape error:", e);
    }
    return null;
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. AWB Pickup Scan execution inside page
    if (request.action === "SCAN_AWB_IN_ELITE") {
      const awb = String(request.awb || "").replace(/^[(\s]+|[)\s]+$/g, "").trim();
      console.log("[Ugaan VMS-Sync] Received scan request for AWB:", awb);

      // Visually update the DOM input field on pickup-entry page if present without triggering duplicate page events
      try {
        const input = document.querySelector('input[placeholder*="AWB Number"]') ||
                      document.querySelector('input[placeholder*="Click Here To Scan"]') ||
                      document.querySelector('.pickup-entry input') ||
                      document.querySelector('input[type="text"]');
        if (input) {
          input.value = awb;
        }
      } catch (domErr) {
        console.warn("[Ugaan VMS-Sync] DOM update note:", domErr);
      }

      const isV1 = window.location.hostname.includes("oms.elitesecom.ai");
      const scanUrl = isV1 
        ? "https://oms.elitesecom.ai/api/pickup-scan"
        : "https://my.elitesecom.ai/api/scanorders/pickup/pickup_scan";
      const referrerUrl = isV1
        ? "https://oms.elitesecom.ai/scanorders/pickup-entry"
        : "https://my.elitesecom.ai/scanorders/pickup-entry";
      const payload = isV1 ? {
        number: awb,
        location_key: null,
        courier: request.courier || "all",
        marketplace: []
      } : {
        awbNumber: awb,
        location_key: [],
        courier: request.courier || "all",
        marketplace: []
      };

      // Execute same-origin fetch with page credentials
      fetch(scanUrl, {
        method: "POST",
        headers: {
          "accept": "*/*",
          "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,gu;q=0.7",
          "content-type": "application/json"
        },
        referrer: referrerUrl,
        credentials: "include",
        body: JSON.stringify(payload)
      })
      .then(async (res) => {
        let json = null;
        let text = "";
        try {
          text = await res.text();
          json = JSON.parse(text);
        } catch (e) {}

        console.log(`[Ugaan VMS-Sync] EliteSecom ${isV1 ? "V1" : "V2"} response:`, res.status, json || text);
        sendResponse({
          ok: res.ok,
          status: res.status,
          json: json,
          text: text,
          oms_source: isV1 ? "V1" : "V2"
        });
      })
      .catch((fetchErr) => {
        console.error("[Ugaan VMS-Sync] EliteSecom fetch error:", fetchErr);
        sendResponse({
          ok: false,
          status: 0,
          error: fetchErr.message || "EliteSecom page network error",
          oms_source: isV1 ? "V1" : "V2"
        });
      });

      return true; // Keep message channel open for async response
    }

    // 2. Lookup Product from EliteSecom page DOM / local cache
    if (request.action === "LOOKUP_AWB_IN_ELITE_PAGE") {
      const awb = String(request.awb || "").replace(/^[(\s]+|[)\s]+$/g, "").trim();
      const domResult = scrapeProductFromDom(awb);
      if (domResult) {
        sendResponse({ success: true, product: domResult });
        return true;
      }
      sendResponse({ success: false });
      return true;
    }
  });
})();
