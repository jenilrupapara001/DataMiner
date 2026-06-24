const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../database/db');

class TokenBlacklistService {
  constructor() {
    this.useMemory = false;
    this.memoryBlacklist = new Map();
    this.userBlacklist = new Map();

    try {
      this.redis = new (require('ioredis'))({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        maxRetriesPerRequest: 1,
      });

      this.redis.on('error', () => {
        if (!this.useMemory) {
          console.warn('⚠️ Redis error — falling back to in-memory blacklist');
          this.useMemory = true;
        }
      });

      this.redis.connect().then(() => {
        console.log('✅ Redis connected for token blacklist');
      }).catch(() => {
        console.warn('⚠️ Redis unavailable — using in-memory blacklist');
        this.useMemory = true;
      });
    } catch (e) {
      console.warn('⚠️ Redis init failed — using in-memory blacklist');
      this.useMemory = true;
    }

    if (this.useMemory) {
      setInterval(() => this._cleanupMemory(), 5 * 60 * 1000);
    }
  }

  async blacklist(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded?.exp) return false;
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl <= 0) return false;

      if (this.useMemory) {
        this.memoryBlacklist.set(token, Date.now() + ttl * 1000);
      } else {
        await this.redis.setex(`bl:${token}`, ttl, '1');
      }
      return true;
    } catch (error) {
      console.error('Blacklist error:', error.message);
      return false;
    }
  }

  async isBlacklisted(token) {
    try {
      if (this.useMemory) {
        const expiry = this.memoryBlacklist.get(token);
        if (!expiry) return false;
        if (Date.now() > expiry) { this.memoryBlacklist.delete(token); return false; }
        return true;
      }
      const result = await this.redis.get(`bl:${token}`);
      return result === '1';
    } catch (error) {
      return false;
    }
  }

  async blacklistUser(userId) {
    const now = Date.now().toString();
    try {
      if (this.useMemory) {
        this.userBlacklist.set(userId, now);
        setTimeout(() => this.userBlacklist.delete(userId), 24 * 60 * 60 * 1000);
      } else {
        await this.redis.setex(`ubl:${userId}`, 24 * 60 * 60, now);
      }

      const pool = await getPool();
      await pool.request()
        .input('userId', sql.VarChar, userId)
        .query('UPDATE Users SET RefreshToken = NULL WHERE Id = @userId');
      return true;
    } catch (error) {
      console.error('Blacklist user error:', error.message);
      return false;
    }
  }

  async isUserBlacklisted(userId, tokenIssuedAt) {
    try {
      let blacklistedAt;
      if (this.useMemory) {
        blacklistedAt = this.userBlacklist.get(userId);
      } else {
        blacklistedAt = await this.redis.get(`ubl:${userId}`);
      }
      if (!blacklistedAt) return false;
      return (tokenIssuedAt || 0) * 1000 < parseInt(blacklistedAt);
    } catch (error) {
      return false;
    }
  }

  _cleanupMemory() {
    const now = Date.now();
    let cleaned = 0;
    for (const [token, expiry] of this.memoryBlacklist.entries()) {
      if (now > expiry) { this.memoryBlacklist.delete(token); cleaned++; }
    }
    if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} expired blacklist entries`);
  }
}

module.exports = new TokenBlacklistService();
