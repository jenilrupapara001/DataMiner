const pool = require('./db');

async function checkSchemas() {
    try {
        console.log('Checking AdsPerformance schema:');
        const resultAds = await pool.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'AdsPerformance'");
        console.table(resultAds.recordset);

        console.log('\nChecking Asins schema:');
        const resultAsins = await pool.query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Asins'");
        console.table(resultAsins.recordset);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSchemas();
