const { getPool } = require('./db');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        const pool = await getPool();
        const sqlFilePath = path.join(__dirname, 'create_targets_schema.sql');
        const sqlText = fs.readFileSync(sqlFilePath, 'utf8');
        
        console.log("Executing Targets Schema DDL...");
        // Split by GO if present, otherwise execute as single query
        const statements = sqlText.split(/^[ \t]*GO[ \t]*$/mi);
        
        for (const statement of statements) {
            const trimmed = statement.trim();
            if (trimmed) {
                await pool.request().query(trimmed);
            }
        }
        
        console.log("Targets and TargetBreakdowns tables created successfully with optimal indices!");
    } catch (e) {
        console.error("DDL execution failed:", e);
    } finally {
        process.exit(0);
    }
}

main();
