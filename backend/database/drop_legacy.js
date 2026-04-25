const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

async function dropLegacy() {
    try {
        await sql.connect(config);
        console.log('🗑️  Dropping legacy tables...');
        
        // Order matters due to FKs
        await sql.query('DROP TABLE IF EXISTS RolePermissions');
        await sql.query('DROP TABLE IF EXISTS Roles');
        await sql.query('DROP TABLE IF EXISTS Permissions');
        
        console.log('✅ Legacy tables dropped');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await sql.close();
    }
}

dropLegacy();
