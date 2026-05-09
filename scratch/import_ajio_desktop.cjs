const fs = require('fs');
const path = require('path');
const AsinDataParser = require('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/services/asinDataParser');
const { getPool } = require('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/database/db');

async function run() {
    try {
        console.log('Loading JSON file from Desktop...');
        const jsonPath = '/Users/jenilrupapara/Desktop/101-BHARVITA-AJIO(1).json';
        const rawJson = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(rawJson);
        console.log(`Loaded ${data.length} items from JSON.`);

        const sellerId = '04f6d6304f1e4153aad48d65';
        console.log(`Starting bulk upsert for seller ID: ${sellerId}...`);
        const results = await AsinDataParser.bulkUpsertAsins(data, sellerId);
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        console.log(`Bulk upsert completed: ${successCount} succeeded, ${failCount} failed.`);
        
        if (failCount > 0) {
            console.log('Sample failures:', results.filter(r => !r.success).slice(0, 5));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error during importing:', error);
        process.exit(1);
    }
}

run();
