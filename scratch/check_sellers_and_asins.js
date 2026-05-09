const { getPool } = require('../backend/database/db');

async function check() {
    try {
        console.log('Connecting to database...');
        const pool = await getPool();
        console.log('Connected!');

        console.log('\n--- Sellers ---');
        const sellersResult = await pool.request().query('SELECT Id, Name, Marketplace FROM Sellers');
        console.log(sellersResult.recordset);

        console.log('\n--- Top 5 Asins ---');
        const asinsResult = await pool.request().query('SELECT TOP 5 Id, AsinCode, SellerId, Title, CurrentPrice, Rating, ReviewCount, AvailabilityStatus FROM Asins');
        console.log(asinsResult.recordset);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
