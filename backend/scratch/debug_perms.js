const { getPool, sql } = require('../database/db');
require('dotenv').config();

async function checkPerms() {
  try {
    const pool = await getPool();
    console.log('Checking permissions for catalogue_manager...');
    
    const result = await pool.request()
      .query(`
        SELECT R.Name as RoleName, P.Name as PermissionName 
        FROM Roles R
        JOIN RolePermissions RP ON R.Id = RP.RoleId
        JOIN Permissions P ON RP.PermissionId = P.Id
        WHERE R.Name = 'catalogue_manager'
      `);
    
    console.log('Permissions found:', result.recordset.length);
    result.recordset.forEach(p => console.log(`- ${p.PermissionName}`));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkPerms();
