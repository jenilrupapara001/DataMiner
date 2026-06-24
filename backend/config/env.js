module.exports = {
  port: process.env.PORT || 3001,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/easysell',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '15m',
  refreshTokenExpiresIn: '7d',
  marketSync: {
    username: process.env.MARKET_SYNC_USERNAME || 'demo-provider',
    password: process.env.MARKET_SYNC_PASSWORD || 'demo-pass',
    apiKey: process.env.MARKET_SYNC_API_KEY || ''
  }
};
