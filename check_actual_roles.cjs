const { getPool } = require('./backend/database/db');

async function run() {
    try {
        const pool = await getPool();
        const res = await pool.request().query("SELECT Name, DisplayName FROM Roles");
        console.log("Roles in DB:", JSON.stringify(res.recordset, null, 2));
        
        const usersRes = await pool.request().query("SELECT TOP 10 U.Email, R.Name FROM Users U JOIN Roles R ON U.RoleId = R.Id");
        console.log("Users and Roles:", JSON.stringify(usersRes.recordset, null, 2));
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
