const { getPool, sql } = require('../database/db');
require('dotenv').config();

async function simulateAuth() {
  try {
    const pool = await getPool();
    
    // Get a user with catalogue_manager role
    const userResult = await pool.request()
      .query(`
        SELECT TOP 1 U.Id, U.Email, R.Name as RoleName, U.RoleId
        FROM Users U
        JOIN Roles R ON U.RoleId = R.Id
        WHERE R.Name = 'catalogue_manager'
      `);
    
    if (userResult.recordset.length === 0) {
      console.log('No catalogue_manager user found');
      process.exit(0);
    }
    
    const user = userResult.recordset[0];
    console.log(`Simulating auth for user: ${user.Email} (Role: ${user.RoleName})`);
    
    // Simulation of Step 2 in authenticate middleware: Fetch Permissions
    const permissionsResult = await pool.request()
      .input('roleId', sql.VarChar, user.RoleId)
      .query(`
        SELECT P.Name 
        FROM Permissions P
        JOIN RolePermissions RP ON P.Id = RP.PermissionId
        WHERE RP.RoleId = @roleId
      `);
    const permissions = permissionsResult.recordset.map(p => p.Name);
    
    console.log('Permissions assigned to role:');
    permissions.forEach(p => console.log(`- ${p}`));
    
    const hasSellerView = permissions.includes('seller_view');
    console.log(`Has seller_view: ${hasSellerView}`);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

simulateAuth();
