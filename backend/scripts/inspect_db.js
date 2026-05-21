const { getPool } = require('../database/db');

async function inspect() {
    try {
        const pool = await getPool();
        console.log("Connected successfully!");

        // Check Asins table SellerId format
        const asinsSample = await pool.request().query("SELECT TOP 5 SellerId, AsinCode FROM Asins");
        console.log("Asins Sample:", asinsSample.recordset);

        process.exit(0);
    } catch (err) {
        console.error("Error inspecting:", err);
        process.exit(1);
    }
}

inspect();
