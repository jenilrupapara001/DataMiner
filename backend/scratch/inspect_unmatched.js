const { getPool } = require('../database/db');

async function main() {
    const pool = await getPool();
    
    // Get 10 unmatched records
    const unmatched = await pool.request().query(`
        SELECT DISTINCT TOP 10 p.Asin, p.AdvertisedSku
        FROM AdsPerformance p
        LEFT JOIN Asins a ON p.Asin = a.AsinCode
        WHERE a.AsinCode IS NULL AND p.UploadedAt >= '2026-05-18T00:00:00Z'
    `);
    console.log('Unmatched ASINs & SKUs from today\'s upload:', unmatched.recordset);
    
    // Check if any of these SKUs exist in the Asins table!
    for (const row of unmatched.recordset) {
        if (row.AdvertisedSku && row.AdvertisedSku !== 'None') {
            const bySku = await pool.request()
                .input('sku', row.AdvertisedSku)
                .query('SELECT AsinCode, Sku, SellerId FROM Asins WHERE Sku = @sku');
            if (bySku.recordset.length > 0) {
                console.log(`SKU Match found for ${row.AdvertisedSku}:`, bySku.recordset);
            }
        }
    }
}

main().catch(console.error);
