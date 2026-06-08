module.exports = {
  apps: [
    {
      name: 'retailops-api',
      script: './server.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Enable load balancing
      watch: false,
      max_memory_restart: '1500M', // Automatically restart if memory exceeds 1.5GB per thread
      // Keep-alive config to gracefully handle crashes
      min_uptime: 5000,
      max_restarts: 10,
      kill_timeout: 3000,
      // Prefix logs with real-time timestamps
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
