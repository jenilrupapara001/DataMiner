const { getPool } = require('./db');

async function main() {
    try {
        const pool = await getPool();
        console.log("Adding column PercentageContribution to GmsTargetBreakdowns...");
        const queryText = `
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[GmsTargetBreakdowns]') 
                  AND name = 'PercentageContribution'
            )
            BEGIN
                ALTER TABLE [GmsTargetBreakdowns] ADD [PercentageContribution] DECIMAL(5, 2) NULL;
            END
        `;
        await pool.request().query(queryText);
        console.log("Migration executed successfully!");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        process.exit(0);
    }
}

main();
