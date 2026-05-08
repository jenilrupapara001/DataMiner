require('dotenv').config({ path: '/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/.env' });
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
    connectTimeout: 10000
};

async function migrate() {
    console.log('🔄 Connecting to SQL Server for Migration...');
    try {
        const pool = await sql.connect(config);
        console.log('✅ Connected successfully!');

        // Check and add ExtraPermissions column to Users
        const checkExtraResult = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'ExtraPermissions'
        `);
        if (checkExtraResult.recordset.length === 0) {
            console.log('Adding ExtraPermissions column to Users table...');
            await pool.request().query('ALTER TABLE Users ADD ExtraPermissions NVARCHAR(MAX) NULL');
            console.log('✅ Added ExtraPermissions column');
        } else {
            console.log('ExtraPermissions column already exists');
        }

        // Check and add ExcludedPermissions column to Users
        const checkExcludedResult = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'ExcludedPermissions'
        `);
        if (checkExcludedResult.recordset.length === 0) {
            console.log('Adding ExcludedPermissions column to Users table...');
            await pool.request().query('ALTER TABLE Users ADD ExcludedPermissions NVARCHAR(MAX) NULL');
            console.log('✅ Added ExcludedPermissions column');
        } else {
            console.log('ExcludedPermissions column already exists');
        }

        // Check and create UserBrandManagers table
        const checkTableResult = await pool.request().query(`
            SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserBrandManagers'
        `);
        if (checkTableResult.recordset.length === 0) {
            console.log('Creating UserBrandManagers table...');
            await pool.request().query(`
                CREATE TABLE UserBrandManagers (
                    UserId VARCHAR(24) NOT NULL,
                    BrandManagerId VARCHAR(24) NOT NULL,
                    PRIMARY KEY (UserId, BrandManagerId),
                    CONSTRAINT FK_UserBrandManagers_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
                    CONSTRAINT FK_UserBrandManagers_BrandManager FOREIGN KEY (BrandManagerId) REFERENCES Users(Id)
                )
            `);
            console.log('✅ Created UserBrandManagers table');
        } else {
            console.log('UserBrandManagers table already exists');
        }

        await pool.close();
        console.log('✨ Migration completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
