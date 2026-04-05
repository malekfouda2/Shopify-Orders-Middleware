import { Router } from "express";
import { db } from "../../db/connection.js";
import {
  webhookEventsTable,
  orderSyncsTable,
  syncJobLogsTable,
  manualReviewItemsTable,
} from "../../db/schema.js";
import { eq, desc, count, sql } from "drizzle-orm";
import { renderAdminLayout } from "./layout.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [totalWebhooks] = await db.select({ count: count() }).from(webhookEventsTable);
    const [totalSyncs] = await db.select({ count: count() }).from(orderSyncsTable);
    const [failedSyncs] = await db
      .select({ count: count() })
      .from(orderSyncsTable)
      .where(eq(orderSyncsTable.syncStatus, "failed"));
    const [pendingReview] = await db
      .select({ count: count() })
      .from(manualReviewItemsTable)
      .where(eq(manualReviewItemsTable.status, "pending"));

    const recentEvents = await db
      .select()
      .from(webhookEventsTable)
      .orderBy(desc(webhookEventsTable.receivedAt))
      .limit(10);

    const recentSyncs = await db
      .select()
      .from(orderSyncsTable)
      .orderBy(desc(orderSyncsTable.updatedAt))
      .limit(10);

    const statsHtml = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Webhooks</div>
          <div class="stat-value">${totalWebhooks?.count ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Syncs</div>
          <div class="stat-value">${totalSyncs?.count ?? 0}</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">Failed Syncs</div>
          <div class="stat-value">${failedSyncs?.count ?? 0}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Pending Review</div>
          <div class="stat-value">${pendingReview?.count ?? 0}</div>
        </div>
      </div>

      <div class="two-col">
        <div>
          <h2 class="section-title">Recent Webhook Events</h2>
          <table class="table">
            <thead><tr><th>ID</th><th>Topic</th><th>Order ID</th><th>Status</th><th>Received</th></tr></thead>
            <tbody>
              ${recentEvents
                .map(
                  (e) => `<tr>
                <td><a href="/api/admin/webhook-events/${e.id}">#${e.id}</a></td>
                <td><span class="badge">${e.topic}</span></td>
                <td>${e.shopifyOrderId ?? "—"}</td>
                <td><span class="status ${e.processingStatus}">${e.processingStatus}</span></td>
                <td>${new Date(e.receivedAt).toLocaleString()}</td>
              </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <div>
          <h2 class="section-title">Recent Order Syncs</h2>
          <table class="table">
            <thead><tr><th>Shopify Order</th><th>Tabliya ID</th><th>Status</th><th>Action</th><th>Updated</th></tr></thead>
            <tbody>
              ${recentSyncs
                .map(
                  (s) => `<tr>
                <td>${s.shopifyOrderName ?? s.shopifyOrderId}</td>
                <td>${s.tabliyaOrderId ?? "—"}</td>
                <td><span class="status ${s.syncStatus}">${s.syncStatus}</span></td>
                <td>${s.lastSyncAction ?? "—"}</td>
                <td>${new Date(s.updatedAt).toLocaleString()}</td>
              </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    res.send(renderAdminLayout("Dashboard", statsHtml));
  } catch (err) {
    res.status(500).send(renderAdminLayout("Error", `<p class="error">Error loading dashboard: ${String(err)}</p>`));
  }
});

export default router;
