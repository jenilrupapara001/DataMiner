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
        enableArithAbort: true,
        useUTC: false
    },
    requestTimeout: 120000,
    connectionTimeout: 60000,
    cancelTimeout: 10000,
    pool: {
        max: 200,
        min: 10,
        idleTimeoutMillis: 10000
    }
};

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then(async pool => {
                // Dynamically calculate TZ offset in minutes
                const tz = process.env.AUTOMATION_TIMEZONE || 'Asia/Kolkata';
                const d = new Date();
                const utcStr = d.toLocaleString('en-US', { timeZone: 'UTC' });
                const locStr = d.toLocaleString('en-US', { timeZone: tz });
                const offsetMins = Math.round((new Date(locStr) - new Date(utcStr)) / 60000);
                
                // Inject the Global Env Date UDF - check if exists first to avoid constraint issues
                try {
                    const checkResult = await pool.request().query(`
                        SELECT OBJECT_ID(N'dbo.GetEnvDate', N'FN') AS FuncId
                    `);
                    
                    if (!checkResult.recordset[0]?.FuncId) {
                        // Function doesn't exist, create it
                        await pool.request().query(`
                            CREATE FUNCTION dbo.GetEnvDate()
                            RETURNS DATETIME2
                            AS
                            BEGIN
                                RETURN DATEADD(minute, ${offsetMins}, GETUTCDATE())
                            END
                        `);
                    } else {
                        // Function exists, try to alter but continue if constrained
                        try {
                            await pool.request().query(`
                                ALTER FUNCTION dbo.GetEnvDate()
                                RETURNS DATETIME2
                                AS
                                BEGIN
                                    RETURN DATEADD(minute, ${offsetMins}, GETUTCDATE())
                                END
                            `);
                        } catch (alterErr) {
                            // Function is likely bound by a constraint - use existing definition
                            if (!alterErr.message.includes('referenced by object')) {
                                throw alterErr;
                            }
                            console.log('ℹ️  dbo.GetEnvDate exists with constraints - using existing definition');
                        }
                    }
                } catch (err) {
                    // Only log but don't throw - existing function can still be used
                    if (!err.message.includes('referenced by object')) {
                        console.error('❌ SQL UDF setup warning:', err.message);
                    }
                }
                
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

/**
 * Execute a database query with deadlock retry logic.
 */
async function executeWithRetry(queryFn, maxRetries = 5, retryDelayMs = 250) {
    let retries = 0;
    while (true) {
        try {
            return await queryFn();
        } catch (err) {
            const isDeadlock = err.number === 1205 || (err.message && err.message.toLowerCase().includes('deadlock'));
            const isConnectionError = err.message && (
                err.message.toLowerCase().includes('failed to connect') ||
                err.message.toLowerCase().includes('timeout') ||
                err.message.toLowerCase().includes('socket hang up') ||
                err.message.toLowerCase().includes('sequence')
            );

            if ((isDeadlock || isConnectionError) && retries < maxRetries) {
                const jitter = Math.floor(Math.random() * 200);
                const delay = (retryDelayMs * Math.pow(2, retries)) + jitter;
                console.warn(`[DB] Transient error detected (${isDeadlock ? 'Deadlock' : 'Connection'}). Retrying transaction in ${delay}ms... (Attempt ${retries + 1} of ${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries++;
            } else {
                throw err;
            }
        }
    }
}

module.exports = {
    sql,
    getPool,
    query,
    generateId,
    executeWithRetry
};
