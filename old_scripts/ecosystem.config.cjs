// ecosystem.config.js
// PM2 Cluster Mode Configuration for RetailOps Backend
// Usage:
//   npm install -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   (auto-start on reboot)
//   pm2 monit                 (live dashboard)

module.exports = {
  apps: [
    {
      name: 'retailops-api',
      script: './backend/server.js',

      // ── Cluster mode: one worker per CPU core ──────────────────────────────
      instances: 'max',
      exec_mode: 'cluster',

      // ── Memory guard: restart worker if it exceeds 1 GB ───────────────────
      max_memory_restart: '1G',

      // ── Node flags ────────────────────────────────────────────────────────
      node_args: '--max-old-space-size=4096',

      // ── Environment ───────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
      },

      // ── Graceful shutdown ─────────────────────────────────────────────────
      kill_timeout: 5000,          // ms to wait before SIGKILL after SIGTERM
      listen_timeout: 10000,       // ms to wait for the app to listen on port
      shutdown_with_message: true, // send 'shutdown' message before SIGTERM

      // ── Auto-restart settings ─────────────────────────────────────────────
      autorestart: true,
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,

      // ── Logging ───────────────────────────────────────────────────────────
      error_file: './backend/logs/pm2-error.log',
      out_file: './backend/logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // ── File watching (disabled in production) ────────────────────────────
      watch: false,

      // ── Source maps for better error traces ───────────────────────────────
      source_map_support: true,
    },
  ],
};
