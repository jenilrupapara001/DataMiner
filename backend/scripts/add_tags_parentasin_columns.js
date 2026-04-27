/**
 * Migration: Add Tags and ParentAsin columns to Asins table
 * Run once: node scripts/add_tags_parentasin_columns.js
 */

const { getPool, sql } = require('../database/db');

async function run() {
    const pool = await getPool();

    console.log('🔧 Checking and adding Tags / ParentAsin columns...');

    const migrations = [
        {
            name: 'ParentAsin',
            sql: `IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME='Asins' AND COLUMN_NAME='ParentAsin'
                  )
                  ALTER TABLE Asins ADD ParentAsin NVARCHAR(20) NULL;`
        },
        {
            name: 'Tags',
            sql: `IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME='Asins' AND COLUMN_NAME='Tags'
                  )
                  ALTER TABLE Asins ADD Tags NVARCHAR(MAX) NULL;`
        }
    ];

    for (const m of migrations) {
        try {
            await pool.request().query(m.sql);
            console.log(`✅ ${m.name} column ready`);
        } catch (err) {
            console.error(`❌ ${m.name} failed:`, err.message);
        }
    }

    console.log('✅ Migration complete');
    process.exit(0);
}

run().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
