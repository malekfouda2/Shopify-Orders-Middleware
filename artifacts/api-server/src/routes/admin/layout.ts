export function renderAdminLayout(title: string, content: string, activePage?: string): string {
  const nav = [
    { href: "/api/admin", label: "Dashboard", icon: "📊" },
    { href: "/api/admin/product-mappings", label: "Product Mappings", icon: "🏷️" },
    { href: "/api/admin/payment-method-mappings", label: "Payment Methods", icon: "💳" },
    { href: "/api/admin/webhook-events", label: "Webhooks", icon: "🔔" },
    { href: "/api/admin/sync-logs", label: "Sync Logs", icon: "📋" },
    { href: "/api/admin/manual-review", label: "Manual Review", icon: "🔍" },
    { href: "/api/admin/settings", label: "Settings", icon: "⚙️" },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Shopify Tabliya Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; min-height: 100vh; display: flex; }

    /* Sidebar */
    .sidebar { width: 240px; background: #1e293b; color: white; height: 100vh; position: fixed; top: 0; left: 0; overflow-y: auto; }
    .sidebar-header { padding: 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .sidebar-header h1 { font-size: 14px; font-weight: 700; color: #f8fafc; letter-spacing: 0.5px; text-transform: uppercase; }
    .sidebar-header p { font-size: 11px; color: #94a3b8; margin-top: 3px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #94a3b8; text-decoration: none; font-size: 13px; transition: all 0.15s; }
    .nav-item:hover, .nav-item.active { background: rgba(255,255,255,0.08); color: white; }
    .nav-item.active { border-left: 3px solid #6366f1; padding-left: 13px; }

    /* Main */
    .main { margin-left: 240px; flex: 1; min-height: 100vh; }
    .header { background: white; border-bottom: 1px solid #e2e8f0; padding: 16px 28px; display: flex; align-items: center; justify-content: space-between; }
    .header h2 { font-size: 20px; font-weight: 700; color: #1e293b; }
    .header-actions { display: flex; gap: 10px; }
    .content { padding: 28px; }

    /* Stats grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .stat-card { background: white; border-radius: 10px; padding: 20px; border: 1px solid #e2e8f0; }
    .stat-card.danger { border-left: 4px solid #ef4444; }
    .stat-card.warning { border-left: 4px solid #f59e0b; }
    .stat-label { font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 28px; font-weight: 800; color: #1e293b; margin-top: 6px; }

    /* Two col */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

    /* Tables */
    .section-title { font-size: 15px; font-weight: 700; margin-bottom: 12px; color: #1e293b; }
    .table-wrap { background: white; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 24px; }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table thead { background: #f8fafc; }
    .table th { padding: 10px 14px; text-align: left; font-weight: 600; color: #6b7280; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
    .table td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .table tr:last-child td { border-bottom: none; }
    .table tr:hover td { background: #f8fafc; }
    .table a { color: #6366f1; text-decoration: none; }
    .table a:hover { text-decoration: underline; }

    /* Badges / Status */
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #e0e7ff; color: #4338ca; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .status.synced, .status.processed { background: #dcfce7; color: #166534; }
    .status.failed { background: #fef2f2; color: #dc2626; }
    .status.pending { background: #fef9c3; color: #854d0e; }
    .status.cancelled { background: #f1f5f9; color: #64748b; }
    .status.duplicate, .status.skipped { background: #f0f9ff; color: #0369a1; }

    /* Forms */
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 5px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 13px; background: white; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #6366f1; }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; transition: all 0.15s; }
    .btn-primary { background: #6366f1; color: white; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .btn-danger:hover { background: #fecaca; }
    .btn-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .btn-success:hover { background: #bbf7d0; }
    .btn-sm { padding: 5px 10px; font-size: 12px; }

    /* Alert */
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
    .alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .alert-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .alert-info { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }

    /* Card */
    .card { background: white; border-radius: 10px; border: 1px solid #e2e8f0; padding: 24px; margin-bottom: 20px; }
    .card h3 { font-size: 15px; font-weight: 700; margin-bottom: 16px; }

    /* Code */
    pre { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; white-space: pre-wrap; word-break: break-word; }

    /* Pagination */
    .pagination { display: flex; gap: 8px; align-items: center; padding: 16px; }
    .pagination a { padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px; text-decoration: none; color: #374151; }
    .pagination a:hover { background: #f1f5f9; }
    .pagination .current { background: #6366f1; color: white; border-color: #6366f1; }

    /* Filters */
    .filters { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
    .filters input, .filters select { padding: 8px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 13px; }

    /* Modal overlay */
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; align-items: center; justify-content: center; }
    .modal-overlay.open { display: flex; }
    .modal { background: white; border-radius: 12px; padding: 28px; max-width: 520px; width: 100%; max-height: 80vh; overflow-y: auto; }
    .modal h3 { font-size: 16px; font-weight: 700; margin-bottom: 16px; }

    @media (max-width: 768px) {
      .sidebar { width: 0; overflow: hidden; }
      .main { margin-left: 0; }
      .two-col { grid-template-columns: 1fr; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <nav class="sidebar">
    <div class="sidebar-header">
      <h1>🔗 Integration</h1>
      <p>Shopify → Tabliya</p>
    </div>
    ${nav.map((n) => `<a href="${n.href}" class="nav-item ${title === n.label || (n.href === "/api/admin" && title === "Dashboard") ? "active" : ""}">${n.icon} ${n.label}</a>`).join("")}
    <a href="/api/admin/logout" class="nav-item" style="margin-top: auto; color: #94a3b8;">🚪 Logout</a>
  </nav>
  <div class="main">
    <div class="header">
      <h2>${title}</h2>
    </div>
    <div class="content">${content}</div>
  </div>
</body>
</html>`;
}
