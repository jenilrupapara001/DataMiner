const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

// Logical sequence to build from scratch
const executionOrder = [
    // 1. Base Schemas
    'schema_v1.sql',
    'create_missing_tables.sql',
    'create_chat_tables.sql',
    'create_template_tables.sql',
    'create_fee_tables.sql',
    'revenue_schema.sql',
    
    // 2. Schema Alterations
    'alter_files_table.sql',
    'alter_team_schema.sql',
    'alter_apikeys_table.sql',
    'alter_alerts_table.sql',
    'alter_schema_for_keepa.sql',
    'alter_users_permissions.sql',

    // 3. Schema Fixes
    'fix_rules_schema.sql',
    'fix_okr_schema.sql',
    'fix_systemlogs_schema.sql',
    'fix_cometchat_schema.sql',
    'fix_revenue_calc_schema.sql',
    'fix_keepa_columns.sql',
    'fix_asin_schema.sql',

    // 4. Schema Additions & Indexes
    'add_performance_indexes.sql',
    'add_missing_asin_fields.sql',
    'add_price_dispute_column.sql'
];

async function executeSqlBatch(pool, sqlScript) {
    // Split by GO statements (SQL Server batch separator)
    const batches = sqlScript.split(/[\r\n]+\s*GO\s*[\r\n]+/i);

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i].trim();
        if (!batch) continue;

        try {
            await pool.request().batch(batch);
        } catch (err) {
            console.error(`\n    ❌ Batch Execution Error:`, err.message);
            if (err.precedingErrors && err.precedingErrors.length > 0) {
                console.error(`    Details:`, err.precedingErrors.map(e => e.message).join(' | '));
            }
            console.error(`    Excerpt: ${batch.substring(0, 150)}...`);
        }
    }
}

async function rebuildDatabase() {
    console.log('🔄 INITIALIZING RETAILOPS DATABASE FROM SCRATCH...');
    console.log(`📡 Connecting to SQL Server: ${config.server} (${config.database})`);
    
    let pool;
    try {
        const masterConfig = { ...config, database: 'master' };
        pool = await sql.connect(masterConfig);
        console.log('✅ Connected to Master Database.');

        const checkDbResult = await pool.request().query(`SELECT name FROM sys.databases WHERE name = '${config.database}'`);
        if (checkDbResult.recordset.length === 0) {
            console.log(`⚠️ Database "${config.database}" does not exist. Creating it now...`);
            await pool.request().query(`CREATE DATABASE ${config.database}`);
            console.log(`✅ Created database: ${config.database}`);
        } else {
            console.log(`📦 Database "${config.database}" found.`);
        }

        // Reconnect directly to the target database
        await pool.close();
        pool = await sql.connect(config);
        console.log(`✅ Switched context to target database: ${config.database}\n`);

        const dbDir = path.join(__dirname, '../database');
        let successCount = 0;

        for (const filename of executionOrder) {
            const filepath = path.join(dbDir, filename);
            if (!fs.existsSync(filepath)) {
                console.warn(`  ⚠️ Skipping ${filename} (File not found)`);
                continue;
            }

            console.log(`  ⏳ Executing ${filename}...`);
            const scriptContent = fs.readFileSync(filepath, 'utf8');
            
            await executeSqlBatch(pool, scriptContent);
            console.log(`  ✅ Finished ${filename}`);
            successCount++;
        }

        console.log(`\n🎉 DATABASE INITIALIZATION COMPLETE! Successfully processed ${successCount} scripts.`);
        
    } catch (err) {
        console.error('\n💥 FATAL ERROR during initialization:', err.message);
    } finally {
        if (pool) await pool.close();
        process.exit(0);
    }
}

rebuildDatabase();
