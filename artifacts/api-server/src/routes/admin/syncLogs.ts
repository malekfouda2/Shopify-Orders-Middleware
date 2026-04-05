import { Router } from "express";
import { db } from "../../db/connection.js";
import { orderSyncsTable, syncJobLogsTable } from "../../db/schema.js";
import { eq, desc, or, like } from "drizzle-orm";
import { renderAdminLayout } from "./layout.js";

const router = Router();

router.get("/", async (req, res) => {
  const statusFilter = req.query.status as string ?? "";
  const actionFilter = req.query.action as string ?? "";
  const page = parseInt((req.query.page as string) ?? "1", 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = db
    .select()
    .from(orderSyncsTable)
    .orderBy(desc(orderSyncsTable.updatedAt))
    .limit(limit)
    .offset(offset);

  const syncs = await (statusFilter
    ? db.select().from(orderSyncsTable).where(eq(orderSyncsTable.syncStatus, statusFilter)).orderBy(desc(orderSyncsTable.updatedAt)).limit(limit).offset(offset)
    : db.select().from(orderSyncsTable).orderBy(desc(orderSyncsTable.updatedAt)).limit(limit).offset(offset));

  const content = `
    <div class="filters">
      <form method="GET" style="display:flex;gap:8px;align-items:center;">
        <select name="status" onchange="this.form.submit()">
          <option value="" ${!statusFilter ? "selected" : ""}>All statuses</option>
          <option value="synced" ${statusFilter === "synced" ? "selected" : ""}>Synced</option>
          <option value="failed" ${statusFilter === "failed" ? "selected" : ""}>Failed</option>
          <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>Pending</option>
          <option value="cancelled" ${statusFilter === "cancelled" ? "selected" : ""}>Cancelled</option>
          <option value="skipped" ${statusFilter === "skipped" ? "selected" : ""}>Skipped</option>
        </select>
      </form>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Shopify Order</th><th>Tabliya ID</th><th>Status</th><th>Action</th><th>Failure Reason</th><th>Updated</th><th>Actions</th></tr></thead>
        <tbody>
          ${syncs
            .map(
              (s) => `<tr>
            <td>${s.shopifyOrderName ?? ""} <code style="font-size:11px;">${s.shopifyOrderId}</code></td>
            <td>${s.tabliyaOrderId ?? "—"}</td>
            <td><span class="status ${s.syncStatus}">${s.syncStatus}</span></td>
            <td>${s.lastSyncAction ?? "—"}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.failureReason ?? ""}"><small style="color:#dc2626;">${s.failureReason ? s.failureReason.substring(0, 60) + (s.failureReason.length > 60 ? "..." : "") : "—"}</small></td>
            <td>${new Date(s.updatedAt).toLocaleString()}</td>
            <td style="display:flex;gap:4px;">
              <button class="btn btn-sm btn-secondary" onclick="viewPayloads(${s.id})">Payloads</button>
              ${s.syncStatus === "failed" || s.syncStatus === "pending" ? `<form method="POST" action="/api/admin/replay/order/${s.shopifyOrderId}"><button class="btn btn-sm btn-success" type="submit">🔄 Replay</button></form>` : ""}
            </td>
          </tr>
          <tr id="payloads-${s.id}" style="display:none;background:#f8fafc;">
            <td colspan="7">
              <div style="padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div><strong>Request Payload</strong><pre style="max-height:200px;overflow:auto;">${JSON.stringify(s.requestPayload, null, 2)}</pre></div>
                <div><strong>Response Payload</strong><pre style="max-height:200px;overflow:auto;">${JSON.stringify(s.responsePayload, null, 2)}</pre></div>
              </div>
            </td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="pagination">
      ${page > 1 ? `<a href="?page=${page - 1}&status=${statusFilter}">← Previous</a>` : ""}
      <span class="current">Page ${page}</span>
      ${syncs.length === limit ? `<a href="?page=${page + 1}&status=${statusFilter}">Next →</a>` : ""}
    </div>
    <script>
    function viewPayloads(id) {
      const row = document.getElementById('payloads-' + id);
      row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }
    </script>
  `;

  res.send(renderAdminLayout("Sync Logs", content));
});

export default router;
