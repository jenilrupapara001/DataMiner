const { getPool } = require('./database/db');
const sql = require('mssql');

async function run() {
  try {
    const pool = await getPool();
    const reqObj = pool.request();
    reqObj.input('subBsrCategory', sql.NVarChar, '%in Baby%');
    const dataRes = await reqObj.query(`
        SELECT TOP 5 SubBsr, Title
        FROM Asins
        WHERE SubBsr LIKE @subBsrCategory
    `);
    console.log("Returned rows: ", dataRes.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
