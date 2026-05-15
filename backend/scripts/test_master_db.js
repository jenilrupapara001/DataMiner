const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: 'master', // Connecting to master instead of retailops
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function testConnection() {
    try {
        await sql.connect(config);
        console.log('✅ Successfully connected to MASTER database!');
        const result = await sql.query("SELECT name FROM sys.databases WHERE name = 'retailops'");
        if (result.recordset.length > 0) {
            console.log('📦 The database "retailops" DOES exist.');
        } else {
            console.log('⚠️ The database "retailops" DOES NOT exist.');
        }
    } catch (err) {
        console.error('❌ Error connecting to master:', err.message);
    } finally {
        await sql.close();
    }
}

testConnection();
