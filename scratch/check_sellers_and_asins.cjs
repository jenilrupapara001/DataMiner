const { getPool } = require('../backend/database/db');

async function check() {
    try {
        console.log('Connecting to database...');
        const pool = await getPool();
        console.log('Connected!');

        console.log('\n--- Sellers with Ajio or other marketplaces ---');
        const sellersResult = await pool.request().query("SELECT Id, Name, Marketplace FROM Sellers WHERE Marketplace LIKE '%ajio%' OR Name LIKE '%ajio%'");
        console.log(sellersResult.recordset);

        console.log('\n--- Unique Marketplaces ---');
        const marketplacesResult = await pool.request().query("SELECT DISTINCT Marketplace FROM Sellers");
        console.log(marketplacesResult.recordset);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
