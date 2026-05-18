const http = require('http');

const API_URL = 'http://localhost:3001/api'; // Assuming backend runs on 5000 based on previous logs or standard env

// Helper for HTTP requests
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
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

const runTests = async () => {
    console.log('Starting API Verification...');

    // 0. Seed Data
    console.log('0. Seeding Global Data...');
    try {
        await request('/seed/seed-all', 'POST');
        console.log('✓ Seeding Initiated');
    } catch (e) {
        console.warn('⚠ Seeding might have failed or already done:', e.message);
    }

    // 1. Direct JWT Generation
    console.log('\n1. Generating JWT token directly from database user...');
    const { getPool } = require('../database/db');
    const sql = require('mssql');
    const jwt = require('jsonwebtoken');
    const config = require('../config/env');
    const pool = await getPool();
    const userRes = await pool.request()
        .input('email', sql.VarChar, 'admin@gms.com')
        .query('SELECT Id FROM Users WHERE Email = @email');
    
    if (userRes.recordset.length === 0) {
        console.error('Admin user not found in database to authenticate with');
        process.exit(1);
    }
    const userId = userRes.recordset[0].Id;
    const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '24h' });
    console.log('✓ Token generated successfully for userId:', userId);

    // 1.5 Create Seller
    console.log('\n1.5 Creating Seller...');
    const sellerIdRaw = 'SELLER' + Math.floor(Math.random() * 1000000);
    res = await request('/sellers', 'POST', {
        name: 'Test Seller Inc ' + Date.now(),
        marketplace: 'amazon.in',
        sellerId: sellerIdRaw,
        plan: 'Pro'
    }, token);

    if (res.status !== 201) {
        console.error('Failed to create Seller:', res.data);
        process.exit(1);
    }
    console.log('Seller creation raw response:', res.data);
    const sellerId = res.data.data?._id || res.data.data?.id || res.data._id || res.data.id;
    console.log(`✓ Seller Created: ${res.data.data?.name || res.data.name} (${sellerId})`);

    // 2. Create ASIN
    console.log('\n2. Creating ASIN...');
    const asinCode = 'B0TEST' + Math.floor(Math.random() * 1000);
    res = await request('/asins', 'POST', {
        asinCode: asinCode, // asinRoutes uses createAsin which uses req.body directly. Asin model uses asinCode.
        // asin: asinCode, // Old payload used 'asin', model uses 'asinCode'
        title: 'Test Product for Verification',
        price: 1000,
        currentPrice: 1000,
        dimensions: "10x10x10", // String format
        category: 'Electronics',
        seller: sellerId
    }, token);

    const asinId = res.data._id || res.data.id;
    if (!asinId) {
        console.error('Failed to create ASIN:', res.data);
        process.exit(1);
    }
    console.log(`✓ ASIN Created: ${asinCode} (${asinId})`);

    // 3. Create Action
    console.log('\n3. Creating Action...');
    res = await request('/actions', 'POST', {
        title: 'Verify Fees',
        type: 'OPTIMIZATION',
        priority: 'HIGH',
        asin: asinId,
        description: 'Check if fees are accurate'
    }, token);

    if (res.status !== 201 && res.status !== 200) {
        console.error('Failed to create Action:', res.data);
    } else {
        console.log('✓ Action Created');
    }

    // 4. Calculate Profits
    console.log('\n4. Calculating Profits...');
    res = await request('/revenue/calculate', 'POST', { asinIds: [asinId] }, token);
    if (res.status === 200 || res.status === 201) {
        console.log('✓ Calculation Initiated');
    } else {
        console.error('Failed calculation:', res.data);
    }

    // 5. Verify ASIN Data Updated
    console.log('\n5. Verifying ASIN Data...');
    // Wait a bit for async calculation (if any)
    await new Promise(r => setTimeout(r, 2000));

    res = await request(`/asins/${asinId}`, 'GET', null, token);
    const asinData = res.data;

    if (asinData.feePreview) {
        console.log('✓ Fee Preview present:', asinData.feePreview);
    } else {
        console.warn('⚠ Fee Preview missing (Backend calculation might be async or failed silently)');
    }

    console.log('\nVerification Complete!');
};

runTests().catch(console.error);
