const { getPool } = require('../database/db');
const sql = require('mssql');

async function cleanAutomatedSellers() {
    console.log('🧹 Starting cleanup of Automated Test Sellers...');
    try {
        const pool = await getPool();

        // 1. Fetch any automated test sellers
        const sellersResult = await pool.request()
            .query("SELECT Id, Name FROM Sellers WHERE Name LIKE 'Automated Test%' OR Name LIKE 'Test Seller%' OR SellerId LIKE 'SELLER%'");
        const sellers = sellersResult.recordset;
        console.log(`Found ${sellers.length} automated test sellers to delete:`, sellers);

        if (sellers.length > 0) {
            for (const seller of sellers) {
                console.log(`\nRemoving Seller: ${seller.Name} (${seller.Id})...`);

                // A. Get all ASINs for this seller
                const asinsResult = await pool.request()
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query('SELECT Id FROM Asins WHERE SellerId = @sellerId');
                const asins = asinsResult.recordset;

                if (asins.length > 0) {
                    const asinIdsStr = asins.map(a => `'${a.Id}'`).join(',');
                    
                    // Delete ASIN metrics
                    const historyDel = await pool.request().query(`DELETE FROM AsinHistory WHERE AsinId IN (${asinIdsStr})`);
                    const weekHistoryDel = await pool.request().query(`DELETE FROM AsinWeekHistory WHERE AsinId IN (${asinIdsStr})`);
                    const subBsrDel = await pool.request().query(`DELETE FROM SubBsrHistory WHERE AsinId IN (${asinIdsStr})`);
                    const revCalcDel = await pool.request().query(`DELETE FROM RevenueCalculators WHERE AsinId IN (${asinIdsStr})`);
                    
                    console.log(`  ✓ Deleted ASIN history metrics (${historyDel.rowsAffected[0]} rows), subBsr (${subBsrDel.rowsAffected[0]} rows), and revenue calculators (${revCalcDel.rowsAffected[0]} rows).`);
                }

                // B. Delete Actions
                const actionsDel = await pool.request()
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query('DELETE FROM Actions WHERE SellerId = @sellerId');
                console.log(`  ✓ Deleted ${actionsDel.rowsAffected[0]} related actions/tasks.`);

                // C. Update OctoTasks
                const octoUpdate = await pool.request()
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query('UPDATE OctoTasks SET SellerId = NULL, IsAssigned = 0, LastAssignedAt = NULL WHERE SellerId = @sellerId');
                console.log(`  ✓ Unassigned OctoTasks.`);

                // D. Delete UserSellers
                const userSellersDel = await pool.request()
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query('DELETE FROM UserSellers WHERE SellerId = @sellerId');
                console.log(`  ✓ Deleted ${userSellersDel.rowsAffected[0]} user mapping entries.`);

                // E. Delete Asins
                const asinsDel = await pool.request()
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query('DELETE FROM Asins WHERE SellerId = @sellerId');
                console.log(`  ✓ Deleted ${asinsDel.rowsAffected[0]} ASIN profiles.`);

                // F. Delete Seller
                const sellerDel = await pool.request()
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query('DELETE FROM Sellers WHERE Id = @sellerId');
                console.log(`  ✓ Permanently deleted Seller profile.`);
            }
        }

        console.log('\n🎉 Cleanups complete! All automated test sellers removed successfully.');
    } catch (err) {
        console.error('❌ Cleanups Failed:', err.message);
    } finally {
        process.exit();
    }
}

cleanAutomatedSellers();
