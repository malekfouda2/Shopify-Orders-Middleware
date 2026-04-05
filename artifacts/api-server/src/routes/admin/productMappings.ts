import { Router } from "express";
import { db } from "../../db/connection.js";
import { productMappingsTable } from "../../db/schema.js";
import { eq, desc, like, or } from "drizzle-orm";
import { renderAdminLayout } from "./layout.js";
import * as tabliya from "../../services/tabliya/client.js";

const router = Router();

router.get("/", async (req, res) => {
  const q = (req.query.q as string) ?? "";
  const mappings = q
    ? await db
        .select()
        .from(productMappingsTable)
        .where(
          or(
            like(productMappingsTable.shopifyProductTitle, `%${q}%`),
            like(productMappingsTable.shopifyVariantId, `%${q}%`),
            like(productMappingsTable.tabliyaProductName, `%${q}%`),
            like(productMappingsTable.shopifySku, `%${q}%`)
          )
        )
        .orderBy(desc(productMappingsTable.updatedAt))
    : await db
        .select()
        .from(productMappingsTable)
        .orderBy(desc(productMappingsTable.updatedAt));

  const content = `
    <div class="filters">
      <form method="GET" style="display:flex;gap:8px;">
        <input type="text" name="q" placeholder="Search mappings..." value="${q}">
        <button type="submit" class="btn btn-secondary">Search</button>
        ${q ? `<a href="/api/admin/product-mappings" class="btn btn-secondary">Clear</a>` : ""}
      </form>
      <div style="margin-left:auto;display:flex;gap:8px;">
        <form method="POST" action="/api/admin/product-mappings/import-tabliya">
          <button class="btn btn-success">📥 Import Tabliya Products</button>
        </form>
        <button class="btn btn-primary" onclick="document.getElementById('add-modal').classList.add('open')">+ Add Mapping</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Shopify Variant ID</th><th>SKU</th><th>Shopify Product</th><th>Tabliya Product ID</th><th>Tabliya Name</th><th>Active</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${mappings
            .map(
              (m) => `<tr>
            <td><code>${m.shopifyVariantId}</code></td>
            <td>${m.shopifySku ?? "—"}</td>
            <td>${m.shopifyProductTitle ?? "—"}${m.shopifyVariantTitle ? ` (${m.shopifyVariantTitle})` : ""}</td>
            <td><code>${m.tabliyaProductId}</code></td>
            <td>${m.tabliyaProductName ?? "—"}</td>
            <td><span class="status ${m.active ? "synced" : "cancelled"}">${m.active ? "Active" : "Inactive"}</span></td>
            <td style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-secondary" onclick="editMapping(${m.id}, '${m.shopifyVariantId}', '${m.shopifySku ?? ""}', '${m.shopifyProductTitle ?? ""}', '${m.shopifyVariantTitle ?? ""}', '${m.tabliyaProductId}', '${m.tabliyaProductName ?? ""}', ${m.active})">Edit</button>
              <form method="POST" action="/api/admin/product-mappings/${m.id}/delete" onsubmit="return confirm('Delete this mapping?')">
                <button class="btn btn-sm btn-danger" type="submit">Delete</button>
              </form>
            </td>
          </tr>`
            )
            .join("")}
          ${mappings.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:30px;">No product mappings yet. Add one or import from Tabliya.</td></tr>' : ""}
        </tbody>
      </table>
    </div>

    <!-- Add Modal -->
    <div class="modal-overlay" id="add-modal">
      <div class="modal">
        <h3>Add Product Mapping</h3>
        <form method="POST" action="/api/admin/product-mappings">
          <div class="form-group"><label>Shopify Variant ID *</label><input name="shopifyVariantId" required></div>
          <div class="form-group"><label>Shopify Product ID</label><input name="shopifyProductId"></div>
          <div class="form-group"><label>Shopify SKU</label><input name="shopifySku"></div>
          <div class="form-group"><label>Shopify Product Title</label><input name="shopifyProductTitle"></div>
          <div class="form-group"><label>Shopify Variant Title</label><input name="shopifyVariantTitle"></div>
          <div class="form-group"><label>Tabliya Product ID *</label><input name="tabliyaProductId" required></div>
          <div class="form-group"><label>Tabliya Product Name</label><input name="tabliyaProductName"></div>
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
        <h3>Edit Product Mapping</h3>
        <form method="POST" id="edit-form" action="">
          <input type="hidden" name="_method" value="PUT">
          <div class="form-group"><label>Shopify Variant ID</label><input name="shopifyVariantId" id="edit-variantId" readonly style="background:#f1f5f9;"></div>
          <div class="form-group"><label>Shopify SKU</label><input name="shopifySku" id="edit-sku"></div>
          <div class="form-group"><label>Shopify Product Title</label><input name="shopifyProductTitle" id="edit-productTitle"></div>
          <div class="form-group"><label>Shopify Variant Title</label><input name="shopifyVariantTitle" id="edit-variantTitle"></div>
          <div class="form-group"><label>Tabliya Product ID *</label><input name="tabliyaProductId" id="edit-tabliyaId" required></div>
          <div class="form-group"><label>Tabliya Product Name</label><input name="tabliyaProductName" id="edit-tabliyaName"></div>
          <div class="form-group"><label>Active</label><select name="active"><option value="true">Active</option><option value="false">Inactive</option></select></div>
          <div style="display:flex;gap:8px;">
            <button type="submit" class="btn btn-primary">Save</button>
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('edit-modal').classList.remove('open')">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <script>
    function editMapping(id, variantId, sku, productTitle, variantTitle, tabliyaId, tabliyaName, active) {
      document.getElementById('edit-variantId').value = variantId;
      document.getElementById('edit-sku').value = sku;
      document.getElementById('edit-productTitle').value = productTitle;
      document.getElementById('edit-variantTitle').value = variantTitle;
      document.getElementById('edit-tabliyaId').value = tabliyaId;
      document.getElementById('edit-tabliyaName').value = tabliyaName;
      document.getElementById('edit-form').querySelector('select[name=active]').value = active ? 'true' : 'false';
      document.getElementById('edit-form').action = '/api/admin/product-mappings/' + id;
      document.getElementById('edit-modal').classList.add('open');
    }
    </script>
  `;

  res.send(renderAdminLayout("Product Mappings", content));
});

router.post("/", async (req, res) => {
  const body = req.body as Record<string, string>;
  await db.insert(productMappingsTable).values({
    shopifyVariantId: body.shopifyVariantId,
    shopifyProductId: body.shopifyProductId || null,
    shopifySku: body.shopifySku || null,
    shopifyProductTitle: body.shopifyProductTitle || null,
    shopifyVariantTitle: body.shopifyVariantTitle || null,
    tabliyaProductId: body.tabliyaProductId,
    tabliyaProductName: body.tabliyaProductName || null,
    active: true,
  });
  res.redirect("/api/admin/product-mappings");
});

// NOTE: /import-tabliya MUST be before /:id so Express doesn't treat "import-tabliya" as an ID
router.post("/import-tabliya", async (_req, res) => {
  try {
    const products = await tabliya.listProducts();
    const content = `
      <div class="alert alert-info">Found ${products.length} products in Tabliya. Select which ones to create mappings for.</div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Tabliya ID</th><th>Name</th><th>Price</th><th>Actions</th></tr></thead>
          <tbody>
            ${products
              .map(
                (p) => `<tr>
              <td><code>${p.id}</code></td>
              <td>${p.name}</td>
              <td>€${p.price}</td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="startMapping(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Map to Shopify Variant</button>
              </td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <!-- Quick map modal -->
      <div class="modal-overlay" id="map-modal">
        <div class="modal">
          <h3>Map Shopify Variant to Tabliya Product</h3>
          <form method="POST" action="/api/admin/product-mappings">
            <input type="hidden" name="tabliyaProductId" id="map-tabliya-id">
            <input type="hidden" name="tabliyaProductName" id="map-tabliya-name">
            <div class="form-group"><label>Shopify Variant ID *</label><input name="shopifyVariantId" required placeholder="e.g. 12345678901234"></div>
            <div class="form-group"><label>Shopify SKU</label><input name="shopifySku"></div>
            <div class="form-group"><label>Shopify Product Title</label><input name="shopifyProductTitle"></div>
            <div class="form-group"><label>Tabliya Product</label><input id="map-label" readonly style="background:#f1f5f9;"></div>
            <div style="display:flex;gap:8px;">
              <button type="submit" class="btn btn-primary">Create Mapping</button>
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('map-modal').classList.remove('open')">Cancel</button>
            </div>
          </form>
        </div>
      </div>
      <script>
      function startMapping(id, name) {
        document.getElementById('map-tabliya-id').value = id;
        document.getElementById('map-tabliya-name').value = name;
        document.getElementById('map-label').value = id + ' — ' + name;
        document.getElementById('map-modal').classList.add('open');
      }
      </script>
    `;
    res.send(renderAdminLayout("Import Tabliya Products", content));
  } catch (err) {
    res.send(renderAdminLayout("Import Tabliya Products", `<div class="alert alert-error">Failed to connect to Tabliya: ${String(err)}</div>`));
  }
});

router.post("/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(productMappingsTable).where(eq(productMappingsTable.id, id));
  res.redirect("/api/admin/product-mappings");
});

router.post("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = req.body as Record<string, string>;
  await db
    .update(productMappingsTable)
    .set({
      shopifySku: body.shopifySku || null,
      shopifyProductTitle: body.shopifyProductTitle || null,
      shopifyVariantTitle: body.shopifyVariantTitle || null,
      tabliyaProductId: body.tabliyaProductId,
      tabliyaProductName: body.tabliyaProductName || null,
      active: body.active === "true",
      updatedAt: new Date(),
    })
    .where(eq(productMappingsTable.id, id));
  res.redirect("/api/admin/product-mappings");
});

export default router;
