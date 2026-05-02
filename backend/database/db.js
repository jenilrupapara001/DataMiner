const sql = require('mssql');
const path = require('path');
const { randomUUID } = require('crypto');
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
    },
    requestTimeout: 120000,
    pool: {
        max: 25,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then(pool => {
                // console.log('✅ Connected to SQL Server Pool');
                return pool;
            })
            .catch(err => {
                console.error('❌ SQL Connection Pool Error:', err.message);
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

async function query(text, params = []) {
    const pool = await getPool();
    const request = pool.request();
    
    // Add parameters if any
    if (params && params.length > 0) {
        params.forEach((p, i) => {
            request.input(`param${i}`, p);
        });
    }
    
    return request.query(text);
}

/**
 * Generate a UUID for SQL Server ID fields
 * Uses crypto.randomUUID() for UUID format, then removes dashes to fit VARCHAR(24)
 * Falls back to timestamp-based ID if UUID generation fails
 */
function generateId() {
    try {
        // crypto.randomUUID() generates format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        // We need to remove dashes and take first 24 chars
        const uuid = randomUUID().replace(/-/g, '');
        return uuid.substring(0, 24);
    } catch (err) {
        // Fallback: timestamp + random hex
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 12);
        return (timestamp + random).substring(0, 24);
    }
}

module.exports = {
    sql,
    getPool,
    query,
    generateId
};
