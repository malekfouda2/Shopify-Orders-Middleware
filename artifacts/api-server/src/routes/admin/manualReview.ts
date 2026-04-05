import { Router } from "express";
import { db } from "../../db/connection.js";
import { manualReviewItemsTable } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { renderAdminLayout } from "./layout.js";

const router = Router();

router.get("/", async (req, res) => {
  const statusFilter = req.query.status as string ?? "pending";
  const items = await db
    .select()
    .from(manualReviewItemsTable)
    .where(statusFilter !== "all" ? eq(manualReviewItemsTable.status, statusFilter) : undefined as unknown as ReturnType<typeof eq>)
    .orderBy(desc(manualReviewItemsTable.createdAt));

  const content = `
    <div class="filters">
      <form method="GET" style="display:flex;gap:8px;">
        <select name="status" onchange="this.form.submit()">
          <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>Pending</option>
          <option value="resolved" ${statusFilter === "resolved" ? "selected" : ""}>Resolved</option>
          <option value="all" ${statusFilter === "all" ? "selected" : ""}>All</option>
        </select>
      </form>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>ID</th><th>Type</th><th>Entity ID</th><th>Reason</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          ${items
            .map(
              (item) => `<tr>
            <td>#${item.id}</td>
            <td><span class="badge">${item.entityType}</span></td>
            <td><code>${item.entityId ?? "—"}</code></td>
            <td style="max-width:300px;">${item.reason}</td>
            <td><span class="status ${item.status}">${item.status}</span></td>
            <td>${new Date(item.createdAt).toLocaleString()}</td>
            <td style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-secondary" onclick="togglePayload(${item.id})">View Payload</button>
              ${item.entityId ? `<form method="POST" action="/api/admin/replay/order/${item.entityId}"><button class="btn btn-sm btn-success" type="submit">🔄 Replay</button></form>` : ""}
              ${item.status === "pending" ? `<form method="POST" action="/api/admin/manual-review/${item.id}/resolve"><button class="btn btn-sm btn-secondary" type="submit">✓ Resolve</button></form>` : ""}
            </td>
          </tr>
          <tr id="payload-${item.id}" style="display:none;background:#f8fafc;">
            <td colspan="7"><div style="padding:12px;"><pre style="max-height:300px;overflow:auto;">${JSON.stringify(item.payload, null, 2)}</pre></div></td>
          </tr>`
            )
            .join("")}
          ${items.length === 0 ? `<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:30px;">No items ${statusFilter === "pending" ? "requiring review" : ""}.</td></tr>` : ""}
        </tbody>
      </table>
    </div>
    <script>
    function togglePayload(id) {
      const row = document.getElementById('payload-' + id);
      row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }
    </script>
  `;

  res.send(renderAdminLayout("Manual Review", content));
});

router.post("/:id/resolve", async (req, res) => {
  await db
    .update(manualReviewItemsTable)
    .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(manualReviewItemsTable.id, parseInt(req.params.id, 10)));
  res.redirect("/api/admin/manual-review");
});

export default router;
