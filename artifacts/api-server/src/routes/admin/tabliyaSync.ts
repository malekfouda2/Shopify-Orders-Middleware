import { Router } from "express";
import { enqueueSyncProductsJob, enqueueSyncPaymentMethodsJob, enqueueReconcileJob } from "../../services/sync/queue.js";
import { renderAdminLayout } from "./layout.js";

const router = Router();

router.post("/tabliya/sync-products", async (_req, res) => {
  try {
    await enqueueSyncProductsJob();
    res.send(renderAdminLayout("Sync Queued", '<div class="alert alert-success">Tabliya products sync job queued.</div><a href="/api/admin/settings" class="btn btn-secondary">← Back to Settings</a>'));
  } catch (err) {
    res.send(renderAdminLayout("Error", `<div class="alert alert-error">Failed to queue job: ${String(err)}</div>`));
  }
});

router.post("/tabliya/sync-payment-methods", async (_req, res) => {
  try {
    await enqueueSyncPaymentMethodsJob();
    res.send(renderAdminLayout("Sync Queued", '<div class="alert alert-success">Tabliya payment methods sync job queued.</div><a href="/api/admin/settings" class="btn btn-secondary">← Back to Settings</a>'));
  } catch (err) {
    res.send(renderAdminLayout("Error", `<div class="alert alert-error">Failed to queue job: ${String(err)}</div>`));
  }
});

router.post("/reconcile", async (_req, res) => {
  try {
    await enqueueReconcileJob();
    res.send(renderAdminLayout("Reconciliation Queued", '<div class="alert alert-success">Reconciliation job queued. It will retry all failed syncs.</div><a href="/api/admin/settings" class="btn btn-secondary">← Back to Settings</a>'));
  } catch (err) {
    res.send(renderAdminLayout("Error", `<div class="alert alert-error">Failed to queue reconciliation: ${String(err)}</div>`));
  }
});

export default router;
