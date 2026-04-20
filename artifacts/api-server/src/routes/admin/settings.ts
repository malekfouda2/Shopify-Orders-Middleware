import { Router } from "express";
import { db } from "../../db/connection.js";
import { appSettingsTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { renderAdminLayout } from "./layout.js";
import * as tabliya from "../../services/tabliya/client.js";

const router = Router();

const SETTING_KEYS = [
  "DEFAULT_DELIVERY_OFFSET_DAYS",
  "DEFAULT_HOUSE_NUMBER",
  "ENABLE_INVOICE_SYNC",
  "LOG_LEVEL",
  "TABLIYA_CANCEL_STATUS",
];

router.get("/", async (_req, res) => {
  const settings = await db.select().from(appSettingsTable);
  const settingMap: Record<string, string> = {};
  for (const s of settings) settingMap[s.key] = s.value;

  // Merge with env defaults
  for (const key of SETTING_KEYS) {
    if (!(key in settingMap)) {
      settingMap[key] = process.env[key] ?? "";
    }
  }

  const content = `
    <div class="card">
      <h3>Integration Settings</h3>
      <form method="POST" action="/api/admin/settings">
        <div class="form-group">
          <label>Default Delivery Offset Days <small>(days added to order date when no delivery date is specified)</small></label>
          <input type="number" name="DEFAULT_DELIVERY_OFFSET_DAYS" value="${settingMap.DEFAULT_DELIVERY_OFFSET_DAYS ?? "1"}" min="0" max="365">
        </div>
        <div class="form-group">
          <label>Default House Number Fallback <small>(used when address parsing fails)</small></label>
          <input type="text" name="DEFAULT_HOUSE_NUMBER" value="${settingMap.DEFAULT_HOUSE_NUMBER ?? "0"}">
        </div>
        <div class="form-group">
          <label>Enable Invoice Sync <small>(create/update Tabliya invoices when orders sync)</small></label>
          <select name="ENABLE_INVOICE_SYNC">
            <option value="false" ${settingMap.ENABLE_INVOICE_SYNC !== "true" ? "selected" : ""}>Disabled</option>
            <option value="true" ${settingMap.ENABLE_INVOICE_SYNC === "true" ? "selected" : ""}>Enabled</option>
          </select>
        </div>
        <div class="form-group">
          <label>Log Level</label>
          <select name="LOG_LEVEL">
            <option value="trace" ${settingMap.LOG_LEVEL === "trace" ? "selected" : ""}>trace</option>
            <option value="debug" ${settingMap.LOG_LEVEL === "debug" ? "selected" : ""}>debug</option>
            <option value="info" ${settingMap.LOG_LEVEL === "info" ? "selected" : ""}>info</option>
            <option value="warn" ${settingMap.LOG_LEVEL === "warn" ? "selected" : ""}>warn</option>
            <option value="error" ${settingMap.LOG_LEVEL === "error" ? "selected" : ""}>error</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </form>
    </div>

    <div class="card">
      <h3>Order Cancellation</h3>
      <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">
        When a Shopify order is cancelled, the system needs to know which status to set in Tabliya.
        Click <strong>Fetch Statuses</strong> to see what's available, then enter the correct one below.
      </p>
      <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:16px;">
        <div class="form-group" style="margin:0;flex:1;">
          <label>Tabliya Cancel Status <small>(exact status name as it appears in Tabliya)</small></label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="cancel-status-input" value="${settingMap.TABLIYA_CANCEL_STATUS ?? ""}" placeholder="e.g. geannuleerd">
            <button type="button" class="btn btn-secondary" onclick="fetchStatuses()">🔍 Fetch Statuses</button>
            <button type="button" class="btn btn-primary" onclick="saveCancelStatus()">Save</button>
          </div>
        </div>
      </div>
      <div id="statuses-result" style="font-size:13px;color:#374151;"></div>
      <script>
      async function fetchStatuses() {
        const el = document.getElementById('statuses-result');
        el.innerHTML = '<em style="color:#6b7280;">Fetching from Tabliya...</em>';
        try {
          const r = await fetch('/api/admin/settings/tabliya-statuses');
          const data = await r.json();
          if (data.error) {
            el.innerHTML = '<span style="color:#ef4444;">Error: ' + data.error + '</span>';
            return;
          }
          let html = '';
          if (data.statuses && data.statuses.length > 0) {
            html += '<div style="margin-bottom:8px;"><strong>Click a status to select it:</strong></div>';
            html += data.statuses.map(s => {
              const safe = String(s).replace(/'/g, "\\'");
              return \`<button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('cancel-status-input').value='\${safe}'" style="margin:2px;">\${s}</button>\`;
            }).join('');
          } else {
            html += '<div style="color:#f59e0b;margin-bottom:8px;">⚠️ No statuses returned. Showing raw response:</div>';
          }
          if (data.raw !== undefined) {
            html += \`<details style="margin-top:10px;"><summary style="cursor:pointer;font-size:12px;color:#6b7280;">Raw Tabliya response</summary><pre style="font-size:11px;background:#f8fafc;padding:8px;border-radius:4px;margin-top:4px;overflow:auto;">\${JSON.stringify(data.raw, null, 2)}</pre></details>\`;
          }
          el.innerHTML = html;
        } catch(e) {
          el.innerHTML = '<span style="color:#ef4444;">Failed to connect to Tabliya.</span>';
        }
      }
      async function saveCancelStatus() {
        const val = document.getElementById('cancel-status-input').value.trim();
        const form = document.createElement('form');
        form.method = 'POST'; form.action = '/api/admin/settings';
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = 'TABLIYA_CANCEL_STATUS'; input.value = val;
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      }
      </script>
    </div>

    <div class="card">
      <h3>Tabliya Integration Tools</h3>
      <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Manually trigger sync jobs to import data from Tabliya.</p>
      <div style="display:flex;gap:10px;">
        <form method="POST" action="/api/admin/tabliya/sync-products">
          <button class="btn btn-secondary" type="submit">📦 Sync Tabliya Products</button>
        </form>
        <form method="POST" action="/api/admin/tabliya/sync-payment-methods">
          <button class="btn btn-secondary" type="submit">💳 Sync Tabliya Payment Methods</button>
        </form>
        <form method="POST" action="/api/admin/reconcile">
          <button class="btn btn-secondary" type="submit">🔄 Run Reconciliation</button>
        </form>
      </div>
    </div>
  `;
  res.send(renderAdminLayout("Settings", content));
});

router.post("/", async (req, res) => {
  const body = req.body as Record<string, string>;
  for (const key of SETTING_KEYS) {
    if (key in body) {
      await db
        .insert(appSettingsTable)
        .values({ key, value: body[key] })
        .onConflictDoUpdate({ target: [appSettingsTable.key], set: { value: body[key], updatedAt: new Date() } });
    }
  }
  res.redirect("/api/admin/settings");
});

// Returns available order statuses from Tabliya — used by the settings page
router.get("/tabliya-statuses", async (_req, res) => {
  try {
    const [statuses, raw] = await Promise.all([
      tabliya.getOrderStatuses(),
      tabliya.getOrderStatusesRaw(),
    ]);
    res.json({ statuses, raw });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.json({ statuses: [], error: message });
  }
});

export default router;
