import { Router } from "express";
import { db } from "../../db/connection.js";
import { webhookEventsTable, orderSyncsTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { enqueueReplayJob, enqueueSyncProductsJob, enqueueSyncPaymentMethodsJob, enqueueReconcileJob } from "../../services/sync/queue.js";
import { renderAdminLayout } from "./layout.js";

const router = Router();

router.post("/webhook/:id", async (req, res) => {
  const [event] = await db
    .select()
    .from(webhookEventsTable)
    .where(eq(webhookEventsTable.id, parseInt(req.params.id, 10)));

  if (!event?.shopifyOrderId) {
    res.send(renderAdminLayout("Replay", '<div class="alert alert-error">Event not found or no order ID.</div>'));
    return;
  }

  await enqueueReplayJob({ shopifyOrderId: event.shopifyOrderId, webhookEventId: event.id });
  res.send(renderAdminLayout("Replay Queued", `<div class="alert alert-success">Replay queued for order ${event.shopifyOrderId}</div><a href="/api/admin/webhook-events/${event.id}" class="btn btn-secondary">← Back to Event</a>`));
});

router.post("/order/:shopifyOrderId", async (req, res) => {
  const { shopifyOrderId } = req.params;
  await enqueueReplayJob({ shopifyOrderId });
  
  const backUrl = req.headers.referer ?? "/api/admin/sync-logs";
  if (req.headers.referer?.includes("manual-review")) {
    res.redirect("/api/admin/manual-review");
  } else {
    res.send(renderAdminLayout("Replay Queued", `<div class="alert alert-success">Replay queued for order ${shopifyOrderId}</div><a href="/api/admin/sync-logs" class="btn btn-secondary">← Back to Sync Logs</a>`));
  }
});

export default router;
