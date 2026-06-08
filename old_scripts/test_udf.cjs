const { getPool } = require('./backend/database/db.js');
async function test() {
    try {
        const pool = await getPool();
        await pool.request().query(`
            CREATE OR ALTER FUNCTION dbo.GetEnvDate()
            RETURNS DATETIME2
            AS
            BEGIN
                RETURN DATEADD(minute, 330, GETUTCDATE())
            END
        `);
        const res = await pool.request().query(`SELECT dbo.GetEnvDate() AS Now`);
        console.log('Success:', res.recordset[0].Now);
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}
test();
