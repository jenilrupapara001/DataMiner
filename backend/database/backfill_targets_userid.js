const { getPool, sql } = require('./db');

async function main() {
    try {
        const pool = await getPool();
        console.log("Fetching users from database to match brand managers...");
        const usersRes = await pool.request().query("SELECT Id, FirstName, LastName FROM Users");
        const users = usersRes.recordset;
        console.log(`Loaded ${users.length} users.`);

        console.log("Backfilling GmsTargets.UserId from BrandManager names...");
        let updatedCount = 0;
        
        for (const user of users) {
            const fullName = `${user.FirstName || ''} ${user.LastName || ''}`.trim();
            if (!fullName) continue;

            const updateQuery = `
                UPDATE GmsTargets 
                SET UserId = @userId 
                WHERE BrandManager = @fullName AND (UserId IS NULL OR UserId != @userId)
            `;
            
            const res = await pool.request()
                .input('userId', sql.VarChar, user.Id)
                .input('fullName', sql.NVarChar, fullName)
                .query(updateQuery);
                
            if (res.rowsAffected[0] > 0) {
                console.log(`Associated ${res.rowsAffected[0]} targets to user: ${fullName} (${user.Id})`);
                updatedCount += res.rowsAffected[0];
            }
        }
        
        console.log(`Backfill complete! Total records updated: ${updatedCount}`);
    } catch (e) {
        console.error("Backfill failed:", e);
    } finally {
        process.exit(0);
    }
}

main();
