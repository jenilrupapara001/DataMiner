const { getPool } = require('../database/db');
const AutoTagService = require('../services/autoTagService');

async function main() {
    try {
        console.log('🔄 Starting manual age tag refresh...');
        const pool = await getPool();
        const result = await AutoTagService.batchUpdateAgeTags(pool);
        console.log(`✅ Refresh complete: ${result.updated} updated, ${result.skipped} skipped, ${result.total} total`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Refresh failed:', error.message);
        process.exit(1);
    }
}

main();
