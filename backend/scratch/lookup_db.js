const { getPool } = require('../database/db');

async function lookup() {
    const pool = await getPool();
    
    // Look up in Sellers
    const sellers = await pool.request().query("SELECT * FROM Sellers WHERE Id LIKE '%271e4de9e2dc81f6bc%' OR SellerId LIKE '%271e4de9e2dc81f6bc%'");
    console.log('Sellers:', sellers.recordset);

    // Look up in Asins
    const asins = await pool.request().query("SELECT Id, AsinCode, SellerId FROM Asins WHERE Id LIKE '%271e4de9e2dc81f6bc%' OR SellerId LIKE '%271e4de9e2dc81f6bc%'");
    console.log('Asins:', asins.recordset);

    // Look up in GmsTargets
    const targets = await pool.request().query("SELECT * FROM GmsTargets WHERE Id LIKE '%271e4de9e2dc81f6bc%' OR SellerId LIKE '%271e4de9e2dc81f6bc%'");
    console.log('Targets:', targets.recordset);
}

lookup().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
