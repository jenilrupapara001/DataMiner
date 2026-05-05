const { getPool } = require('./database/db');
require('dotenv').config();

async function diagnoseScheduler() {
  console.log('🔍 [DIAGNOSTIC] Checking Automation Configuration...');
  console.log('AUTOMATION_ENABLED:', process.env.AUTOMATION_ENABLED);
  console.log('AUTOMATION_12AM_ENABLED:', process.env.AUTOMATION_12AM_ENABLED);
  console.log('AUTOMATION_12AM_CRON:', process.env.AUTOMATION_12AM_CRON);
  console.log('AUTOMATION_2PM_ENABLED:', process.env.AUTOMATION_2PM_ENABLED);
  console.log('AUTOMATION_2PM_CRON:', process.env.AUTOMATION_2PM_CRON);

  try {
    const pool = await getPool();
    const sellersResult = await pool.request()
      .query("SELECT Name, OctoparseId, IsActive FROM Sellers WHERE IsActive = 1 AND OctoparseId IS NOT NULL AND OctoparseId != ''");
    
    console.log(`\n🏢 [DIAGNOSTIC] Found ${sellersResult.recordset.length} sellers eligible for automation:`);
    sellersResult.recordset.forEach(s => {
      console.log(` - ${s.Name} (Task ID: ${s.OctoparseId})`);
    });

    if (sellersResult.recordset.length === 0) {
      console.log('❌ [DIAGNOSTIC] No active sellers found with valid Octoparse IDs. Automation will skip.');
    }

    if (process.env.AUTOMATION_ENABLED !== 'true') {
      console.log('❌ [DIAGNOSTIC] Master AUTOMATION_ENABLED is not set to "true".');
    }

  } catch (err) {
    console.error('❌ [DIAGNOSTIC] Database error:', err.message);
  }
  process.exit(0);
}

diagnoseScheduler();
