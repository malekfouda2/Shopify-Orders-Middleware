import { Router } from "express";
import crypto from "crypto";
import { config } from "../../config/index.js";
import { sessions } from "./index.js";
import { db } from "../../db/connection.js";
import { adminUsersTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../../utils/password.js";

const router = Router();

router.get("/login", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login — Shopify Tabliya Integration</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 12px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
    p { color: #6b7280; font-size: 14px; margin-bottom: 28px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input { width: 100%; padding: 10px 14px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #6366f1; }
    .field { margin-bottom: 18px; }
    button { width: 100%; padding: 12px; background: #6366f1; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #4f46e5; }
    .error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔗 Integration Admin</h1>
    <p>Shopify → Tabliya sync dashboard</p>
    <form method="POST" action="/api/admin/login">
      <div class="field">
        <label>Username</label>
        <input type="text" name="username" required autofocus>
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" name="password" required>
      </div>
      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>`);
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  const adminPass = process.env["ADMIN_PASSWORD"] ?? "";

  let authenticated = false;

  // Check the built-in env-based admin first
  if (username === config.ADMIN_USERNAME && password === adminPass) {
    authenticated = true;
  }

  // If not matched, check DB-managed admin users
  if (!authenticated) {
    const [dbUser] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.username, username.trim()))
      .limit(1);

    if (dbUser && await verifyPassword(password, dbUser.passwordHash)) {
      authenticated = true;
    }
  }

  if (authenticated) {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { adminUser: username, createdAt: Date.now() });
    (res as any).cookie("admin_session", token, {
      httpOnly: true,
      maxAge: 86400 * 1000, // 24h
      sameSite: "lax",
    });
    res.redirect("/api/admin");
    return;
  }

  res.status(401).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Login Failed</title>
<style>* { box-sizing: border-box; } body { font-family: -apple-system, sans-serif; background: #f0f2f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; } .card { background: white; border-radius: 12px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); } h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; } .error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; } label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; } input { width: 100%; padding: 10px 14px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; } .field { margin-bottom: 18px; } button { width: 100%; padding: 12px; background: #6366f1; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; } </style>
</head>
<body>
  <div class="card">
    <h1>Admin Login</h1>
    <div class="error">Invalid username or password</div>
    <form method="POST" action="/api/admin/login">
      <div class="field"><label>Username</label><input type="text" name="username" required></div>
      <div class="field"><label>Password</label><input type="password" name="password" required></div>
      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>`);
});

function handleLogout(req: any, res: any) {
  const token = req.sessionToken;
  if (token) sessions.delete(token);
  res.clearCookie("admin_session");
  res.redirect("/api/admin/login");
}

router.get("/logout", handleLogout);
router.post("/logout", handleLogout);

export default router;
