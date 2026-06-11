const fs = require('fs');
const path = require('path');
const { getPool } = require('../backend/database/db');

async function run() {
  try {
    const pool = await getPool();
    const sqlFile = path.join(__dirname, '../backend/database/alter_rulesets_table.sql');
    const sqlScript = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by GO statements
    const batches = sqlScript.split(/[\r\n]+\s*GO\s*[\r\n]+/i);
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i].trim();
        if (!batch) continue;
        console.log(`Running batch ${i+1}...`);
        await pool.request().batch(batch);
    }
    console.log('✅ Alter Rulesets script completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error running script:', err);
    process.exit(1);
  }
}

run();
