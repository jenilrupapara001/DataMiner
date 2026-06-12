const { getPool, sql } = require('./db');

async function main() {
    try {
        const pool = await getPool();
        console.log("Checking if UserId column exists in GmsTargets table...");
        
        const checkQuery = `
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[GmsTargets]') AND name = 'UserId'
            )
            BEGIN
                ALTER TABLE [GmsTargets] ADD [UserId] VARCHAR(24) NULL;
                ALTER TABLE [GmsTargets] ADD CONSTRAINT FK_GmsTargets_User FOREIGN KEY (UserId) REFERENCES Users(Id);
                SELECT 'ADDED' AS status;
            END
            ELSE
            BEGIN
                SELECT 'EXISTS' AS status;
            END
        `;
        
        const res = await pool.request().query(checkQuery);
        const status = res.recordset[0]?.status;
        if (status === 'ADDED') {
            console.log("Successfully added UserId column and foreign key constraint to GmsTargets table!");
        } else {
            console.log("UserId column already exists in GmsTargets table.");
        }
    } catch (e) {
        console.error("Failed to alter GmsTargets table:", e);
    } finally {
        process.exit(0);
    }
}

main();
