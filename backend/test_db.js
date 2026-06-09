require('dotenv').config();
const sql = require('mssql');
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
  try {
    await sql.connect(config);
    const result = await sql.query(`
        SELECT t.SellerId, t.GoalType, ISNULL(b.TargetValue, t.TotalTargetValue) as TotalTargetValue
        FROM GmsTargets t
        LEFT JOIN GmsTargetBreakdowns b ON t.Id = b.TargetId AND b.PeriodType = 'MONTH' AND b.PeriodValue = 6
        WHERE t.Year = 2026
          AND (
              (t.TargetType = 'MONTHLY' AND t.Month = 6) 
              OR 
              (t.TargetType = 'YEARLY')
          )
          AND t.GoalType IN ('ADS', 'ACOS')
    `);
    console.log("Targets for this month:", result.recordset);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
run();
