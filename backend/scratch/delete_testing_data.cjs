const { getPool } = require('../database/db');
const sql = require('mssql');

async function cleanTestData() {
    console.log('🧹 Starting Test Data Database Cleanups...');
    try {
        const pool = await getPool();

        // 1. Fetch the Seller IDs to delete
        const sellersResult = await pool.request()
            .query("SELECT Id, Name, SellerId FROM Sellers WHERE Name LIKE 'Test Seller Inc%' OR SellerId LIKE 'SELLER%'");
        const sellers = sellersResult.recordset;
        console.log(`Found ${sellers.length} test sellers to remove.`);

        if (sellers.length > 0) {
            const sellerIdsStr = sellers.map(s => `'${s.Id}'`).join(',');

            // 2. Fetch the ASIN IDs to delete (either starting with B0TEST or belonging to test sellers)
            const asinsResult = await pool.request()
                .query(`SELECT Id, AsinCode FROM Asins WHERE AsinCode LIKE 'B0TEST%' OR SellerId IN (${sellerIdsStr})`);
            const asins = asinsResult.recordset;
            console.log(`Found ${asins.length} test ASINs to remove.`);

            if (asins.length > 0) {
                const asinIdsStr = asins.map(a => `'${a.Id}'`).join(',');

                // 3. Delete Actions linked to these ASINs or Sellers, or with testing titles
                const actionsDel = await pool.request()
                    .query(`DELETE FROM Actions WHERE Title = 'Verify Fees' OR Asins LIKE '%B0TEST%' OR SellerId IN (${sellerIdsStr})`);
                console.log(`✓ Deleted ${actionsDel.rowsAffected[0]} related actions/tasks.`);

                // 4. Delete Time-Series History records
                const historyDel = await pool.request()
                    .query(`DELETE FROM AsinHistory WHERE AsinId IN (${asinIdsStr})`);
                console.log(`✓ Deleted ${historyDel.rowsAffected[0]} daily history metrics.`);

                const subBsrDel = await pool.request()
                    .query(`DELETE FROM SubBsrHistory WHERE AsinId IN (${asinIdsStr})`);
                console.log(`✓ Deleted ${subBsrDel.rowsAffected[0]} sub-category BSR history metrics.`);

                const weekHistoryDel = await pool.request()
                    .query(`DELETE FROM AsinWeekHistory WHERE AsinId IN (${asinIdsStr})`);
                console.log(`✓ Deleted ${weekHistoryDel.rowsAffected[0]} week-level BSR history metrics.`);

                // 5. Delete ASIN records
                const asinsDel = await pool.request()
                    .query(`DELETE FROM Asins WHERE Id IN (${asinIdsStr})`);
                console.log(`✓ Deleted ${asinsDel.rowsAffected[0]} ASIN profiles.`);
            }

            // 6. Delete UserSellers mapping records
            const userSellersDel = await pool.request()
                .query(`DELETE FROM UserSellers WHERE SellerId IN (${sellerIdsStr})`);
            console.log(`✓ Deleted ${userSellersDel.rowsAffected[0]} user-seller mapping entries.`);

            // 7. Delete Seller records
            const sellersDel = await pool.request()
                .query(`DELETE FROM Sellers WHERE Id IN (${sellerIdsStr})`);
            console.log(`✓ Deleted ${sellersDel.rowsAffected[0]} seller profiles.`);
        } else {
            // Delete any orphaned test ASINs or Actions
            const asinsResult = await pool.request()
                .query("SELECT Id FROM Asins WHERE AsinCode LIKE 'B0TEST%'");
            const asins = asinsResult.recordset;

            if (asins.length > 0) {
                const asinIdsStr = asins.map(a => `'${a.Id}'`).join(',');
                
                await pool.request().query(`DELETE FROM Actions WHERE Title = 'Verify Fees' OR Asins LIKE '%B0TEST%'`);
                await pool.request().query(`DELETE FROM AsinHistory WHERE AsinId IN (${asinIdsStr})`);
                await pool.request().query(`DELETE FROM SubBsrHistory WHERE AsinId IN (${asinIdsStr})`);
                await pool.request().query(`DELETE FROM AsinWeekHistory WHERE AsinId IN (${asinIdsStr})`);
                await pool.request().query(`DELETE FROM Asins WHERE Id IN (${asinIdsStr})`);
                console.log(`✓ Deleted ${asins.length} orphaned test ASINs and their metrics.`);
            }
            console.log('No test sellers found to remove.');
        }

        console.log('🎉 Cleanups Complete! Database is fully restored to its pristine state.');
    } catch (err) {
        console.error('❌ Cleanups Failed:', err.message);
    } finally {
        process.exit();
    }
}

cleanTestData();
