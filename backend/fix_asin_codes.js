const fs = require('fs');
const path = require('path');
const sql = require('mssql');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function fixAsins() {
    try {
        const content = fs.readFileSync('/Users/jenilrupapara/Downloads/ASIN-SKU.csv', 'utf8');
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        
        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length >= 2) {
                results.push({ ASIN: parts[0].trim(), SKU: parts[1].trim() });
            }
        }

        const pool = await sql.connect(config);
        console.log('Connected to DB. Total records to fix:', results.length);
        
        let totalUpdated = 0;
        let totalDeleted = 0;
        let notFound = 0;

        for (let i = 0; i < results.length; i++) {
            const sku = results[i].SKU;
            const asin = results[i].ASIN;
            
            // Auto-commit (no long transaction)
            const badRecordsReq = await pool.request()
                .input('skuValue', sql.VarChar, sku)
                .query('SELECT Id, SellerId FROM Asins WITH (NOLOCK) WHERE AsinCode = @skuValue');
            
            for (const badRecord of badRecordsReq.recordset) {
                const badId = badRecord.Id;
                const sellerId = badRecord.SellerId;

                const checkReq = await pool.request()
                    .input('realAsin', sql.VarChar, asin)
                    .input('sellerId', sql.VarChar, sellerId)
                    .query('SELECT Id FROM Asins WITH (NOLOCK) WHERE AsinCode = @realAsin AND SellerId = @sellerId');

                if (checkReq.recordset.length > 0) {
                    await pool.request()
                        .input('badId', sql.VarChar, badId)
                        .query('DELETE FROM Asins WHERE Id = @badId');
                    totalDeleted++;
                } else {
                    await pool.request()
                        .input('badId', sql.VarChar, badId)
                        .input('realAsin', sql.VarChar, asin)
                        .input('realSku', sql.NVarChar, sku)
                        .query(`
                            UPDATE Asins 
                            SET AsinCode = @realAsin, Sku = @realSku, UpdatedAt = DATEADD(minute, 330, GETUTCDATE())
                            WHERE Id = @badId
                        `);
                    totalUpdated++;
                }
            }

            if (badRecordsReq.recordset.length === 0) {
                notFound++;
            }
            
            if ((i + 1) % 100 === 0) {
                console.log(`Processed ${i + 1} / ${results.length}...`);
            }
        }

        console.log(`\n🎉 Data fix complete!`);
        console.log(`Successfully updated (renamed): ${totalUpdated}`);
        console.log(`Successfully deleted (duplicates): ${totalDeleted}`);
        console.log(`Not found (already fixed or missing): ${notFound}`);
            
        process.exit(0);
    } catch (err) {
        console.error('Fatal Error:', err);
        process.exit(1);
    }
}

fixAsins();
