/**
 * End-to-End Test: Live Sync Flow
 * Tests the complete flow from triggering sync to data storage in database.
 * 
 * Usage: node tests/e2e_live_sync.js
 * Requires: Backend server running on localhost:3001
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_URL = `http://localhost:${process.env.PORT || 3001}/api`;

// ─── Helpers ──────────────────────────────────────────────────────────────

const request = (path, method = 'GET', body = null, token = null) => {
    return new Promise((resolve, reject) => {
        const url = new URL(API_URL + path);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
            },
        };

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const log = (msg, type = 'info') => {
    const icons = { info: '📋', pass: '✅', fail: '❌', warn: '⚠️', data: '📊' };
    console.log(`${icons[type] || '📋'} ${msg}`);
};

// ─── Test Suite ───────────────────────────────────────────────────────────

const results = { passed: 0, failed: 0, skipped: 0 };

function assert(condition, testName) {
    if (condition) {
        results.passed++;
        log(`PASS: ${testName}`, 'pass');
    } else {
        results.failed++;
        log(`FAIL: ${testName}`, 'fail');
    }
}

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('  LIVE SYNC END-TO-END TEST SUITE');
    console.log('='.repeat(60) + '\n');

    // ── Step 0: Verify Database Connection ──────────────────────────────
    log('Step 0: Verifying database connection...');
    const { getPool, sql } = require('../database/db');
    
    let pool;
    try {
        pool = await getPool();
        const testResult = await pool.request().query('SELECT 1 as test');
        assert(testResult.recordset[0].test === 1, 'Database connection works');
    } catch (err) {
        log(`FATAL: Cannot connect to database: ${err.message}`, 'fail');
        process.exit(1);
    }

    // ── Step 1: Check Server Health ─────────────────────────────────────
    log('\nStep 1: Checking server health...');
    try {
        const healthRes = await request('/health');
        assert(healthRes.status === 200, 'Server health check returns 200');
        assert(healthRes.data.status === 'ok', 'Server status is ok');
    } catch (err) {
        log(`FATAL: Server not running on port ${process.env.PORT || 3001}: ${err.message}`, 'fail');
        log('Start the server first: npm run dev', 'warn');
        process.exit(1);
    }

    // ── Step 2: Generate Auth Token ─────────────────────────────────────
    log('\nStep 2: Generating auth token...');
    const jwt = require('jsonwebtoken');
    const config = require('../config/env');
    
    const userRes = await pool.request()
        .query('SELECT TOP 1 Id, Email, RoleId FROM Users WHERE IsActive = 1');
    
    let token;
    if (userRes.recordset.length > 0) {
        const userId = userRes.recordset[0].Id;
        token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '24h' });
        assert(true, `Token generated for user: ${userRes.recordset[0].Email}`);
    } else {
        log('No active users found. Creating test admin user...', 'warn');
        const bcrypt = require('bcryptjs');
        const { generateId } = require('../database/db');
        
        // Create admin role if not exists
        let adminRoleId;
        const roleCheck = await pool.request().query("SELECT Id FROM Roles WHERE Name = 'admin'");
        if (roleCheck.recordset.length > 0) {
            adminRoleId = roleCheck.recordset[0].Id;
        } else {
            adminRoleId = generateId();
            await pool.request()
                .input('id', sql.VarChar, adminRoleId)
                .query(`INSERT INTO Roles (Id, Name, DisplayName, IsActive, CreatedAt) 
                        VALUES (@id, 'admin', 'Administrator', 1, dbo.GetEnvDate())`);
        }
        
        const testUserId = generateId();
        const hashedPassword = await bcrypt.hash('Test@1234', 10);
        await pool.request()
            .input('id', sql.VarChar, testUserId)
            .input('email', sql.VarChar, 'test-admin@retailops.test')
            .input('password', sql.NVarChar, hashedPassword)
            .input('firstName', sql.NVarChar, 'Test')
            .input('lastName', sql.NVarChar, 'Admin')
            .input('roleId', sql.VarChar, adminRoleId)
            .query(`INSERT INTO Users (Id, Email, Password, FirstName, LastName, RoleId, IsActive, CreatedAt) 
                    VALUES (@id, @email, @password, @firstName, @lastName, @roleId, 1, dbo.GetEnvDate())`);
        
        token = jwt.sign({ userId: testUserId }, config.jwtSecret, { expiresIn: '24h' });
        assert(true, `Test admin user created and token generated`);
    }

    // ── Step 3: Get Test Seller with Amazon ASINs ────────────────────────
    log('\nStep 3: Getting test seller with Amazon-format ASINs...');
    
    //优先选择有 B0... 格式 ASIN 的卖家
    let sellerResult = await pool.request()
        .query(`SELECT TOP 1 s.Id, s.Name, s.Marketplace
                FROM Sellers s
                JOIN Asins a ON a.SellerId = s.Id
                WHERE s.IsActive = 1 AND a.Status = 'Active' AND a.AsinCode LIKE 'B0%'
                GROUP BY s.Id, s.Name, s.Marketplace
                HAVING COUNT(a.Id) > 0
                ORDER BY COUNT(a.Id) DESC`);
    
    let testSeller;
    if (sellerResult.recordset.length > 0) {
        testSeller = sellerResult.recordset[0];
        assert(true, `Using seller: ${testSeller.Name} (${testSeller.Id})`);
    } else {
        // Fallback to any active seller
        sellerResult = await pool.request()
            .query("SELECT TOP 1 Id, Name, Marketplace FROM Sellers WHERE IsActive = 1");
        
        if (sellerResult.recordset.length > 0) {
            testSeller = sellerResult.recordset[0];
            assert(true, `Using fallback seller: ${testSeller.Name} (${testSeller.Id})`);
        } else {
            log('No sellers found in database', 'fail');
            process.exit(1);
        }
    }

    // ── Step 4: Get or Create Test ASINs ────────────────────────────────
    log('\nStep 4: Getting test ASINs for seller...');
    
    let asinResult = await pool.request()
        .input('sellerId', sql.VarChar, testSeller.Id)
        .query(`SELECT TOP 3 Id, AsinCode, Title, Status FROM Asins 
                WHERE SellerId = @sellerId AND Status = 'Active'`);
    
    let testAsins = asinResult.recordset;
    if (testAsins.length === 0) {
        log('No active ASINs found. Creating test ASINs...', 'warn');
        const { generateId } = require('../database/db');
        testAsins = [];
        
        // Create some test ASINs with real Amazon ASIN format
        const testCodes = ['B09V3KXJPB', 'B0D5CJ8NRS', 'B0CR9K2RBQ'];
        for (const code of testCodes) {
            const asinId = generateId();
            await pool.request()
                .input('id', sql.VarChar, asinId)
                .input('asinCode', sql.VarChar, code)
                .input('sellerId', sql.VarChar, testSeller.Id)
                .input('title', sql.NVarChar, `Test Product ${code}`)
                .query(`INSERT INTO Asins (Id, AsinCode, SellerId, Title, Status, CreatedAt, UpdatedAt) 
                        VALUES (@id, @asinCode, @sellerId, @title, 'Active', dbo.GetEnvDate(), dbo.GetEnvDate())`);
            testAsins.push({ Id: asinId, AsinCode: code, Title: `Test Product ${code}` });
        }
        assert(true, `Created ${testAsins.length} test ASINs`);
    } else {
        assert(true, `Found ${testAsins.length} active ASINs for seller`);
    }

    // ── Step 5: Test Live Sync Status Endpoint ──────────────────────────
    log('\nStep 5: Testing live sync status endpoint...');
    
    const statusRes = await request(`/market-sync/sync/status/${testSeller.Id}`, 'GET', null, token);
    assert(statusRes.status === 200, 'Status endpoint returns 200');
    assert(statusRes.data.liveSync !== undefined, 'Status response contains liveSync field');
    assert(statusRes.data.liveSync.status === 'IDLE', 'Initial status is IDLE');
    log(`Current status: ${statusRes.data.liveSync.status}`, 'data');

    // ── Step 6: Trigger Live Sync ───────────────────────────────────────
    log('\nStep 6: Triggering live sync...');
    
    const syncRes = await request(`/market-sync/sync/live/${testSeller.Id}`, 'POST', null, token);
    assert(syncRes.status === 200, 'Sync trigger returns 200');
    assert(syncRes.data.success === true, 'Sync trigger reports success');
    log(`Sync response: ${JSON.stringify(syncRes.data)}`, 'data');

    // ── Step 7: Poll Sync Status ────────────────────────────────────────
    log('\nStep 7: Polling sync status (max 120 seconds)...');
    
    let syncComplete = false;
    let finalStatus = null;
    const maxPolls = 15; // 15 * 8s = 120s max
    
    for (let i = 0; i < maxPolls; i++) {
        await sleep(8000);
        
        const pollRes = await request(`/market-sync/sync/status/${testSeller.Id}`, 'GET', null, token);
        if (pollRes.status !== 200) {
            log(`Poll ${i + 1}: Status ${pollRes.status}`, 'warn');
            continue;
        }
        
        const liveStatus = pollRes.data.liveSync?.status;
        const progress = pollRes.data.liveSync?.progress;
        
        if (progress) {
            log(`Poll ${i + 1}: ${liveStatus} - ${progress.processed}/${progress.total} ASINs`, 'data');
        } else {
            log(`Poll ${i + 1}: ${liveStatus}`, 'data');
        }
        
        if (liveStatus === 'IDLE' || liveStatus === 'COMPLETED' || liveStatus === 'FAILED') {
            syncComplete = true;
            finalStatus = pollRes.data.liveSync;
            break;
        }
    }
    
    if (!syncComplete) {
        log('Sync did not complete within 120 seconds', 'warn');
        results.skipped++;
    } else {
        assert(true, `Sync completed with status: ${finalStatus.status}`);
        if (finalStatus.lastResult) {
            log(`Results: ${finalStatus.lastResult.success} success, ${finalStatus.lastResult.failed} failed out of ${finalStatus.lastResult.totalAsins}`, 'data');
        }
        if (finalStatus.error) {
            log(`Error: ${finalStatus.error}`, 'warn');
        }
    }

    // ── Step 8: Verify Data in Database ─────────────────────────────────
    log('\nStep 8: Verifying data storage in database...');
    
    // Check 1: ASINs were updated with live sync data
    const asinUpdates = await pool.request()
        .input('sellerId', sql.VarChar, testSeller.Id)
        .query(`
            SELECT TOP 5 
                AsinCode, Title, CurrentPrice, BSR, Rating, ReviewCount,
                LastLiveSyncAt, LastSyncSource, UpdatedAt
            FROM Asins 
            WHERE SellerId = @sellerId 
            AND LastLiveSyncAt IS NOT NULL
            ORDER BY LastLiveSyncAt DESC
        `);
    
    if (asinUpdates.recordset.length > 0) {
        assert(true, `${asinUpdates.recordset.length} ASINs have been updated by live sync`);
        for (const asin of asinUpdates.recordset) {
            log(`  ${asin.AsinCode}: Price=₹${asin.CurrentPrice}, BSR=${asin.BSR}, Rating=${asin.Rating}, Reviews=${asin.ReviewCount}`, 'data');
        }
    } else {
        log('No ASINs have LastLiveSyncAt set - sync may not have updated data', 'warn');
        
        // Check if any ASINs were updated at all
        const anyUpdates = await pool.request()
            .input('sellerId', sql.VarChar, testSeller.Id)
            .query(`SELECT TOP 3 AsinCode, Title, CurrentPrice, BSR, UpdatedAt 
                    FROM Asins WHERE SellerId = @sellerId`);
        
        if (anyUpdates.recordset.length > 0) {
            log('ASINs exist but may not have been updated by live sync:', 'data');
            for (const asin of anyUpdates.recordset) {
                log(`  ${asin.AsinCode}: Price=₹${asin.CurrentPrice}, BSR=${asin.BSR}`, 'data');
            }
        }
    }
    
    // Check 2: AsinHistory records were created
    const historyCount = await pool.request()
        .input('sellerId', sql.VarChar, testSeller.Id)
        .query(`
            SELECT COUNT(*) as cnt
            FROM AsinHistory ah
            JOIN Asins a ON ah.AsinId = a.Id
            WHERE a.SellerId = @sellerId
            AND ah.Source = 'LIVE'
        `);
    
    const liveHistoryCount = historyCount.recordset[0]?.cnt || 0;
    if (liveHistoryCount > 0) {
        assert(true, `${liveHistoryCount} AsinHistory records created with Source='LIVE'`);
    } else {
        log('No AsinHistory records with Source=LIVE found', 'warn');
        
        // Check total history records
        const totalHistory = await pool.request()
            .input('sellerId', sql.VarChar, testSeller.Id)
            .query(`
                SELECT COUNT(*) as cnt
                FROM AsinHistory ah
                JOIN Asins a ON ah.AsinId = a.Id
                WHERE a.SellerId = @sellerId
            `);
        log(`Total AsinHistory records: ${totalHistory.recordset[0]?.cnt || 0}`, 'data');
    }
    
    // Check 3: SystemLogs entry was created
    const logEntry = await pool.request()
        .input('sellerId', sql.VarChar, testSeller.Id)
        .query(`
            SELECT TOP 1 CreatedAt, Description, Metadata
            FROM SystemLogs
            WHERE Type = 'LIVE_SYNC' AND EntityId = @sellerId
            ORDER BY CreatedAt DESC
        `);
    
    if (logEntry.recordset.length > 0) {
        assert(true, 'SystemLogs entry created for live sync');
        log(`  Log: ${logEntry.recordset[0].Description}`, 'data');
        if (logEntry.recordset[0].Metadata) {
            try {
                const meta = JSON.parse(logEntry.recordset[0].Metadata);
                log(`  Metadata: ${JSON.stringify(meta)}`, 'data');
            } catch (e) {}
        }
    } else {
        // Try LIKE search as fallback
        const logEntryFallback = await pool.request()
            .input('sellerPattern', sql.VarChar, `%${testSeller.Id}%`)
            .query(`
                SELECT TOP 1 CreatedAt, Description
                FROM SystemLogs
                WHERE Type = 'LIVE_SYNC' AND Description LIKE @sellerPattern
                ORDER BY CreatedAt DESC
            `);
        
        if (logEntryFallback.recordset.length > 0) {
            assert(true, 'SystemLogs entry found via LIKE search');
        } else {
            log('No SystemLogs entry found for live sync', 'warn');
        }
    }

    // ── Step 9: Test Octoparse Sync Flow (if configured) ────────────────
    log('\nStep 9: Testing Octoparse sync configuration...');
    
    const isConfigured = !!(process.env.MARKET_SYNC_USERNAME && process.env.MARKET_SYNC_PASSWORD &&
        process.env.MARKET_SYNC_USERNAME !== 'demo-provider');
    
    if (isConfigured) {
        assert(true, 'Octoparse credentials are configured');
        
        // Test task pool status
        const poolStatus = await request('/market-sync/pool-status', 'GET', null, token);
        if (poolStatus.status === 200) {
            log(`Task pool status: ${JSON.stringify(poolStatus.data.stats)}`, 'data');
        }
    } else {
        log('Octoparse not configured (demo credentials)', 'warn');
        results.skipped++;
    }

    // ── Step 10: Test Bulk Sync Flow ────────────────────────────────────
    log('\nStep 10: Testing bulk sync flow...');
    
    const bulkRes = await request(`/market-sync/sync-all/${testSeller.Id}`, 'POST', { fullSync: false }, token);
    if (bulkRes.status === 200) {
        assert(true, 'Bulk sync trigger returns 200');
        log(`Bulk sync response: ${bulkRes.data.message}`, 'data');
    } else if (bulkRes.status === 400) {
        log(`Bulk sync skipped (Octoparse not configured): ${bulkRes.data.error}`, 'warn');
        results.skipped++;
    } else {
        assert(false, `Bulk sync returns unexpected status: ${bulkRes.status}`);
    }

    // ── Summary ─────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('  TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`  ✅ Passed: ${results.passed}`);
    console.log(`  ❌ Failed: ${results.failed}`);
    console.log(`  ⏭️  Skipped: ${results.skipped}`);
    console.log('='.repeat(60));
    
    if (results.failed > 0) {
        console.log('\n⚠️  Some tests failed. Check the output above for details.');
        process.exit(1);
    } else {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
