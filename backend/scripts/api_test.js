const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTkwNDhjYTRmY2IyZDRmZmIzMDkxY2QiLCJpYXQiOjE3NzcwOTU4MTMsImV4cCI6MTc3NzE4MjIxM30.KTIcKjS5f5ejlMeblBojkZ2Lp0B9CkBvCYvo6YFmO5w';

const client = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    }
});

async function runTests() {
    const tests = [
        { name: 'GET Health', method: 'get', url: '/health' },
        { name: 'GET Sellers', method: 'get', url: '/sellers' },
        { name: 'GET ASINs', method: 'get', url: '/asins' },
        { name: 'GET Notifications', method: 'get', url: '/notifications' },
        { name: 'GET Fee Category Maps', method: 'get', url: '/revenue/mappings' },
        { name: 'GET Referral Fees', method: 'get', url: '/revenue/fees/referral' },
        { name: 'POST New Seller', method: 'post', url: '/sellers', data: { name: 'API Test Seller', marketplace: 'Amazon.com', sellerId: 'TEST-' + Date.now(), status: 'Active' } },
        {
            name: 'POST Bulk Calculator ASINs', method: 'post', url: '/revenue/asins/bulk', data: [
                { asinCode: 'B0TEST1', title: 'Test Product 1', category: 'Electronics', price: 999, weight: 0.5 },
                { asinCode: 'B0TEST2', title: 'Test Product 2', category: 'Beauty', price: 499, weight: 0.2 }
            ]
        },
        { name: 'POST Trigger Calculation', method: 'post', url: '/revenue/calculate', data: { asinIds: [] } }
    ];

    for (const test of tests) {
        try {
            console.log(`\n--- Running: ${test.name} ---`);
            const response = await client({
                method: test.method,
                url: test.url,
                data: test.data
            });
            console.log(`Status: ${response.status}`);

            // Handle different response structures
            const data = response.data.data || response.data;

            if (Array.isArray(data)) {
                console.log(`Data count: ${data.length}`);
            } else if (data.sellers && Array.isArray(data.sellers)) {
                console.log(`Sellers count: ${data.sellers.length}`);
            } else {
                console.log('Response:', JSON.stringify(data).substring(0, 150) + '...');
            }

            // If it was a POST Seller, test PUT and then DELETE
            if (test.name === 'POST New Seller' && response.status === 201) {
                const id = response.data._id || response.data.Id;
                console.log(`\n--- Running: PUT Seller ${id} ---`);
                const putRes = await client.put(`/sellers/${id}`, {
                    name: 'API Test Seller (Updated)',
                    marketplace: 'Amazon.co.uk',
                    sellerId: test.data.sellerId,
                    status: 'Inactive'
                });
                console.log(`PUT Status: ${putRes.status}`);

                console.log(`\n--- Running: DELETE Seller ${id} ---`);
                const delRes = await client.delete(`/sellers/${id}`);
                console.log(`DELETE Status: ${delRes.status}`);
            }
        } catch (error) {
            console.error(`❌ FAILED: ${test.name}`);
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.error('Error Message:', error.message);
            }
        }
    }
}

runTests();
