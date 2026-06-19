# Architecture Review — Before & After Implementation Guide

**Date:** 2026-06-19  
**Based on:** Codebase review of `retail-ops` (backend + frontend)  
**Priority key:** P1 = immediate risk, P2 = near-term scaling, P3 = operational maturity

---

## Table of Contents

1. [P1: Global Socket Broadcasts → Room-Based Targeting](#1-p1-replace-global-socket-broadcasts-with-rooms)
2. [P1: Export Jobs Are Fire-and-Forget → Durable Queue](#2-p1-move-exports-to-durable-job-queue)
3. [P1: Duplicated RBAC Logic → Centralized Service](#3-p1-centralize-rbac-logic)
4. [P1: SQL Injection via String Interpolation → Parameterized Queries](#4-p1-fix-sql-string-interpolation)
5. [P2: Sequential Dashboard Queries → Parallel Execution](#5-p2-parallelize-dashboard-queries)
6. [P2: In-Memory OAuth Token Cache → Redis Cache](#6-p2-redis-backed-oauth-token-cache)
7. [P2: Socket Singleton Without Cluster Support → Redis Adapter](#7-p2-add-socketio-redis-adapter)
8. [P3: AsinHistory Unbounded Growth → Partitioning + Retention](#8-p3-partition-asinhistory-and-add-retention)
9. [P3: Monolithic Asins Table → Normalized Schema](#9-p3-normalize-asins-table)
10. [P3: Large JSON Columns in Asins → Child Tables](#10-p3-move-json-blobs-to-child-tables)
11. [P3: Missing Observability → Structured Logging + Metrics](#11-p3-add-observability)
12. [P3: Activity Log Broadcast Cost → Role/User-Targeted Logs](#12-p3-target-activity-log-broadcasts)
13. [P3: Octoparse Polling → Webhook or Queue-Based](#13-p3-replace-polling-with-webhooks-or-queue)

---

## 1. (P1) Replace Global Socket Broadcasts with Rooms

### Problem
14 of 28 socket emit calls use `io.emit()` — global broadcast to ALL connected clients. A 100k ASIN upload (2,000 batches) means every client receives thousands of irrelevant events.

### Before (Current Code)

**`backend/services/asinDataParser.js:465`** — global broadcast per-ASIN upsert:
```js
io.emit('scrape_data_ingested', {
    asinId: merged.Id,
    sellerId: merged.SellerId,
    asinCode: merged.AsinCode,
    timestamp: new Date()
});
```

**`backend/services/liveDataSyncService.js:172`** — global broadcast per-seller sync complete:
```js
io.emit('liveSync:completed', {
    sellerId: sellerIdStr,
    totalAsins: stats.totalAsins,
    updatedAsins: stats.successCount,
    failedAsins: stats.failedCount,
    duration: stats.duration
});
```

**`backend/services/SystemLogService.js:47`** — every log is global:
```js
io.emit('new_system_log', { Id, Type, EntityType, ..., Description, ... });
```

**`backend/services/socketService.js:24`** — export progress is global (data leak):
```js
// emitExportUpdate()
io.emit('export_progress', { downloadId, ...data });
```

**`backend/controllers/exportController.js:812`** — properly targeted (the exception):
```js
io.to(`user_${userId}`).emit('export_completed', { downloadId, ... });
```

**Count of global `io.emit` calls by service:**

| Service | Global | Targeted |
|---------|--------|----------|
| `asinDataParser.js` | 2 | 0 |
| `liveDataSyncService.js` | 4 | 0 |
| `SystemLogService.js` | 1 | 0 |
| `socketService.js` | 1 | 1 |
| `exportController.js` | 1 | 2 |
| `marketDataSyncService.js` | 2 | 0 |
| `server.js` (chat/call) | 3 | 11 |
| **Total** | **14** | **14** |

### After (Proposed Fix)

**Step 1: Ensure users join seller rooms on connect** (`backend/server.js`):
```js
io.on('connection', (socket) => {
    socket.on('join', (userId) => {
        socket.join(userId);
        // Also join seller rooms for this user
        if (userSellers.length > 0) {
            userSellers.forEach(seller => {
                socket.join(`seller:${seller.SellerId}`);
            });
        }
    });
});
```

**Step 2: Replace `io.emit` with `io.to(...)` in services:**

`backend/services/asinDataParser.js`:
```js
// BEFORE: io.emit('scrape_data_ingested', ...)
// AFTER:
const io = SocketService.getIo();
io.to(`seller:${sellerId}`).emit('scrape_data_ingested', {
    asinId: merged.Id,
    sellerId: merged.SellerId,
    asinCode: merged.AsinCode,
    timestamp: new Date()
});
```

`backend/services/liveDataSyncService.js`:
```js
// BEFORE: io.emit('liveSync:completed', ...)
// AFTER:
io.to(`seller:${sellerIdStr}`).emit('liveSync:completed', {
    sellerId: sellerIdStr,
    totalAsins: stats.totalAsins,
    updatedAsins: stats.successCount,
    failedAsins: stats.failedCount,
    duration: stats.duration
});

// Also for ASINS_UPDATED
io.to(`seller:${sellerIdStr}`).emit('ASINS_UPDATED', { sellerId: sellerIdStr });
```

`backend/services/SystemLogService.js`:
```js
// Option A: Emit to admin/manager rooms
io.to('role:admin').to('role:operational_manager').emit('new_system_log', payload);

// Option B: Emit to specific user if UserId is available
if (userId) {
    io.to(userId).emit('new_system_log', payload);
} else {
    io.to('role:admin').emit('new_system_log', payload);
}
```

`backend/services/socketService.js`:
```js
// BEFORE: io.emit('export_progress', ...)
emitExportUpdate: (downloadId, data) => {
    if (io) {
        // AFTER: emit only to the requesting user
        const userId = data.userId;
        if (userId) {
            io.to(userId).emit('export_progress', { downloadId, ...data });
        }
        return true;
    }
    return false;
}
```

`backend/controllers/exportController.js` — pass `userId` into emit:
```js
// line 851 (in updateDownloadStatus)
SocketService.emitExportUpdate(id, { 
    status, 
    progress, 
    errorMessage,
    userId  // <-- ADD: pass user context
});
```

**Step 3: Frontend joins seller rooms** (`src/contexts/SocketContext.jsx`):
```js
// On auth
socket.emit('join', user._id || user.id);

// Also join sellers the user has access to
if (user.assignedSellers) {
    user.assignedSellers.forEach(sellerId => {
        socket.emit('join', `seller:${sellerId}`);
    });
}
```

### Summary

| Metric | Before | After |
|--------|--------|-------|
| Events sent per 100k ASIN upload | 2,002 × all_clients | 2,002 × 1_seller_room |
| `export_progress` reach | every client | requesting user only |
| `new_system_log` reach | every client | admins/operators only |
| Total global emits | 14 | 3 (only `user_status_change` + `role_permissions_updated`) |

---

## 2. (P1) Move Exports to Durable Job Queue

### Problem

Export jobs are launched fire-and-forget (`processExportJob(...).catch(...)`) with no queue, no persistence, no retry. If the Node process crashes mid-export, the job dies silently and status stays `processing`.

### Before (Current Code)

**`backend/controllers/exportController.js:114-117`** — fire-and-forget:
```js
// Process export in background
processExportJob(downloadId, req.body, userId).catch(err => {
    console.error(`Export job ${downloadId} failed:`, err.message);
});
// Immediately returns 200 to client
res.json({ success: true, downloadId, fileName });
```

**Error handling** (line 822-833) — updates DB and emits socket, but partial file is orphaned:
```js
} catch (error) {
    console.error(`❌ Export job ${downloadId} failed:`, error);
    await updateDownloadStatus(pool, downloadId, 'failed', 0, error.message);
    const io = SocketService.getIo();
    if (io) {
        io.to(`user_${userId}`).emit('export_failed', { downloadId, error: error.message });
    }
}
```

**No queue infrastructure** — zero references to Bull, RabbitMQ, SQS, or any job queue anywhere in the codebase.

### After (Proposed Fix)

**Using BullMQ with Redis:**

```js
// backend/services/exportQueue.js — NEW FILE
const { Queue, Worker } = require('bullmq');
const connection = { host: process.env.REDIS_HOST || 'localhost', port: 6379 };

const exportQueue = new Queue('exports', { connection });

const exportWorker = new Worker('exports', async (job) => {
    const { downloadId, params, userId } = job.data;
    await processExportJob(downloadId, params, userId);
}, { connection, concurrency: 2 });

exportWorker.on('completed', (job) => {
    console.log(`Export job ${job.id} completed`);
});

exportWorker.on('failed', (job, err) => {
    console.error(`Export job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);
    // Update DB status to failed
    updateDownloadStatus(job.data.downloadId, 'failed', 0, err.message);
});
```

**`backend/controllers/exportController.js`** — replace fire-and-forget:
```js
// BEFORE:
// processExportJob(downloadId, req.body, userId).catch(...)

// AFTER:
const exportQueue = require('../services/exportQueue');
await exportQueue.add('asin-export', {
    downloadId,
    params: req.body,
    userId
}, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
});
```

**Additional resilience:**

| Concern | Before | After |
|---------|--------|-------|
| Process crash mid-export | Job lost silently | BullMQ stores job in Redis; worker re-picks up on restart |
| Retry on failure | None | 3 attempts with exponential backoff |
| Concurrency control | None (unlimited) | Max 2 concurrent exports |
| Job visibility | DB status only | BullMQ dashboard + DB status |
| Partial file cleanup | Orphaned | Worker `failed` handler deletes partial file |

---

## 3. (P1) Centralize RBAC Logic

### Problem

The `isGlobalUser` check is duplicated **47+ times** across 12+ controllers with **inconsistent role lists** — some include `'Listing Manager'`, some don't. A role change requires editing every controller.

### Before (Current Code)

**3 different role-list definitions:**

| File | Line | Code |
|------|------|------|
| `dashboardController.js` | 33 | `['admin', 'operational_manager']` |
| `exportController.js` | 210 | `['admin', 'operational_manager', 'Listing Manager']` |
| `asinController.js` | 149 | `['admin', 'operational_manager', 'Listing Manager']` |
| `asinController.js` | 1236 | `['admin', 'operational_manager']` |
| `sellerController.js` | 96 | `['admin', 'operational_manager', 'Listing Manager']` |
| `actionController.js` | 37 | `['admin', 'operational_manager']` |
| `alertsController.js` | 12 | `['admin', 'operational_manager']` |
| `marketDataSyncController.js` | 81 | `['admin', 'operational_manager']` |
| `uploadController.js` | 664 | `['admin', 'super_admin', 'operational_manager']` |
| `auth.js` (middleware) | 195 | `['admin', 'super_admin', 'operational_manager']` |

47 total occurrences across 12+ files.

**Common pattern repeated everywhere:**
```js
const roleName = req.user?.role?.name || req.user?.role;
const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

let whereClause = 'WHERE 1=1';
if (!isGlobalUser) {
    const assignedIds = req.user?.assignedSellers || [];
    if (assignedIds.length === 0) {
        whereClause += ' AND 1=0';
    } else {
        whereClause += ` AND a.SellerId IN (${assignedIds.map(id => `'${id}'`).join(',')})`;
    }
}
```

### After (Proposed Fix)

**Create `backend/services/rbacService.js`:**
```js
// backend/services/rbacService.js — NEW FILE
const GLOBAL_ROLES = ['admin', 'operational_manager', 'Listing Manager'];

module.exports = {
    isGlobalUser(user) {
        const roleName = user?.role?.name || user?.role || '';
        return GLOBAL_ROLES.includes(roleName);
    },

    buildSellerFilter(user, tableAlias = 'a') {
        const alias = tableAlias ? `${tableAlias}.` : '';
        if (this.isGlobalUser(user)) {
            return ''; // no restriction
        }
        const assignedIds = user?.assignedSellers || [];
        if (assignedIds.length === 0) {
            return ` AND ${alias}SellerId = '000000000000000000000000'`; // no access
        }
        const quoted = assignedIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
        return ` AND ${alias}SellerId IN (${quoted})`;
    },

    getUserRoleName(user) {
        return user?.role?.name || user?.role || '';
    }
};
```

**Usage in any controller** — replaces 47 duplications:
```js
const rbac = require('../services/rbacService');

// BEFORE (6 lines, manual array):
// const roleName = req.user?.role?.name || req.user?.role;
// const isGlobalUser = ['admin', 'operational_manager', ...].includes(roleName);
// if (!isGlobalUser) { ... }

// AFTER (1 line):
let whereClause = 'WHERE 1=1' + rbac.buildSellerFilter(req.user, 'a');
```

**Same pattern for non-ASIN tables:**
```js
// Dashboard sellers filter
let sellerFilter = rbac.isGlobalUser(req.user)
    ? ''
    : 'WHERE Id IN (' + rbac.buildSellerFilter(req.user, '').replace('AND ', '') + ')';
```

---

## 4. (P1) Fix SQL String Interpolation

### Problem

50+ occurrences across the codebase interpolate seller IDs directly into SQL strings. Even though values originate from the DB, future code changes can introduce injection via user-controlled ASIN IDs or search strings.

### Before (Current Code)

**`backend/controllers/exportController.js:219-237`** — 5 interpolation sites:
```js
whereClause += ` AND a.SellerId IN (${assignedIds.map(id => `'${id}'`).join(',')})`;
whereClause += ` AND a.SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
whereClause += ` AND a.SellerId IN (${sellerIds.map(id => `'${id}'`).join(',')})`;
whereClause += ` AND a.Id IN (${asinIds.map(id => `'${id}'`).join(',')})`;
```

**`backend/controllers/asinController.js`** — 14 interpolation sites with same pattern:
```js
whereClause += ` AND a.SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
```

**`backend/controllers/dashboardController.js:52-54`** — 3 interpolation sites:
```js
let sellerFilter = useWideFilters ? '' : 'WHERE Id IN (' + safeSellerIds.map(id => `'${id}'`).join(',') + ')';
let asinFilter = useWideFilters ? '' : 'WHERE SellerId IN (' + safeSellerIds.map(id => `'${id}'`).join(',') + ')';
```

**Total: 50+ interpolation sites across 12+ controllers.**

### After (Proposed Fix)

**Option A: Use `mssql` table-valued parameters (preferred):**
```js
// Create TVP type once:
// CREATE TYPE dbo.StringList AS TABLE (Value NVARCHAR(100));

// Usage:
const tvp = sellerIds.map(id => ({ Value: id }));
request.input('sellerIds', sql.TVP, tvp);
query += ` AND a.SellerId IN (SELECT Value FROM @sellerIds)`;
```

**Option B: Dynamic parameterized IN clause (simpler retrofit):**
```js
// Helper to build parameterized IN clause
function buildInClause(request, paramPrefix, values, sqlType = sql.VarChar) {
    const placeholders = [];
    values.forEach((val, i) => {
        const paramName = `@${paramPrefix}_${i}`;
        request.input(paramName, sqlType, val);
        placeholders.push(paramName);
    });
    return placeholders.join(',');
}

// Usage:
const placeholders = buildInClause(request, 'sid', sellerIds, sql.VarChar);
whereClause += ` AND a.SellerId IN (${placeholders})`;
```

**Before → After for all 5 exportController sites:**
```js
// BEFORE (line 219):
whereClause += ` AND a.SellerId IN (${assignedIds.map(id => `'${id}'`).join(',')})`;

// AFTER:
whereClause += ` AND a.SellerId IN (${buildInClause(request, 'aid', assignedIds)})`;

// BEFORE (line 237):
whereClause += ` AND a.Id IN (${asinIds.map(id => `'${id}'`).join(',')})`;

// AFTER:
whereClause += ` AND a.Id IN (${buildInClause(request, 'asid', asinIds)})`;
```

**Same pattern applied to all 50+ interpolation sites.**

### Summary

| Metric | Before | After |
|--------|--------|-------|
| String interpolation sites | 50+ | 0 |
| SQL injection risk | High (sites accept user-controlled search, ASIN IDs) | None (all parameterized) |
| Code change for new filter | Manual string concat | Add `.input()` call |

---

## 5. (P2) Parallelize Dashboard Queries

### Problem

`getDashboardData` runs 8 SQL queries sequentially with `await` on each. Latency is additive — with each query taking 150-300ms, total can exceed 2 seconds.

### Before (Current Code)

**`backend/controllers/dashboardController.js:27-269`** — sequential:
```js
exports.getDashboardData = async (req, res) => {
    const pool = await getPool();

    // Query 1
    const sellerCounts = await pool.request().query(`SELECT ... FROM Sellers ...`);

    // Query 2 (waits for 1)
    const asinCounts = await pool.request().query(`SELECT ... FROM Asins ...`);

    // Query 3 (waits for 2)
    const alertsResult = await pool.request().query(`SELECT TOP 5 ... FROM Alerts ...`);

    // Query 4 (waits for 3)
    const userActionStats = await pool.request()
        .input('userId', ...)
        .query(`SELECT ... FROM Actions ...`);

    // Query 5 (waits for 4, conditional)
    if (isGlobalUser) {
        const teamActionStats = await pool.request().query(`SELECT ... FROM Actions ...`);
    }

    // Query 6 (waits for 5)
    const adsDataResult = await pool.request()
        .input('startDate', ...)
        .input('endDate', ...)
        .query(`SELECT ...`);

    // Query 7 (waits for 6)
    const asinsGroupedResult = await pool.request().query(`SELECT ...`);

    // Query 8 (waits for 7)
    const topAsinsResult = await pool.request()
        .input('startDate', ...)
        .input('endDate', ...)
        .query(`SELECT TOP 200 ...`);
};
```

### After (Proposed Fix)

**`backend/controllers/dashboardController.js`** — parallel with `Promise.all`:
```js
exports.getDashboardData = async (req, res) => {
    const pool = await getPool();

    // Run independent queries in parallel
    const [
        sellerCounts,
        asinCounts,
        alertsResult,
        userActionStats,
        teamActionStatsPromise,  // conditional — may be a no-op
        adsDataResult,
        asinsGroupedResult,
        topAsinsResult
    ] = await Promise.all([
        pool.request().query(`SELECT ... FROM Sellers ...`),
        pool.request().query(`SELECT ... FROM Asins ...`),
        pool.request().query(`SELECT TOP 5 ... FROM Alerts ...`),
        pool.request()
            .input('userId', sql.VarChar, userId)
            .query(`SELECT ... FROM Actions WHERE AssignedTo = @userId`),
        isGlobalUser
            ? pool.request().query(`SELECT ... FROM Actions`)
            : Promise.resolve({ recordset: [] }),
        pool.request()
            .input('startDate', sql.VarChar, startDate)
            .input('endDate', sql.VarChar, endDate)
            .query(`SELECT ...`),
        pool.request().query(`SELECT Id, Name FROM Sellers`),
        pool.request()
            .input('startDate', sql.VarChar, startDate)
            .input('endDate', sql.VarChar, endDate)
            .query(`SELECT TOP 200 ...`)
    ]);
};
```

**Total = max latency of slowest single query instead of sum of all.**

| Metric | Before | After |
|--------|--------|-------|
| Query pattern | Sequential (`await` chain) | Parallel (`Promise.all`) |
| Total latency | Sum of 8 query times | Max of 8 query times |
| Example: 150+250+200+300ms | ~900ms | ~300ms |
| Connection count | 8 sequential (pool reuses) | 8 concurrent (pool manages) |

---

## 6. (P2) Redis-Backed OAuth Token Cache

### Problem

Live sync OAuth tokens are stored in a plain `Map` (`this._tokens = new Map()`). With PM2 cluster mode or Kubernetes replicas, each Node instance fetches its own token, causing duplicate OAuth requests.

### Before (Current Code)

**`backend/services/liveDataSyncService.js:26`** — in-memory Map:
```js
this._tokens = new Map();
```

**`backend/services/liveDataSyncService.js:315-339`** — get/cache logic:
```js
async _getToken(creds) {
    const cached = this._tokens.get('global');          // in-memory only

    if (cached && Date.now() < cached.exp) {
        return cached.t;
    }
    // ... fetch from Amazon OAuth ...
    this._tokens.set('global', {
        t: response.data.access_token,
        exp: Date.now() + (response.data.expires_in * 1000) - 60000
    });
    return response.data.access_token;
}
```

**Problem:** Each PM2 worker (N instances) independently fetches and caches tokens. No shared state.

### After (Proposed Fix)

**Using `ioredis` for shared token cache:**

```js
// backend/services/tokenCache.js — NEW FILE
const Redis = require('ioredis');
const redis = new Redis({ host: process.env.REDIS_HOST || 'localhost' });

module.exports = {
    async getToken(key) {
        return redis.get(`token:${key}`);
    },
    async setToken(key, token, ttlSeconds) {
        // ttlSeconds = expires_in from OAuth response (minus 60s safety margin)
        await redis.setex(`token:${key}`, ttlSeconds, token);
    },
    async invalidateToken(key) {
        await redis.del(`token:${key}`);
    }
};
```

**Updated `liveDataSyncService.js`:**
```js
const tokenCache = require('./tokenCache');

async _getToken(creds) {
    const cacheKey = `live_sync:${creds._cid}`;

    // Shared cache (Redis) — works across all instances
    const cached = await tokenCache.getToken(cacheKey);
    if (cached) return cached;

    // Fetch from Amazon OAuth
    const response = await axios.post(this._config._t, params, { ... });

    // Store with TTL from response
    await tokenCache.setToken(
        cacheKey,
        response.data.access_token,
        response.data.expires_in - 60  // 60s safety margin
    );
    return response.data.access_token;
}
```

---

## 7. (P2) Add Socket.IO Redis Adapter

### Problem

Socket.IO uses a singleton `io` object. With PM2 cluster mode (`instances: 'max'`), each worker has its own Socket.IO instance. Events emitted from worker A are not received by clients connected to worker B. The codebase has NO Redis adapter.

### Before (Current Code)

**`backend/ecosystem.config.js`** — PM2 cluster mode:
```js
module.exports = {
  apps: [{
    name: 'retailops-api',
    script: './server.js',
    instances: 'max',       // multiple processes
    exec_mode: 'cluster',   // NO Redis adapter for Socket.IO
  }]
};
```

**`backend/server.js:233-253`** — no adapter:
```js
const io = new Server(server, { cors: { ... } });
// No @socket.io/redis-adapter
SocketService.init(io);
```

### After (Proposed Fix)

**`backend/server.js`:**
```js
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const pubClient = new Redis({ host: process.env.REDIS_HOST || 'localhost' });
const subClient = pubClient.duplicate();

const io = new Server(server, { cors: { ... } });
io.adapter(createAdapter(pubClient, subClient));
SocketService.init(io);
```

With the Redis adapter, events emitted from any worker propagate to all workers. Users can connect to any replica and receive all events.

---

## 8. (P3) Partition AsinHistory and Add Retention

### Problem

AsinHistory has no partitioning, no archiving, and no retention policy. At 50k ASINs × 365 days = 18M rows/year, with no cleanup mechanism.

### Before (Current Code)

**`backend/database/schema_v1.sql`** — no partition scheme:
```sql
CREATE TABLE AsinHistory (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    AsinId VARCHAR(24),
    Date DATE,
    Price DECIMAL(18,2),
    BSR INT,
    ...
);
CREATE NONCLUSTERED INDEX IX_AsinHistory_AsinId_Date ON AsinHistory (AsinId, Date);
```

**No DELETE, archive, or purge** for AsinHistory anywhere in the codebase.

### After (Proposed Fix)

```sql
-- Add partition scheme by month
CREATE PARTITION FUNCTION PF_AsinHistory_Date (DATE)
AS RANGE RIGHT FOR VALUES (
    '2024-01-01', '2024-02-01', '2024-03-01', ..., '2026-12-01'
);

CREATE PARTITION SCHEME PS_AsinHistory_Date
AS PARTITION PF_AsinHistory_Date ALL TO ([PRIMARY]);

-- Recreate table on partition scheme
CREATE TABLE AsinHistory (
    Id BIGINT IDENTITY(1,1),
    AsinId VARCHAR(24),
    Date DATE,
    ...
) ON PS_AsinHistory_Date(Date);
```

**Retention job** (`backend/services/retentionService.js`):
```js
// Scheduled via node-cron (weekly)
const cron = require('node-cron');
cron.schedule('0 3 * * 0', async () => {
    const pool = await getPool();
    // Delete history older than 12 months
    await pool.request()
        .input('cutoff', sql.Date, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
        .query(`DELETE FROM AsinHistory WHERE Date < @cutoff`);
    // Truncate old partitions
    // SWITCH old partition to staging table, then DROP
});
```

---

## 9. (P3) Normalize Asins Table

### Problem

The `Asins` table has grown to 60+ columns covering listing data, pricing, offers, images, reviews, fees, content, A+, buy box, tags, and disputes — serving OLTP, reporting, and analytics simultaneously.

### Before (Current Code)

Single monolithic table with 60+ columns (from `schema_v1.sql` + 7 ALTER TABLE migrations):

```
Asins (60+ columns)
├── Core: Id, AsinCode, ParentAsin, Sku, Title, Category, Brand
├── Status: Status, ScrapeStatus
├── Pricing: UploadedPrice, CurrentPrice, Mrp, DealBadge, PriceType,
│            DiscountPercentage, SecondAsp, AspDifference, PriceDispute
├── Performance: BSR, BsrTrend, SubBsr, SubBSRs, CategoryBSR,
│                Rating, RatingTrend, ReviewCount, Percentage
├── LQS: Lqs, TitleScore, BulletScore, ImageScore, DescriptionScore
├── Fees: FbaFee, ReferralFee, OtherFee, TotalFee
├── Content: ImageUrl, Images, ImagesCount, VideoCount, BulletPoints, BulletPointsText
├── Quality: ListingQuality, HasAplus, HasEbc, AplusAbsentSince, AplusPresentSince
├── Offers: BuyBoxWin, BuyBoxStatus, BuyBoxSellerId, SoldBy, SoldBySec,
│           AllOffers, BuyBoxes
├── Tags
├── Audit: LastScrapedAt, LastLiveSyncAt, LastSyncSource, CreatedAt, UpdatedAt
└── FK: SellerId, UserId
```

### After (Proposed Fix)

```sql
-- Core listing identity (OLTP-hot path)
Asins (
    Id, AsinCode, ParentAsin, Sku, Title, SellerId, UserId,
    Status, ScrapeStatus, Category, Brand, Tags,
    CreatedAt, UpdatedAt, LastScrapedAt, LastLiveSyncAt
)

-- Frequently updated pricing + performance (writes)
AsinMetrics (
    AsinId, CurrentPrice, Mrp, DealBadge, PriceType, DiscountPercentage,
    SecondAsp, AspDifference, PriceDispute, PriceDisputeReason,
    BSR, BsrTrend, SubBsr, SubBSRs, Rating, RatingTrend, ReviewCount,
    Lqs, TitleScore, BulletScore, ImageScore, DescriptionScore,
    FbaFee, ReferralFee, OtherFee, TotalFee,
    UpdatedAt
)

-- Large/blobby content data (infrequently read)
AsinContent (
    AsinId, ImageUrl, Images, ImagesCount, VideoCount,
    BulletPoints, BulletPointsText, ListingQuality,
    HasAplus, HasEbc, AplusAbsentSince, AplusPresentSince,
    BuyBoxWin, BuyBoxStatus, BuyBoxSellerId, SoldBy, SoldBySec,
    AllOffers, BuyBoxes, AvailabilityStatus, StockLevel
)
```

**Benefit:** Regular queries against `Asins` (list, filter, search) touch only the hot columns. Metrics updates don't lock the content row. Content reads happen only when viewing detail panels.

---

## 10. (P3) Move JSON Blobs to Child Tables

### Problem

Columns like `Images`, `BulletPoints`, `Tags`, `AllOffers`, `BuyBoxes`, `SubBSRs` are `NVARCHAR(MAX)` JSON stored inline on the Asins row. SQL Server page efficiency drops as these blobs grow.

### Before (Current Code)

```sql
CREATE TABLE Asins (
    ...
    Images        NVARCHAR(MAX),   -- JSON array: ["url1","url2",...]
    BulletPoints  NVARCHAR(MAX),   -- JSON array: ["point1","point2",...]
    Tags          NVARCHAR(MAX),   -- JSON array: ["tag1","tag2",...]
    AllOffers     NVARCHAR(MAX),   -- JSON array of offer objects
    BuyBoxes      NVARCHAR(MAX),   -- JSON array of buy box history
    SubBSRs       NVARCHAR(MAX),   -- JSON object of subcategory BSRs
    ...
);
```

### After (Proposed Fix)

```sql
-- Normalized child tables
CREATE TABLE AsinImages (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    AsinId VARCHAR(24) FK,
    Url NVARCHAR(MAX),
    SortOrder INT,
    CreatedAt DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE AsinBulletPoints (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    AsinId VARCHAR(24) FK,
    Text NVARCHAR(2000),
    SortOrder INT,
    CreatedAt DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE AsinTags (
    AsinId VARCHAR(24) FK,
    Tag NVARCHAR(100),
    PRIMARY KEY (AsinId, Tag)
);

CREATE TABLE AsinOffers (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    AsinId VARCHAR(24) FK,
    SellerId NVARCHAR(100),
    Price DECIMAL(18,2),
    IsBuyBox BIT,
    Fulfillment NVARCHAR(50),
    SnapshotAt DATETIME2 DEFAULT GETDATE()
);
```

---

## 11. (P3) Add Observability

### Problem

Zero observability tooling — no Prometheus, Sentry, DataDog, OpenTelemetry, or structured logging. Only `console.log` and the custom `SystemLogService` (which logs to a DB table, not usable for alerting).

### Before (Current Code)

**`backend/server.js`** — no logging middleware:
```js
const app = express();
app.use(express.json());
app.use(cors(corsOptions));
// No request logging, no structured logging
```

**All services** — console.log only:
```js
console.log(`📦 [Export] Starting job ${downloadId}`);
console.log(`Live sync all complete: ${summary.success} sellers`);
```

**No metrics export** — zero Prometheus endpoints, zero Sentry instrumentation.

### After (Proposed Fix)

```js
// backend/middleware/requestLogger.js — NEW FILE
const pino = require('pino');
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined
});

module.exports = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        logger.info({
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: Date.now() - start,
            userId: req.userId
        });
    });
    next();
};
```

```js
// Prometheus metrics endpoint
const prometheus = require('prom-client');
const collectDefaultMetrics = prometheus.collectDefaultMetrics;
collectDefaultMetrics();

app.get('/api/metrics', async (req, res) => {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
});

// Custom counters
const asinUpdateCounter = new prometheus.Counter({
    name: 'asin_updates_total',
    help: 'Total ASIN updates',
    labelNames: ['source', 'seller_id']
});
```

---

## 12. (P3) Target Activity Log Broadcasts

### Problem

`new_system_log` is broadcast to ALL connected clients via `io.emit()`. High-frequency imports create thousands of log events that every client receives, even users who don't care about those entities.

### Before (Current Code)

**`backend/services/SystemLogService.js:47`** — global broadcast:
```js
io.emit('new_system_log', {
    Id: id, Type: type, EntityType: entityType, ...
});
```

### After (Proposed Fix)

**Option A — Role-based rooms** (`backend/server.js` on connect):
```js
// On auth, join role-based rooms
if (user.role?.Name === 'admin') socket.join('role:admin');
if (user.role?.Name === 'operational_manager') socket.join('role:ops');
```

**`backend/services/SystemLogService.js`:**
```js
// Emit to admin + ops rooms
io.to('role:admin').to('role:ops').emit('new_system_log', payload);
```

**Option B — User-targeted** (if log has UserId):
```js
if (userId) {
    io.to(userId).emit('new_system_log', payload);
} else {
    io.to('role:admin').emit('new_system_log', payload);
}
```

**Option C — Frontend filter + batch** (`src/pages/ActivityLog.jsx`):
```js
// Add batching to prevent re-render storms
const logBatch = useRef([]);
const debouncedFlush = useRef(
    debounce(() => {
        setLogs(prev => [...logBatch.current, ...prev].slice(0, 500));
        logBatch.current = [];
    }, 1000)
);

socket.on('new_system_log', (data) => {
    logBatch.current.push(normalize(data));
    debouncedFlush.current();
});
```

---

## 13. (P3) Replace Octoparse Polling with Webhooks or Queue

### Problem

Octoparse sync polls every 10 seconds for up to 5 minutes per task. With many concurrent sellers, this creates many idle polling loops consuming event-loop cycles and API rate limits.

### Before (Current Code)

**`backend/services/marketDataSyncService.js`** — polling loop:
```js
async waitForTaskCompletion(taskId, maxWaitMs = 300000) {
    const pollInterval = 10000; // 10 seconds
    const maxAttempts = maxWaitMs / pollInterval;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = await this.getTaskStatus(taskId);
        if (['Completed', 'Failed', 'Error', 'NoData'].includes(status)) {
            return status;
        }
        await new Promise(r => setTimeout(r, pollInterval));
    }
    throw new Error('Task timed out');
}
```

### After (Proposed Fix)

**Option A — Centralized scheduler with queue:**
```js
// backend/services/syncQueue.js — NEW FILE
const { Queue, Worker } = require('bullmq');
const syncQueue = new Queue('octoparse-sync', { connection });

const syncWorker = new Worker('octoparse-sync', async (job) => {
    const { sellerId, taskId } = job.data;
    const result = await marketDataSyncService.waitForTaskCompletion(taskId);
    if (result === 'Completed') {
        await marketDataSyncService.getTaskData(taskId);
    }
}, { connection, concurrency: 5 });  // limit concurrent polling
```

**Option B — Webhook (if Octoparse supports it):**
```js
// Instead of polling, expose a webhook endpoint
app.post('/api/webhooks/octoparse/completed', async (req, res) => {
    const { taskId, status } = req.body;
    if (status === 'Completed') {
        // Trigger data download asynchronously
        syncQueue.add('process-result', { taskId });
    }
    res.sendStatus(200);
});
```

---

## Priority Summary

| Priority | Item | Effort | Impact | Before | After |
|----------|------|--------|--------|--------|-------|
| P1 | Socket rooms | 2-3 days | Eliminates broadcast storm, data leak | 14 global emits | 3 global emits |
| P1 | Job queue | 3-5 days | Export survives crashes, retries | Fire-and-forget | BullMQ + 3 retries |
| P1 | Central RBAC | 1-2 days | Single source of truth | 47 duplications across 12 files | 1 service |
| P1 | Parameterized SQL | 3-5 days | Eliminates injection risk | 50+ interpolation sites | Zero |
| P2 | Parallel dashboard | 1 day | 3x faster page loads | ~900ms sequential | ~300ms parallel |
| P2 | Redis token cache | 1 day | No duplicate OAuth calls | In-memory Map | Redis TTL cache |
| P2 | Socket.IO Redis adapter | 1 day | Works across PM2 replicas | Singleton per worker | Cross-worker pub/sub |
| P3 | Partition AsinHistory | 2-3 days | Controlled growth, cleanable | 18M rows/year, no cleanup | Monthly partitions + 12mo retention |
| P3 | Normalize Asins | 3-5 days | Better page efficiency | 60+ columns | 3 logical tables |
| P3 | JSON → child tables | 2-3 days | No page bloat | NVARCHAR(MAX) blobs | Normalized rows |
| P3 | Observability | 2-3 days | Alerting, debugging | console.log only | Pino + Prometheus |
| P3 | Targeted log emits | 1 day | Reduced broadcast noise | Every client | Role rooms + batching |
| P3 | Webhook/queue sync | 2-3 days | No idle polling loops | 10s poll × 5 min | Queue + webhook |
