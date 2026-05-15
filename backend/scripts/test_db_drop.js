const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: 'master',
    port: parseInt(process.env.DB_PORT),
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};

async function dropDB() {
    try {
        const pool = await sql.connect(config);
        console.log('Connected to master. Dropping retailops...');
        await pool.request().query('ALTER DATABASE retailops SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE retailops;');
        console.log('Database dropped.');
        await pool.close();
    } catch (e) {
        console.error(e.message);
    }
}
dropDB();
