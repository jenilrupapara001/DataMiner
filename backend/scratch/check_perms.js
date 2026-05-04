require('dotenv').config({ path: '/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/.env' });
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
    connectTimeout: 10000
};

async function testConnection() {
    console.log('Testing connection to:', config.server);
    try {
        const pool = await sql.connect(config);
        console.log('✅ Connected successfully!');
        const result = await pool.request().query('SELECT TOP 1 * FROM Roles');
        console.log('Data fetch successful:', result.recordset.length > 0 ? 'Found roles' : 'No roles');
        await pool.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    }
}

testConnection();
