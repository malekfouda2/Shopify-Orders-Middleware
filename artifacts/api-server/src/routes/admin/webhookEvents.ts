import { Router } from "express";
import { db } from "../../db/connection.js";
import { webhookEventsTable } from "../../db/schema.js";
import { eq, desc, like, or } from "drizzle-orm";
import { renderAdminLayout } from "./layout.js";

const router = Router();

router.get("/", async (req, res) => {
  const page = parseInt((req.query.page as string) ?? "1", 10);
  const limit = 50;
  const offset = (page - 1) * limit;
  const statusFilter = req.query.status as string ?? "";

  const events = statusFilter
    ? await db
        .select()
        .from(webhookEventsTable)
        .where(eq(webhookEventsTable.processingStatus, statusFilter))
        .orderBy(desc(webhookEventsTable.receivedAt))
        .limit(limit)
        .offset(offset)
    : await db
        .select()
        .from(webhookEventsTable)
        .orderBy(desc(webhookEventsTable.receivedAt))
        .limit(limit)
        .offset(offset);

  const content = `
    <div class="filters">
      <form method="GET" style="display:flex;gap:8px;">
        <select name="status" onchange="this.form.submit()">
          <option value="" ${!statusFilter ? "selected" : ""}>All statuses</option>
          <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>Pending</option>
          <option value="processed" ${statusFilter === "processed" ? "selected" : ""}>Processed</option>
          <option value="failed" ${statusFilter === "failed" ? "selected" : ""}>Failed</option>
          <option value="duplicate" ${statusFilter === "duplicate" ? "selected" : ""}>Duplicate</option>
          <option value="skipped" ${statusFilter === "skipped" ? "selected" : ""}>Skipped</option>
        </select>
      </form>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>ID</th><th>Topic</th><th>Shop</th><th>Order ID</th><th>Sig Valid</th><th>Status</th><th>Error</th><th>Received</th><th>Actions</th></tr></thead>
        <tbody>
          ${events
            .map(
              (e) => `<tr>
            <td><a href="/api/admin/webhook-events/${e.id}">#${e.id}</a></td>
            <td><span class="badge">${e.topic}</span></td>
            <td>${e.shopDomain ?? "—"}</td>
            <td>${e.shopifyOrderId ?? "—"}</td>
            <td>${e.signatureValid ? "✅" : "❌"}</td>
            <td><span class="status ${e.processingStatus}">${e.processingStatus}</span></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${e.errorMessage ?? ""}">${e.errorMessage ? `<span style="color:#dc2626;font-size:12px;">${e.errorMessage.substring(0, 60)}${e.errorMessage.length > 60 ? "..." : ""}</span>` : "—"}</td>
            <td>${new Date(e.receivedAt).toLocaleString()}</td>
            <td>
              <a href="/api/admin/webhook-events/${e.id}" class="btn btn-sm btn-secondary">View</a>
              ${e.shopifyOrderId ? `<form method="POST" action="/api/admin/replay/webhook/${e.id}" style="display:inline;"><button class="btn btn-sm btn-success" type="submit">Replay</button></form>` : ""}
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
      ${events.length === limit ? `<a href="?page=${page + 1}&status=${statusFilter}">Next →</a>` : ""}
    </div>
  `;
  res.send(renderAdminLayout("Webhook Events", content));
});

router.get("/:id", async (req, res) => {
  const [event] = await db
    .select()
    .from(webhookEventsTable)
    .where(eq(webhookEventsTable.id, parseInt(req.params.id, 10)));

  if (!event) {
    res.status(404).send(renderAdminLayout("Not Found", "<p>Event not found.</p>"));
    return;
  }

  const content = `
    <div class="card">
      <h3>Event #${event.id} — ${event.topic}</h3>
      <table class="table" style="margin-bottom:16px;">
        <tr><th>Shop Domain</th><td>${event.shopDomain ?? "—"}</td></tr>
        <tr><th>Webhook ID</th><td>${event.webhookId ?? "—"}</td></tr>
        <tr><th>Shopify Order ID</th><td>${event.shopifyOrderId ?? "—"}</td></tr>
        <tr><th>Signature Valid</th><td>${event.signatureValid ? "✅ Valid" : "❌ Invalid"}</td></tr>
        <tr><th>Status</th><td><span class="status ${event.processingStatus}">${event.processingStatus}</span></td></tr>
        <tr><th>Received</th><td>${new Date(event.receivedAt).toLocaleString()}</td></tr>
        <tr><th>Processed</th><td>${event.processedAt ? new Date(event.processedAt).toLocaleString() : "—"}</td></tr>
        <tr><th>Error</th><td style="color:#dc2626;">${event.errorMessage ?? "—"}</td></tr>
      </table>
      ${event.shopifyOrderId ? `<form method="POST" action="/api/admin/replay/webhook/${event.id}" style="margin-bottom:16px;"><button class="btn btn-success">🔄 Replay This Event</button></form>` : ""}
    </div>
    <div class="card">
      <h3>Parsed Body</h3>
      <pre>${JSON.stringify(event.parsedBody, null, 2)}</pre>
    </div>
    <div class="card">
      <h3>Request Headers</h3>
      <pre>${JSON.stringify(event.rawHeaders, null, 2)}</pre>
    </div>
    <a href="/api/admin/webhook-events" class="btn btn-secondary">← Back</a>
  `;

  res.send(renderAdminLayout(`Webhook Event #${event.id}`, content));
});

export default router;
