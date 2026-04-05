import type { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";

/**
 * Simple session-based admin auth.
 * For production, replace with proper JWT/OAuth.
 */
const ADMIN_USERNAME = config.ADMIN_USERNAME;
const ADMIN_PASSWORD_ENV = process.env["ADMIN_PASSWORD"] ?? "";

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow auth endpoint without auth
  if (req.path === "/login" && req.method === "POST") {
    next();
    return;
  }

  const session = (req as unknown as { session?: { adminUser?: string } }).session;
  if (session?.adminUser) {
    next();
    return;
  }

  // Also support Basic Auth for API clients
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Basic ")) {
    const b64 = authHeader.slice(6);
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const [user, pass] = decoded.split(":");
    if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD_ENV) {
      next();
      return;
    }
  }

  // Redirect to login for browser requests
  if (req.headers.accept?.includes("text/html")) {
    res.redirect("/api/admin/login");
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}
