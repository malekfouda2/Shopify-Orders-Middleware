module.exports = {
  apps: [
    {
      name: "tabliya-api",
      script: "dist/index.mjs",
      node_args: "--enable-source-maps",
      cwd: "/opt/tabliya/artifacts/api-server",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "8000",
      },
      env_file: "/opt/tabliya/.env",
      error_file: "/opt/tabliya/logs/error.log",
      out_file: "/opt/tabliya/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
