require('dotenv').config();
const jwt = require('jsonwebtoken');
const config = require('../config/env');

async function testLocalEndpoints() {
    console.log('🚀 Authenticating and testing local endpoints...');
    
    // 1. Generate JWT token for admin
    const token = jwt.sign(
        { userId: '53948eb7838845f59107ee67', email: 'admin@gms.com' },
        config.jwtSecret,
        { expiresIn: '1h' }
    );
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const actionId = '3ded7bada5b24e01ab05fa0d';

    try {
        // Test 1: GET Instructions
        console.log(`\nCalling GET /api/actions/${actionId}/instructions ...`);
        const res1 = await fetch(`http://localhost:3001/api/actions/${actionId}/instructions`, { headers });
        console.log('GET Instructions status:', res1.status);
        const data1 = await res1.json();
        console.log('GET Instructions response:', JSON.stringify(data1, null, 2));

        // Test 2: POST Start Action
        console.log(`\nCalling POST /api/actions/${actionId}/start ...`);
        const res2 = await fetch(`http://localhost:3001/api/actions/${actionId}/start`, {
            method: 'POST',
            headers
        });
        console.log('POST Start status:', res2.status);
        const data2 = await res2.json();
        console.log('POST Start response:', JSON.stringify(data2, null, 2));

        // Test 3: GET Download File
        const dlId = 'b2be96a38bfb4d2a95742609';
        console.log(`\nCalling GET /api/export/download/${dlId} ...`);
        const res3 = await fetch(`http://localhost:3001/api/export/download/${dlId}`, { headers });
        console.log('GET Download status:', res3.status);
        const text3 = await res3.text();
        console.log('GET Download response (first 200 chars):', text3.substring(0, 200));

    } catch (e) {
        console.error('Error during local HTTP test:', e.message);
    }
}

testLocalEndpoints();
