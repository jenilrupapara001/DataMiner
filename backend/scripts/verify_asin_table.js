const asinTableService = require('../services/asinTableService');

async function verify() {
    console.log('🚀 Verifying ASIN Table Service...');
    try {
        const result = await asinTableService.getAsinTableData({ 
            limit: 5,
            search: 'B0DHD5BVVM'
        });
        
        console.log('✅ Response Structure Check:');
        console.log('Pagination:', JSON.stringify(result.pagination, null, 2));
        
        if (result.data.length > 0) {
            const first = result.data[0];
            console.log('\n✅ Mapping Check (First ASIN):');
            console.log(`- ASIN: ${first.asinCode}`);
            console.log(`- _id: ${first._id}`);
            console.log(`- Price: ${first.currentPrice}`);
            console.log(`- MRP: ${first.mrp}`);
            console.log(`- BSR: ${first.bsr}`);
            console.log(`- History: ${first.history.length} points`);
            console.log(`- BuyBox Win: ${first.buyBoxWin}`);
        } else {
            console.log('⚠️  No data found for search query.');
        }
    } catch (e) {
        console.error('❌ Verification failed:', e);
    }
    process.exit(0);
}

verify();
