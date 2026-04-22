import { Router } from "express";
import { db } from "../../db/connection.js";
import { adminUsersTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../utils/password.js";
import { renderAdminLayout } from "./layout.js";
import { config } from "../../config/index.js";

const router = Router();

router.get("/", async (req, res) => {
  const msg = (req.query.msg as string) ?? "";
  const err = (req.query.err as string) ?? "";

  const dbUsers = await db
    .select({ id: adminUsersTable.id, username: adminUsersTable.username, createdAt: adminUsersTable.createdAt })
    .from(adminUsersTable)
    .orderBy(adminUsersTable.createdAt);

  const rowsHtml = dbUsers.length
    ? dbUsers
        .map(
          (u) => `
      <tr>
        <td>${u.username}</td>
        <td style="color:#6b7280;font-size:12px;">${new Date(u.createdAt).toLocaleString()}</td>
        <td>
          <form method="POST" action="/api/admin/users/${u.id}/delete" onsubmit="return confirm('Delete user ${u.username}?')">
            <button type="submit" class="btn btn-sm btn-danger">Delete</button>
          </form>
        </td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="color:#6b7280;text-align:center;padding:24px;">No additional admin users yet.</td></tr>`;

  const content = `
    ${msg ? `<div class="alert alert-success">${msg}</div>` : ""}
    ${err ? `<div class="alert alert-error">${err}</div>` : ""}

    <div class="card">
      <h3>Admin Users</h3>
      <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">
        The built-in admin <strong>${config.ADMIN_USERNAME}</strong> (set via environment variable) always has access and cannot be removed here.
        Add extra admins below — all have full access to the dashboard.
      </p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>Add New Admin</h3>
      <form method="POST" action="/api/admin/users">
        <div class="form-group">
          <label>Username</label>
          <input type="text" name="username" required placeholder="e.g. jane" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" required minlength="8" placeholder="Minimum 8 characters" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label>Confirm Password</label>
          <input type="password" name="confirm" required minlength="8" placeholder="Repeat password" autocomplete="new-password">
        </div>
        <button type="submit" class="btn btn-primary">Create Admin User</button>
      </form>
    </div>
  `;

  res.send(renderAdminLayout("Users", content));
});

router.post("/", async (req, res) => {
  const { username, password, confirm } = req.body as Record<string, string>;

  if (!username?.trim() || !password) {
    return res.redirect("/api/admin/users?err=Username+and+password+are+required");
  }
  if (password !== confirm) {
    return res.redirect("/api/admin/users?err=Passwords+do+not+match");
  }
  if (password.length < 8) {
    return res.redirect("/api/admin/users?err=Password+must+be+at+least+8+characters");
  }
  if (username.trim().toLowerCase() === config.ADMIN_USERNAME.toLowerCase()) {
    return res.redirect("/api/admin/users?err=That+username+is+reserved");
  }

  const existing = await db
    .select({ id: adminUsersTable.id })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.username, username.trim()))
    .limit(1);

  if (existing.length) {
    return res.redirect("/api/admin/users?err=Username+already+exists");
  }

  const passwordHash = await hashPassword(password);
  await db.insert(adminUsersTable).values({ username: username.trim(), passwordHash });

  res.redirect("/api/admin/users?msg=Admin+user+created+successfully");
});

router.post("/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!isNaN(id)) {
    await db.delete(adminUsersTable).where(eq(adminUsersTable.id, id));
  }
  res.redirect("/api/admin/users?msg=User+deleted");
});

export default router;
