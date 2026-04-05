import { z } from "zod";

const configSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  SHOPIFY_STORE_DOMAIN: z.string().default(""),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().default(""),
  SHOPIFY_WEBHOOK_SECRET: z.string().default(""),
  TABLIYA_BASE_URL: z.string().default("http://localhost:5000"),
  TABLIYA_IDENTIFIER: z.string().default(""),
  TABLIYA_PASSWORD: z.string().default(""),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default(""),
  DEFAULT_DELIVERY_OFFSET_DAYS: z.coerce.number().default(1),
  DEFAULT_HOUSE_NUMBER: z.string().default("0"),
  ENABLE_INVOICE_SYNC: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid configuration:", parsed.error.flatten());
}

export const config = parsed.success ? parsed.data : configSchema.parse({
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://localhost/shopify_tabliya",
});
