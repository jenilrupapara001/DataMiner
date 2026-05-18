const { getPool } = require('../database/db');
const sql = require('mssql');
const marketDataSyncService = require('../services/marketDataSyncService');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
    try {
        console.log("Initializing database connection...");
        const pool = await getPool();
        
        console.log("Counting records in AsinHistory...");
        const asinHistCount = await pool.request().query("SELECT COUNT(*) as count FROM AsinHistory");
        console.log("AsinHistory count:", asinHistCount.recordset[0].count);
        
        console.log("Counting records in SubBsrHistory...");
        const subBsrHistCount = await pool.request().query("SELECT COUNT(*) as count FROM SubBsrHistory");
        console.log("SubBsrHistory count:", subBsrHistCount.recordset[0].count);
        
        console.log("Getting sample AsinHistory records...");
        const asinHistSamples = await pool.request().query("SELECT TOP 5 * FROM AsinHistory ORDER BY Date DESC");
        console.log("AsinHistory samples:", asinHistSamples.recordset);
        
        console.log("Getting sample SubBsrHistory records...");
        const subBsrHistSamples = await pool.request().query("SELECT TOP 5 * FROM SubBsrHistory ORDER BY Date DESC");
        console.log("SubBsrHistory samples:", subBsrHistSamples.recordset);
        
        process.exit(0);
    } catch (err) {
        console.error("Error querying history tables:", err);
        process.exit(1);
    }
}

main();
