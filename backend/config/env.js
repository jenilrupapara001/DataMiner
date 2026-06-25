module.exports = {
  port: process.env.PORT || 3001,
  // SQL Server (primary database)
  db: {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'YourStrong@Passw0rd',
    server: process.env.DB_SERVER || '31.97.62.95',
    database: process.env.DB_NAME || 'retailops',
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      useUTC: false
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '50'),
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      idleTimeoutMillis: 10000
    },
    requestTimeout: 120000,
    connectionTimeout: 60000
  },
  // JWT Auth
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '2h',
  refreshTokenExpiresIn: '7d',
  // Market sync
  marketSync: {
    username: process.env.MARKET_SYNC_USERNAME || 'demo-provider',
    password: process.env.MARKET_SYNC_PASSWORD || 'demo-pass',
    apiKey: process.env.MARKET_SYNC_API_KEY || ''
  }
};
