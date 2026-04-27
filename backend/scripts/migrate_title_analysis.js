const { getPool, sql } = require('../database/db');

async function migrate() {
  console.log('🚀 Starting Title Analysis migration...');
  try {
    const pool = await getPool();
    
    // Check if columns already exist
    const checkQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Asins' AND COLUMN_NAME = 'TitleScore'
    `;
    const checkResult = await pool.request().query(checkQuery);
    
    if (checkResult.recordset.length > 0) {
      console.log('✅ Columns already exist. Skipping migration.');
      process.exit(0);
    }

    console.log('📝 Adding columns to Asins table...');
    const alterQuery = `
      ALTER TABLE Asins ADD
          TitleScore INT NULL,
          TitleGrade NVARCHAR(3) NULL,
          TitleIssues NVARCHAR(MAX) NULL,
          TitleRecommendations NVARCHAR(MAX) NULL,
          TitleDetails NVARCHAR(MAX) NULL;
    `;
    await pool.request().query(alterQuery);
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
