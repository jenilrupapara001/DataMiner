const axios = require('axios');

async function test() {
    try {
        console.log('Testing /api/asins/debug-tags...');
        const res = await axios.get('http://localhost:3001/api/asins/debug-tags');
        console.log('Response:', res.data);
    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

test();
