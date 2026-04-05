import { Router } from "express";
import { db } from "../../db/connection.js";
import { appSettingsTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { renderAdminLayout } from "./layout.js";

const router = Router();

const SETTING_KEYS = [
  "DEFAULT_DELIVERY_OFFSET_DAYS",
  "DEFAULT_HOUSE_NUMBER",
  "ENABLE_INVOICE_SYNC",
  "LOG_LEVEL",
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

export default router;
