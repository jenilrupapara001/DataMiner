const { getPool, sql, generateId } = require('../database/db');
const tagController = require('./tagController');

async function testBulkTags() {
    try {
        const pool = await getPool();
        console.log('✅ Connected to SQL Server');

        // 1. Find some ASINs to test with
        const asinsRes = await pool.request().query('SELECT TOP 2 Id, AsinCode, Tags FROM Asins');
        const asins = asinsRes.recordset;

        if (asins.length === 0) {
            console.log('❌ No ASINs found in database');
            return;
        }

        const ids = asins.map(a => a.Id);
        console.log(`🧪 Testing bulk update on: ${ids.join(', ')}`);

        // 2. Mock request body
        const body = {
            asinIds: ids,
            tags: ['BulkTestTag', 'Antigravity'],
            action: 'add'
        };

        // 4. Mock req/res
        const req = {
            body,
            user: {
                id: 'system_test',
                firstName: 'Antigravity',
                lastName: 'Tester'
            }
        };

        const res = {
            json: (data) => console.log('📝 Response JSON:', JSON.stringify(data, null, 2)),
            status: (code) => {
                console.log(`🚩 Response Status: ${code}`);
                return res;
            }
        };

        await tagController.bulkUpdateTags(req, res);
        
        console.log('✅ Test finished');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
}

testBulkTags();
