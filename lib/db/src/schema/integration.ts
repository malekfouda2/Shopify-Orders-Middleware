import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

export const webhookEventsTable = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().default("shopify"),
  topic: text("topic").notNull(),
  shopDomain: text("shop_domain"),
  webhookId: text("webhook_id"),
  shopifyOrderId: text("shopify_order_id"),
  shopifyOrderAdminGraphqlId: text("shopify_order_admin_graphql_id"),
  rawHeaders: jsonb("raw_headers"),
  rawBody: text("raw_body").notNull(),
  parsedBody: jsonb("parsed_body"),
  signatureValid: boolean("signature_valid").notNull().default(false),
  processingStatus: text("processing_status").notNull().default("pending"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderSyncsTable = pgTable("order_syncs", {
  id: serial("id").primaryKey(),
  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  shopifyOrderName: text("shopify_order_name"),
  shopifyOrderNumber: integer("shopify_order_number"),
  shopifyFinancialStatus: text("shopify_financial_status"),
  shopifyFulfillmentStatus: text("shopify_fulfillment_status"),
  tabliyaOrderId: text("tabliya_order_id"),
  tabliyaOrderNumber: text("tabliya_order_number"),
  lastSyncAction: text("last_sync_action"),
  syncStatus: text("sync_status").notNull().default("pending"),
  failureReason: text("failure_reason"),
  requestPayload: jsonb("request_payload"),
  responsePayload: jsonb("response_payload"),
  webhookEventId: integer("webhook_event_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productMappingsTable = pgTable("product_mappings", {
  id: serial("id").primaryKey(),
  shopifyProductId: text("shopify_product_id").unique(),
  shopifyVariantId: text("shopify_variant_id").unique(),
  shopifySku: text("shopify_sku"),
  shopifyProductTitle: text("shopify_product_title"),
  shopifyVariantTitle: text("shopify_variant_title"),
  tabliyaProductId: text("tabliya_product_id").notNull(),
  tabliyaProductName: text("tabliya_product_name"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentMethodMappingsTable = pgTable("payment_method_mappings", {
  id: serial("id").primaryKey(),
  shopifyPaymentLabel: text("shopify_payment_label").notNull(),
  tabliyaPaymentMethod: text("tabliya_payment_method").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const syncJobLogsTable = pgTable("sync_job_logs", {
  id: serial("id").primaryKey(),
  jobType: text("job_type").notNull(),
  jobStatus: text("job_status").notNull(),
  referenceId: text("reference_id"),
  message: text("message"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const manualReviewItemsTable = pgTable("manual_review_items", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  reason: text("reason").notNull(),
  payload: jsonb("payload"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
export type InsertWebhookEvent = typeof webhookEventsTable.$inferInsert;
export type OrderSync = typeof orderSyncsTable.$inferSelect;
export type InsertOrderSync = typeof orderSyncsTable.$inferInsert;
export type ProductMapping = typeof productMappingsTable.$inferSelect;
export type InsertProductMapping = typeof productMappingsTable.$inferInsert;
export type PaymentMethodMapping = typeof paymentMethodMappingsTable.$inferSelect;
export type InsertPaymentMethodMapping = typeof paymentMethodMappingsTable.$inferInsert;
export type AppSetting = typeof appSettingsTable.$inferSelect;
export type SyncJobLog = typeof syncJobLogsTable.$inferSelect;
export type ManualReviewItem = typeof manualReviewItemsTable.$inferSelect;
