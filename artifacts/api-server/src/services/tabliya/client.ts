import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";
import type {
  TabliyaProduct,
  TabliyaPaymentMethod,
  TabliyaOrderPayload,
  TabliyaOrderUpdatePayload,
  TabliyaOrder,
  TabliyaInvoice,
} from "../../types/index.js";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

function makeAxiosInstance(): AxiosInstance {
  return axios.create({
    baseURL: `${config.TABLIYA_BASE_URL}/api`,
    timeout: 15000,
    headers: { "Content-Type": "application/json" },
  });
}

async function login(): Promise<string> {
  const http = makeAxiosInstance();
  logger.info({ identifier: config.TABLIYA_IDENTIFIER }, "Logging into Tabliya");

  const res = await http.post<{ idToken: string; expiresIn: number }>("/auth/login", {
    identifier: config.TABLIYA_IDENTIFIER,
    password: config.TABLIYA_PASSWORD,
  });

  const { idToken, expiresIn } = res.data;
  tokenCache = {
    token: idToken,
    expiresAt: Date.now() + (expiresIn - 60) * 1000, // refresh 60s early
  };

  logger.info("Tabliya login successful, token cached");
  return idToken;
}

async function getValidToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  return login();
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidToken();
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(
  method: "get" | "post" | "put" | "delete",
  path: string,
  data?: unknown,
  retry = true
): Promise<T> {
  const http = makeAxiosInstance();
  const headers = await authHeaders();

  try {
    let res: AxiosResponse<T>;
    if (method === "get") {
      res = await http.get<T>(path, { headers });
    } else if (method === "post") {
      res = await http.post<T>(path, data, { headers });
    } else if (method === "put") {
      res = await http.put<T>(path, data, { headers });
    } else {
      res = await http.delete<T>(path, { headers });
    }
    return res.data;
  } catch (err: unknown) {
    if (
      axios.isAxiosError(err) &&
      err.response?.status === 401 &&
      retry
    ) {
      logger.warn("Tabliya 401 — refreshing token and retrying");
      tokenCache = null;
      return request<T>(method, path, data, false);
    }

    if (axios.isAxiosError(err)) {
      logger.error(
        {
          method,
          path,
          status: err.response?.status,
          body: err.response?.data,
        },
        "Tabliya API error"
      );
    }
    throw err;
  }
}

// --- Products ---

export async function listProducts(): Promise<TabliyaProduct[]> {
  return request<TabliyaProduct[]>("get", "/products");
}

export async function getProduct(id: number): Promise<TabliyaProduct> {
  return request<TabliyaProduct>("get", `/products/${id}`);
}

// --- Orders ---

export async function listOrders(): Promise<TabliyaOrder[]> {
  return request<TabliyaOrder[]>("get", "/orders");
}

export async function getOrder(id: number): Promise<TabliyaOrder> {
  return request<TabliyaOrder>("get", `/orders/${id}`);
}

export async function createOrder(payload: TabliyaOrderPayload): Promise<TabliyaOrder> {
  logger.info({ order_number: payload.order_number }, "Creating Tabliya order");
  return request<TabliyaOrder>("post", "/orders", payload);
}

export async function updateOrder(
  id: number,
  payload: TabliyaOrderUpdatePayload
): Promise<TabliyaOrder> {
  logger.info({ id }, "Updating Tabliya order");
  return request<TabliyaOrder>("put", `/orders/${id}`, payload);
}

export async function deleteOrder(id: number): Promise<void> {
  logger.info({ id }, "Deleting Tabliya order");
  return request<void>("delete", `/orders/${id}`);
}

export async function getOrderStatuses(): Promise<string[]> {
  return request<string[]>("get", "/orders/statuses");
}

// --- Payment Methods ---

export async function listPaymentMethods(): Promise<TabliyaPaymentMethod[]> {
  return request<TabliyaPaymentMethod[]>("get", "/payment-methods");
}

export async function createPaymentMethod(name: string): Promise<TabliyaPaymentMethod> {
  return request<TabliyaPaymentMethod>("post", "/payment-methods", { name });
}

export async function updatePaymentMethod(
  id: number,
  data: { name?: string; sort_order?: number }
): Promise<TabliyaPaymentMethod> {
  return request<TabliyaPaymentMethod>("put", `/payment-methods/${id}`, data);
}

export async function deletePaymentMethod(id: number): Promise<void> {
  return request<void>("delete", `/payment-methods/${id}`);
}

// --- Invoices ---

export async function listInvoices(): Promise<TabliyaInvoice[]> {
  return request<TabliyaInvoice[]>("get", "/invoices");
}

export async function getInvoiceByOrder(orderId: number): Promise<TabliyaInvoice | null> {
  try {
    return await request<TabliyaInvoice>("get", `/invoices/order/${orderId}`);
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function createInvoice(orderId: number): Promise<TabliyaInvoice> {
  return request<TabliyaInvoice>("post", "/invoices", { order_id: orderId });
}

export async function updateInvoice(
  id: number,
  data: Partial<{
    notes: string;
    payment_status: string;
    amount_paid: number;
    amount_remaining: number;
    buyer_name: string;
    street_name: string;
    house_number: string;
    zip_code: string;
  }>
): Promise<TabliyaInvoice> {
  return request<TabliyaInvoice>("put", `/invoices/${id}`, data);
}
