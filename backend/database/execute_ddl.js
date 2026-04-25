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
        encrypt: false, // Set to false if using IP address and getting TLS errors
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function executeDDL() {
    try {
        console.log('🔄 Connecting to SQL Server...');
        await sql.connect(config);
        console.log('✅ Connected to SQL Server');

        const schemaPath = path.join(__dirname, 'schema_v1.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Split by semicolon and filter out empty strings
        // Note: This is a simple split. For complex scripts with triggers/procedures, 
        // you might need a more robust parser.
        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        console.log(`🚀 Executing ${statements.length} SQL statements...`);

        for (let i = 0; i < statements.length; i++) {
            try {
                await sql.query(statements[i]);
                // console.log(`  [${i + 1}/${statements.length}] Success`);
            } catch (err) {
                console.error(`  ❌ Error in statement ${i + 1}:`, err.message);
                console.error('  Statement:', statements[i]);
                // Depending on the error, we might want to continue or stop
                // For now, let's stop on error to avoid partial schema
                throw err;
            }
        }

        console.log('✨ DDL execution completed successfully');
    } catch (err) {
        console.error('❌ DDL Execution Failed:', err.message);
    } finally {
        await sql.close();
    }
}

executeDDL();
