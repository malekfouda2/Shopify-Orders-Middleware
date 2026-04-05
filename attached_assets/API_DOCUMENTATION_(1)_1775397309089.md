# Tabliya Management API Documentation

Complete API reference for all admin panel operations. **Every action in the admin panel is available via REST API** — both **query** (read) and **actions** (create, update, delete). You can create orders, delete orders, update products, add materials, and do anything the UI does, so you can integrate with Shopify or any external system.

**Base URL:** `http://localhost:5000/api` (or your server URL)

**Authentication:** All endpoints except login and public GETs (e.g. invoice header text) require JWT in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users Management](#users-management)
3. [Materials](#materials)
4. [Materials Stock](#materials-stock)
5. [Recipes](#recipes)
6. [Products](#products)
7. [Orders](#orders)
8. [Invoices](#invoices)
9. [Suppliers](#suppliers)
10. [Sales Dashboard](#sales-dashboard)
11. [User Logs](#user-logs)
12. [Profile & Auth](#profile--auth)
13. [App Settings](#app-settings)
14. [Payment Methods](#payment-methods)

---

## Quick reference: all action APIs (Create, Update, Delete)

Every action you can do in the admin panel has an API. Use these for Shopify or any integration.

| Action | Method | Endpoint |
|--------|--------|----------|
| **Orders** | | |
| Create order | `POST` | `/api/orders` |
| Update order | `PUT` | `/api/orders/<id>` |
| Delete order | `DELETE` | `/api/orders/<id>` |
| **Materials** | | |
| Create material | `POST` | `/api/materials` |
| Update material | `PUT` | `/api/materials/<id>` |
| Delete material | `DELETE` | `/api/materials/<id>` |
| Remove exact duplicates | `POST` | `/api/materials/remove-exact-duplicates` |
| Remove all duplicates | `POST` | `/api/materials/remove-all-duplicates` |
| Merge material into another | `POST` | `/api/materials/<id>/merge-into/<target_id>` |
| **Materials stock** | | |
| Create/update stock entry | `POST` | `/api/materials-stock` |
| Update stock entry | `PUT` | `/api/materials-stock/<id>` |
| Delete stock entry | `DELETE` | `/api/materials-stock/<id>` |
| Bulk update stock | `POST` | `/api/materials-stock/bulk-update` |
| **Recipes** | | |
| Create recipe | `POST` | `/api/recipes` |
| Update recipe | `PUT` | `/api/recipes/<id>` |
| Delete recipe | `DELETE` | `/api/recipes/<id>` |
| Add recipe ingredient | `POST` | `/api/recipes/<recipe_id>/items` |
| Update recipe ingredient | `PUT` | `/api/recipes/<recipe_id>/items/<item_id>` |
| Delete recipe ingredient | `DELETE` | `/api/recipes/<recipe_id>/items/<item_id>` |
| Calculate recipe cost | `POST` | `/api/recipes/calculate` |
| **Products** | | |
| Create product | `POST` | `/api/products` |
| Update product | `PUT` | `/api/products/<id>` |
| Delete product | `DELETE` | `/api/products/<id>` |
| **Invoices** | | |
| Create invoice (from order) | `POST` | `/api/invoices` |
| Update invoice | `PUT` | `/api/invoices/<id>` |
| Delete invoice | `DELETE` | `/api/invoices/<id>` |
| **Suppliers** | | |
| Create supplier | `POST` | `/api/suppliers` |
| Update supplier | `PUT` | `/api/suppliers/<id>` |
| Delete supplier | `DELETE` | `/api/suppliers/<id>` |
| Log suppliers analysis action | `POST` | `/api/suppliers-analysis/log` |
| Get suppliers analysis preferences | `GET` | `/api/suppliers-analysis/preferences` |
| Update suppliers analysis preferences | `PUT` | `/api/suppliers-analysis/preferences` |
| **Users** | | |
| Create user | `POST` | `/api/users` |
| Update user | `PUT` | `/api/users/<user_id>` |
| Delete user | `DELETE` | `/api/users/<user_id>` |
| **Profile & auth** | | |
| Update profile | `PATCH` | `/api/auth/profile` |
| Upload profile photo | `POST` | `/api/auth/profile/photo` |
| Change password | `POST` | `/api/auth/change-password` |
| **App settings** | | |
| Update invoice header text | `PUT` | `/api/settings/invoice-header-text` |
| **Payment methods** | | |
| List payment methods | `GET` | `/api/payment-methods` |
| Add payment method | `POST` | `/api/payment-methods` |
| Update payment method | `PUT` | `/api/payment-methods/<id>` |
| Delete payment method | `DELETE` | `/api/payment-methods/<id>` |

All of the above require `Authorization: Bearer <token>` except login. Query (read) endpoints are listed in the sections below.

---

## API coverage by area (control everything without the dashboard)

You can do **every** action in the app via API. Below is the mapping from each dashboard area to the APIs that power it.

| Area | What you can do | APIs (query + actions) |
|------|-----------------|-------------------------|
| **Materials** | List, view, create, edit, delete materials; find duplicates; remove duplicates; merge two materials | `GET /materials`, `GET /materials/<id>`, `GET /materials/duplicates`, `POST /materials`, `PUT /materials/<id>`, `DELETE /materials/<id>`, `POST /materials/remove-exact-duplicates`, `POST /materials/remove-all-duplicates`, `POST /materials/<id>/merge-into/<target_id>` |
| **Materials stock** | List, view, add/update stock entries, bulk update, delete | `GET /materials-stock`, `GET /materials-stock/<id>`, `GET /materials-stock/materials-list`, `POST /materials-stock`, `PUT /materials-stock/<id>`, `DELETE /materials-stock/<id>`, `POST /materials-stock/bulk-update` |
| **Recipes** | List, view, create, edit, delete recipes; add/edit/remove ingredients; calculate cost | `GET /recipes`, `GET /recipes/<id>`, `POST /recipes`, `PUT /recipes/<id>`, `DELETE /recipes/<id>`, `POST /recipes/<id>/items`, `PUT /recipes/<recipe_id>/items/<item_id>`, `DELETE /recipes/<recipe_id>/items/<item_id>`, `POST /recipes/calculate` |
| **Nutrition facts** | View nutrition (from recipes + materials); edit via materials/recipes | Same as **Recipes** and **Materials** — nutrition fields are on materials; recipes have portion_weight_grams. Use `GET /recipes`, `GET /materials` for data; `PUT /materials/<id>`, `PUT /recipes/<id>` to change nutrition. |
| **Products** | List, view, create, edit, delete products | `GET /products`, `GET /products/<id>`, `POST /products`, `PUT /products/<id>`, `DELETE /products/<id>` |
| **Product stock** | View and update product stock (quantity on hand) | `GET /products` (includes `quantity_available`), `PUT /products/<id>` with body `{ "quantity_available": 100 }` |
| **Orders** | List, view, create, edit, delete orders; change status; view statuses and statistics | `GET /orders`, `GET /orders/<id>`, `POST /orders`, `PUT /orders/<id>`, `DELETE /orders/<id>`, `GET /orders/statuses`, `GET /orders/statistics-table` |
| **Orders statistics** | View statistics table and filters | `GET /orders`, `GET /orders/statistics-table` |
| **Invoices** | List, view, create, update, delete invoices; get by order | `GET /invoices`, `GET /invoices/<id>`, `GET /invoices/order/<order_id>`, `POST /invoices`, `PUT /invoices/<id>`, `DELETE /invoices/<id>` |
| **Suppliers** | List, view, create, edit, delete suppliers and their prices | `GET /suppliers`, `GET /suppliers/<id>`, `POST /suppliers`, `PUT /suppliers/<id>`, `DELETE /suppliers/<id>` |
| **Suppliers analysis** | View comparison; hide/restore entries; log actions | `GET /suppliers`, `GET /materials` (data); `GET /suppliers-analysis/preferences`, `PUT /suppliers-analysis/preferences` (hidden state); `POST /suppliers-analysis/log` (log action) |
| **Users** | List, view, create, edit, delete users (admin) | `GET /users`, `GET /users/<id>`, `POST /users`, `PUT /users/<id>`, `DELETE /users/<id>` |
| **User logs** | View and filter audit logs (read-only) | `GET /user-logs`, `GET /user-logs/<id>`, `GET /user-logs/stats` (query params: entity_type, action, date_from, date_to, limit) |
| **Profile / auth** | Login, get/update profile, photo, change password | `POST /auth/login`, `GET /auth/profile`, `PATCH /auth/profile`, `POST /auth/profile/photo`, `POST /auth/change-password` |
| **App settings** | Invoice header text (shown on all invoices) | `GET /settings/invoice-header-text`, `PUT /settings/invoice-header-text` |
| **Payment** | List, add, update, delete payment methods (e.g. Tikkie, iDeal); used in orders and invoices | `GET /payment-methods`, `POST /payment-methods`, `PUT /payment-methods/<id>`, `DELETE /payment-methods/<id>` |
| **Sales dashboard** | Revenue, cost, profit, charts | `GET /sales/dashboard` |

---

## Authentication

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "username_or_email",
  "password": "password"
}
```

**Response:**
```json
{
  "idToken": "jwt_token_here",
  "expiresIn": 604800,
  "localId": "1",
  "username": "your_username",
  "email": "your_email@example.com",
  "role": "super_admin",
  "profile_photo": null,
  "phone_number": null
}
```
Use `idToken` in the `Authorization: Bearer <token>` header for all other requests.

---

## Users Management

### List Users
```http
GET /api/users
Authorization: Bearer <token>
```

### Create User
```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "role": "user"  // "user" | "admin" | "super_admin"
}
```

### Get User
```http
GET /api/users/<user_id>
Authorization: Bearer <token>
```

### Update User
```http
PUT /api/users/<user_id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "updated_username",
  "email": "updated@example.com",
  "password": "new_password",  // optional
  "role": "admin",  // optional
  "is_active": true  // optional
}
```

### Delete User
```http
DELETE /api/users/<user_id>
Authorization: Bearer <token>
```

---

## Materials

### List Materials
```http
GET /api/materials
Authorization: Bearer <token>
```

### Get Material
```http
GET /api/materials/<id>
Authorization: Bearer <token>
```

### Create Material
```http
POST /api/materials
Authorization: Bearer <token>
Content-Type: application/json

{
  "material_name": "Flour",
  "price": 10.50,
  "quantity_purchased": 5,
  "unit": "kg",
  "price_includes_tax": true,
  "tax_percentage": 9,
  "source": "Supplier Name",
  "location": "Cairo",
  "is_non_food": false,
  "energy_per_100g": 364,
  "protein_per_100g": 10,
  "fat_per_100g": 1,
  "carbohydrate_per_100g": 76,
  "fiber_per_100g": 2.7
}
```

### Update Material
```http
PUT /api/materials/<id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "material_name": "Updated Name",
  "price": 12.00,
  "quantity_purchased": 10,
  "unit": "kg",
  // ... other fields
}
```

### Delete Material
```http
DELETE /api/materials/<id>
Authorization: Bearer <token>
```

### Get Duplicate Materials
```http
GET /api/materials/duplicates
Authorization: Bearer <token>
```

### Remove Exact Duplicates
```http
POST /api/materials/remove-exact-duplicates
Authorization: Bearer <token>
```

### Remove All Duplicates
```http
POST /api/materials/remove-all-duplicates
Authorization: Bearer <token>
```

### Merge Material
```http
POST /api/materials/<source_id>/merge-into/<target_id>
Authorization: Bearer <token>
```

---

## Materials Stock

### Get Materials Stock
```http
GET /api/materials-stock
Authorization: Bearer <token>
```

### Get Material Stock (single)
```http
GET /api/materials-stock/<id>
Authorization: Bearer <token>
```

### Get Materials List
```http
GET /api/materials-stock/materials-list
Authorization: Bearer <token>
```

### Create or Update Material Stock
```http
POST /api/materials-stock
Authorization: Bearer <token>
Content-Type: application/json

{
  "material_name": "Flour",
  "quantity": 50,
  "unit": "kg"
}
```

### Update Material Stock
```http
PUT /api/materials-stock/<id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 75,
  "unit": "kg"
}
```

### Bulk Update Materials Stock
```http
POST /api/materials-stock/bulk-update
Authorization: Bearer <token>
Content-Type: application/json

{
  "updates": [
    {"material_name": "Flour", "quantity": 50, "unit": "kg"},
    {"material_name": "Sugar", "quantity": 30, "unit": "kg"}
  ]
}
```

### Delete Material Stock
```http
DELETE /api/materials-stock/<id>
Authorization: Bearer <token>
```

---

## Recipes

### List Recipes
```http
GET /api/recipes
Authorization: Bearer <token>
```

### Get Recipe
```http
GET /api/recipes/<id>
Authorization: Bearer <token>
```

### Create Recipe
```http
POST /api/recipes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Bread Recipe",
  "yield_amount": 10,
  "yield_unit": "pieces",
  "portion_weight_grams": 50,
  "notes": "Recipe notes"
}
```

### Update Recipe
```http
PUT /api/recipes/<id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Recipe Name",
  "yield_amount": 12,
  "yield_unit": "pieces",
  "portion_weight_grams": 55,
  "notes": "Updated notes"
}
```

### Delete Recipe
```http
DELETE /api/recipes/<id>
Authorization: Bearer <token>
```

### Add Recipe Ingredient
```http
POST /api/recipes/<recipe_id>/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "material_id": 1,
  "quantity": 2.5
}
```

### Update Recipe Ingredient
```http
PUT /api/recipes/<recipe_id>/items/<item_id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 3.0
}
```

### Delete Recipe Ingredient
```http
DELETE /api/recipes/<recipe_id>/items/<item_id>
Authorization: Bearer <token>
```

### Calculate Recipe Cost
```http
POST /api/recipes/calculate
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {"material_id": 1, "quantity": 2.5},
    {"material_id": 2, "quantity": 1.0}
  ]
}
```

---

## Products

### List Products
```http
GET /api/products
Authorization: Bearer <token>
```

### Get Product
```http
GET /api/products/<id>
Authorization: Bearer <token>
```

### Create Product
```http
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipe_id": 1,
  "recipe_quantity": 1,
  "name": "Bread",
  "price": 5.50,
  "tax_enabled": true,
  "tax_percentage": 9,
  "quantity_available": 100,
  "traceable": true
}
```

### Update Product
```http
PUT /api/products/<id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Product Name",
  "price": 6.00,
  "quantity_available": 150,
  "tax_percentage": 9
}
```

### Delete Product
```http
DELETE /api/products/<id>
Authorization: Bearer <token>
```

---

## Orders

### List Orders
```http
GET /api/orders
Authorization: Bearer <token>
```

### Get Order
```http
GET /api/orders/<id>
Authorization: Bearer <token>
```

### Create Order
```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "order_number": "ORD-001",
  "order_date": "2024-01-15",
  "delivery_date": "2024-01-20",
  "buyer_name": "Customer Name",
  "payment_status": "paid",  // "paid" | "unpaid" | "partial"
  "amount_paid_partial": 0,  // required if payment_status is "partial"
  "street_name": "Main Street",
  "house_number": "123",
  "zip_code": "12345",
  "notes": "Order notes",
  "payment_method": "Tikkie",
  "items": [
    {
      "product_id": 1,
      "quantity": 10,
      "discount_percent": 5,
      "notes": "Item notes"
    }
  ]
}
```

### Update Order
```http
PUT /api/orders/<id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "ready_to_start",  // see ORDER_STATUSES
  "notes": "Updated notes",
  "buyer_name": "Updated Name",
  "order_date": "2024-01-16",
  "delivery_date": "2024-01-21",
  "payment_status": "paid",
  "payment_method": "Tikkie",
  "amount_paid_partial": 0,
  "street_name": "New Street",
  "house_number": "456",
  "zip_code": "67890"
}
```

### Delete Order
```http
DELETE /api/orders/<id>
Authorization: Bearer <token>
```

### Get Order Statuses
```http
GET /api/orders/statuses
Authorization: Bearer <token>
```

### Get Orders Statistics Table
```http
GET /api/orders/statistics-table
Authorization: Bearer <token>
```

---

## Invoices

### List Invoices
```http
GET /api/invoices
Authorization: Bearer <token>
```

### Get Invoice
```http
GET /api/invoices/<id>
Authorization: Bearer <token>
```

### Create Invoice
```http
POST /api/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "order_id": 1
}
```
Invoice number, dates, totals, payment, and `payment_method` are derived from the order. One invoice per order. Response includes `payment_method` (from order).

### Get Invoice by Order
```http
GET /api/invoices/order/<order_id>
Authorization: Bearer <token>
```

### Update Invoice
```http
PUT /api/invoices/<id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "notes": "Invoice notes",
  "payment_status": "paid",
  "amount_paid": 100.00,
  "amount_remaining": 0,
  "buyer_name": "Customer Name",
  "street_name": "Street",
  "house_number": "123",
  "zip_code": "1014ZB"
}
```
Optional fields. Used to sync payment or address from external systems (e.g. Shopify).

### Delete Invoice
```http
DELETE /api/invoices/<id>
Authorization: Bearer <token>
```

---

## Suppliers

### List Suppliers
```http
GET /api/suppliers
Authorization: Bearer <token>
```

### Get Supplier
```http
GET /api/suppliers/<id>
Authorization: Bearer <token>
```

### Create Supplier
```http
POST /api/suppliers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Supplier Name",
  "phone": "+201234567890",
  "email": "supplier@example.com",
  "address": "Supplier Address",
  "prices": [
    {
      "material_name": "Flour",
      "quantity": 10,
      "unit": "kg",
      "price_per_unit": 8.50
    }
  ]
}
```

### Update Supplier
```http
PUT /api/suppliers/<id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Supplier Name",
  "phone": "+201234567891",
  "email": "updated@example.com",
  "address": "Updated Address",
  "prices": [
    {
      "material_name": "Flour",
      "quantity": 10,
      "unit": "kg",
      "price_per_unit": 9.00
    }
  ]
}
```

### Delete Supplier
```http
DELETE /api/suppliers/<id>
Authorization: Bearer <token>
```

### Get Suppliers Analysis Preferences
```http
GET /api/suppliers-analysis/preferences
Authorization: Bearer <token>
```
Returns which entries are hidden in the analysis view: `{ "hiddenMaterialLogIds": [...], "hiddenSupplierTierKeys": [...] }`. Use this so an external system can replicate or control the view without the dashboard.

### Update Suppliers Analysis Preferences
```http
PUT /api/suppliers-analysis/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "hiddenMaterialLogIds": [1, 2, 3],
  "hiddenSupplierTierKeys": ["1_Flour_10_kg", "2_Sugar_5_kg"]
}
```
Set which material logs and supplier tier rows are hidden in the analysis. Omit a key to leave it unchanged; send empty arrays to clear.

### Log Suppliers Analysis Action
```http
POST /api/suppliers-analysis/log
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "hide_from_suppliers_analysis",  // or "restore_to_suppliers_analysis" | "reset_suppliers_analysis_hidden"
  "details": {
    "type": "material_log",
    "material_log_id": 67
  }
}
```

---

## Sales Dashboard

### Get Sales Dashboard
```http
GET /api/sales/dashboard
Authorization: Bearer <token>
```

**Response includes:**
- Summary cards (total revenue, total cost, net profit)
- Summary bars (Gross Sales, Total Cost, Net Profit)
- Revenue by date chart data
- Orders by status chart data
- Top products by revenue
- Top products by net profit

---

## User Logs

### Get User Logs
```http
GET /api/user-logs?entity_type=<type>&action=<action>&date_from=<YYYY-MM-DD>&date_to=<YYYY-MM-DD>&limit=<number>
Authorization: Bearer <token>
```

**Query Parameters:**
- `entity_type`: Filter by entity type (e.g., "order", "product", "material")
- `action`: Filter by action (e.g., "create_order", "update_product")
- `date_from`: Filter from date (YYYY-MM-DD)
- `date_to`: Filter to date (YYYY-MM-DD)
- `limit`: Maximum number of logs (default: 1000)

### Get User Log
```http
GET /api/user-logs/<id>
Authorization: Bearer <token>
```

### Get User Logs Statistics
```http
GET /api/user-logs/stats
Authorization: Bearer <token>
```

---

## Profile & Auth

### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

### Update Profile
```http
PATCH /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "updated@example.com",
  "phone_number": "+201234567890"
}
```

### Upload Profile Photo
```http
POST /api/auth/profile/photo
Authorization: Bearer <token>
Content-Type: application/json

{
  "photo": "data:image/jpeg;base64,..."
}
```
Body: JSON with base64 data URL in `photo` field.

### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "old_password",
  "new_password": "new_password",
  "confirm_password": "new_password"
}
```

---

## App Settings

Settings used across the app (e.g. invoice template). Useful for integrations.

### Get Invoice Header Text
```http
GET /api/settings/invoice-header-text
```
No auth required. Returns the custom text shown at the top of all invoices (e.g. company address, KVK, BTW).

**Response:** `{ "value": "..." }`

### Update Invoice Header Text
```http
PUT /api/settings/invoice-header-text
Authorization: Bearer <token>
Content-Type: application/json

{
  "value": "Tabliya\nHouthavenkade 120\n..."
}
```
Admin only. Applies to all current and future invoices.

---

## Payment Methods

Payment methods (e.g. Tikkie, iDeal, Cash) are used on the Payment page and when creating/editing orders. Every action on the Payment page has an API.

### List Payment Methods
```http
GET /api/payment-methods
Authorization: Bearer <token>
```

**Response:** `[{ "id": 1, "name": "Tikkie", "sort_order": 0 }, ...]`

### Add Payment Method
```http
POST /api/payment-methods
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Tikkie"
}
```
Returns the created payment method. Duplicate names return 400.

### Update Payment Method
```http
PUT /api/payment-methods/<id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Tikkie (link)",
  "sort_order": 1
}
```
Both fields optional. Used to rename or reorder.

### Delete Payment Method
```http
DELETE /api/payment-methods/<id>
Authorization: Bearer <token>
```
Removes the option from the list. Orders and invoices keep their stored `payment_method` string; this only removes the option from the dropdown.

---

## Notes

1. **API-first** – Every admin panel action (create, update, delete, list, filter, settings) is available via these APIs for Shopify or other integrations.
2. **All operations are logged** – Create, update, delete actions are recorded in user logs (see User Logs API).
3. **Authentication** – All endpoints except `POST /auth/login` and `GET /settings/invoice-header-text` require `Authorization: Bearer <idToken>`.
4. **Error responses** – Errors return JSON with `{"error": "message"}` and appropriate status code.
5. **Date formats** – Use `YYYY-MM-DD` for dates.
6. **Decimal values** – Use numbers (not strings) for decimals in JSON.

---

## Example Usage

### Create an Order via API

```bash
# 1. Login to get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "your_username_or_email", "password": "your_password"}'

# Response: {"idToken": "eyJ...", "expiresIn": 604800, ...}

# 2. Create order with token
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer <idToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "order_number": "ORD-001",
    "order_date": "2024-01-15",
    "delivery_date": "2024-01-20",
    "buyer_name": "Customer Name",
    "payment_status": "paid",
    "items": [{"product_id": 1, "quantity": 10}]
  }'
```

---

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error
