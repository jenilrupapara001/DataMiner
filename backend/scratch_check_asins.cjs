const { getPool } = require('./database/db');
const sql = require('mssql');

async function checkAsins() {
    try {
        const pool = await getPool();
        const sellerResult = await pool.request()
            .input('name', sql.VarChar, '101-BHARVITA')
            .query('SELECT Id FROM Sellers WHERE Name = @name');
        
        const seller = sellerResult.recordset[0];
        if (!seller) {
            console.log('Seller 101-BHARVITA not found!');
            return;
        }
        
        console.log('Seller ID:', seller.Id);

        const statusResult = await pool.request()
            .input('sellerId', sql.VarChar, seller.Id)
            .query('SELECT Status, COUNT(*) as Count FROM Asins WHERE SellerId = @sellerId GROUP BY Status');
        
        console.log('--- ASIN Status Counts ---');
        console.dir(statusResult.recordset, { depth: null });
        
        const sampleResult = await pool.request()
            .input('sellerId', sql.VarChar, seller.Id)
            .query('SELECT TOP 5 AsinCode, Status, ScrapeStatus, Marketplace FROM Asins WHERE SellerId = @sellerId');
        
        console.log('--- Sample ASINs ---');
        console.dir(sampleResult.recordset, { depth: null });
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkAsins();
