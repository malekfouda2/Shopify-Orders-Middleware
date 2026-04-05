import { Router } from "express";
import { db } from "../../db/connection.js";
import { paymentMethodMappingsTable } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { renderAdminLayout } from "./layout.js";
import * as tabliya from "../../services/tabliya/client.js";

const router = Router();

router.get("/", async (_req, res) => {
  const mappings = await db
    .select()
    .from(paymentMethodMappingsTable)
    .orderBy(desc(paymentMethodMappingsTable.updatedAt));

  const content = `
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px;">
      <form method="POST" action="/api/admin/payment-method-mappings/import-tabliya">
        <button class="btn btn-success">📥 Import Tabliya Methods</button>
      </form>
      <button class="btn btn-primary" onclick="document.getElementById('add-modal').classList.add('open')">+ Add Mapping</button>
    </div>

    <div class="alert alert-info">Map Shopify payment gateway labels (e.g. "shopify_payments", "ideal", "manual") to Tabliya payment method names (e.g. "Tikkie", "iDeal", "Cash").</div>

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Shopify Payment Label</th><th>Tabliya Method</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>
          ${mappings
            .map(
              (m) => `<tr>
            <td><code>${m.shopifyPaymentLabel}</code></td>
            <td>${m.tabliyaPaymentMethod}</td>
            <td><span class="status ${m.active ? "synced" : "cancelled"}">${m.active ? "Active" : "Inactive"}</span></td>
            <td style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-secondary" onclick="editMapping(${m.id}, '${m.shopifyPaymentLabel}', '${m.tabliyaPaymentMethod}', ${m.active})">Edit</button>
              <form method="POST" action="/api/admin/payment-method-mappings/${m.id}/delete" onsubmit="return confirm('Delete?')">
                <button class="btn btn-sm btn-danger">Delete</button>
              </form>
            </td>
          </tr>`
            )
            .join("")}
          ${mappings.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#6b7280;padding:30px;">No payment method mappings yet.</td></tr>' : ""}
        </tbody>
      </table>
    </div>

    <!-- Add Modal -->
    <div class="modal-overlay" id="add-modal">
      <div class="modal">
        <h3>Add Payment Method Mapping</h3>
        <form method="POST" action="/api/admin/payment-method-mappings">
          <div class="form-group"><label>Shopify Payment Label * <small>(gateway name from Shopify)</small></label><input name="shopifyPaymentLabel" required placeholder="e.g. shopify_payments, ideal, manual"></div>
          <div class="form-group"><label>Tabliya Payment Method *</label><input name="tabliyaPaymentMethod" required placeholder="e.g. Tikkie, iDeal, Cash"></div>
          <div style="display:flex;gap:8px;">
            <button type="submit" class="btn btn-primary">Save</button>
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('add-modal').classList.remove('open')">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Modal -->
    <div class="modal-overlay" id="edit-modal">
      <div class="modal">
        <h3>Edit Payment Method Mapping</h3>
        <form method="POST" id="edit-form" action="">
          <div class="form-group"><label>Shopify Payment Label</label><input name="shopifyPaymentLabel" id="edit-label" required></div>
          <div class="form-group"><label>Tabliya Payment Method</label><input name="tabliyaPaymentMethod" id="edit-method" required></div>
          <div class="form-group"><label>Active</label><select name="active"><option value="true">Active</option><option value="false">Inactive</option></select></div>
          <div style="display:flex;gap:8px;">
            <button type="submit" class="btn btn-primary">Save</button>
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('edit-modal').classList.remove('open')">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <script>
    function editMapping(id, label, method, active) {
      document.getElementById('edit-label').value = label;
      document.getElementById('edit-method').value = method;
      document.getElementById('edit-form').querySelector('select[name=active]').value = active ? 'true' : 'false';
      document.getElementById('edit-form').action = '/api/admin/payment-method-mappings/' + id;
      document.getElementById('edit-modal').classList.add('open');
    }
    </script>
  `;

  res.send(renderAdminLayout("Payment Method Mappings", content));
});

router.post("/", async (req, res) => {
  const body = req.body as Record<string, string>;
  await db.insert(paymentMethodMappingsTable).values({
    shopifyPaymentLabel: body.shopifyPaymentLabel,
    tabliyaPaymentMethod: body.tabliyaPaymentMethod,
    active: true,
  });
  res.redirect("/api/admin/payment-method-mappings");
});

router.post("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = req.body as Record<string, string>;
  await db
    .update(paymentMethodMappingsTable)
    .set({
      shopifyPaymentLabel: body.shopifyPaymentLabel,
      tabliyaPaymentMethod: body.tabliyaPaymentMethod,
      active: body.active === "true",
      updatedAt: new Date(),
    })
    .where(eq(paymentMethodMappingsTable.id, id));
  res.redirect("/api/admin/payment-method-mappings");
});

router.post("/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(paymentMethodMappingsTable).where(eq(paymentMethodMappingsTable.id, id));
  res.redirect("/api/admin/payment-method-mappings");
});

router.post("/import-tabliya", async (_req, res) => {
  try {
    const methods = await tabliya.listPaymentMethods();
    const content = `
      <div class="alert alert-success">Found ${methods.length} payment methods in Tabliya.</div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>ID</th><th>Name</th><th>Sort Order</th><th>Action</th></tr></thead>
          <tbody>
            ${methods
              .map(
                (m) => `<tr>
              <td>${m.id}</td>
              <td>${m.name}</td>
              <td>${m.sort_order}</td>
              <td>
                <form method="POST" action="/api/admin/payment-method-mappings" style="display:inline-flex;gap:8px;align-items:center;">
                  <input type="hidden" name="tabliyaPaymentMethod" value="${m.name}">
                  <input name="shopifyPaymentLabel" placeholder="Shopify gateway label" style="padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:6px;font-size:12px;">
                  <button type="submit" class="btn btn-sm btn-primary">Map</button>
                </form>
              </td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    res.send(renderAdminLayout("Import Tabliya Payment Methods", content));
  } catch (err) {
    res.send(renderAdminLayout("Import Tabliya Payment Methods", `<div class="alert alert-error">Failed to connect to Tabliya: ${String(err)}</div>`));
  }
});

export default router;
