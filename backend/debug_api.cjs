require('dotenv').config();
const axios = require('axios');

const taskId = 'c6ebbaff-448f-3c6d-92d2-5caa10ea5db5';
const apiKey = process.env.MARKET_SYNC_API_KEY;

async function debug() {
    const tests = [
        { base: 'http://dataapi.octoparse.com', ep: `/api/alldata/GetDataOfTaskByOffset?taskId=${taskId}&offset=0&size=10` },
        { base: 'https://dataapi.octoparse.com', ep: `/api/alldata/GetDataOfTaskByOffset?taskId=${taskId}&offset=0&size=10` },
        { base: 'https://openapi.octoparse.com', ep: `/api/notexporteddata/get?taskId=${taskId}&size=10` }
    ];

    for (const test of tests) {
        try {
            console.log(`🔍 Testing: ${test.base}${test.ep}`);
            const res = await axios.get(`${test.base}${test.ep}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            console.log(`✅ SUCCESS! Status: ${res.status}`);
            return; 
        } catch (err) {
            console.log(`❌ FAILED: ${err.response?.status || err.message}`);
        }
    }
}

debug();
