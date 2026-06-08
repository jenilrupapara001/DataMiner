require('dotenv').config({ path: '/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/.env' });
const { sql, getPool } = require('./backend/database/db.js');

async function check() {
  try {
    const pool = await getPool();
    const tasksRes = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Tasks'");
    const actionsRes = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Actions'");
    console.log("Tasks Table Exists:", tasksRes.recordset.length > 0);
    console.log("Actions Table Exists:", actionsRes.recordset.length > 0);
    
    if (tasksRes.recordset.length > 0) {
        const columns = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks'");
        console.log("Tasks Columns:", columns.recordset);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
