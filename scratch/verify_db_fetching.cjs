const { getPool } = require('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/database/db');

async function testFetch() {
    try {
        console.log('🔄 Connecting to database...');
        const pool = await getPool();
        console.log('✅ Connected successfully!');

        console.log('\n--- Ensuring TaskTemplates and GoalTemplates Tables Exist ---');
        await pool.request().query(`
            IF OBJECT_ID(N'dbo.TaskTemplates', N'U') IS NULL
            BEGIN
                CREATE TABLE TaskTemplates (
                    Id VARCHAR(24) PRIMARY KEY,
                    Title NVARCHAR(255) NOT NULL,
                    Description NVARCHAR(MAX),
                    Category NVARCHAR(100) DEFAULT 'GENERAL',
                    Priority NVARCHAR(50) DEFAULT 'MEDIUM',
                    Type NVARCHAR(100),
                    TimeLimit INT DEFAULT 60,
                    IsActive BIT DEFAULT 1,
                    CreatedAt DATETIME2 DEFAULT GETDATE(),
                    UpdatedAt DATETIME2 DEFAULT GETDATE()
                );
                CREATE INDEX IX_TaskTemplates_Category ON TaskTemplates(Category);
                CREATE INDEX IX_TaskTemplates_IsActive ON TaskTemplates(IsActive);
                PRINT 'Created TaskTemplates';
            END

            IF OBJECT_ID(N'dbo.GoalTemplates', N'U') IS NULL
            BEGIN
                CREATE TABLE GoalTemplates (
                    Id VARCHAR(24) PRIMARY KEY,
                    Name NVARCHAR(255) NOT NULL,
                    Description NVARCHAR(MAX),
                    OwnerId VARCHAR(24),
                    CreatedAt DATETIME2 DEFAULT GETDATE(),
                    UpdatedAt DATETIME2 DEFAULT GETDATE(),
                    CONSTRAINT FK_GoalTemplates_Owner FOREIGN KEY (OwnerId) REFERENCES Users(Id)
                );
                CREATE INDEX IX_GoalTemplates_OwnerId ON GoalTemplates(OwnerId);
                PRINT 'Created GoalTemplates';
            END
        `);
        console.log('✅ Required tables verified/created successfully.');

        console.log('\n--- Listing All Available Tables ---');
        const tablesResult = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);
        const tables = tablesResult.recordset.map(t => t.TABLE_NAME);
        console.log('Tables:', tables.join(', '));

        console.log('\n--- Querying Users Table ---');
        if (tables.includes('Users')) {
            const usersResult = await pool.request().query('SELECT TOP 5 Id, FirstName, LastName, Email, RoleId FROM Users');
            console.log(`✅ Success! Fetched ${usersResult.recordset.length} users.`);
            if (usersResult.recordset.length > 0) {
                console.log('Sample User:', JSON.stringify(usersResult.recordset[0], null, 2));
            }
        } else {
            console.log('❌ Users table does not exist.');
        }

        console.log('\n--- Querying Actions Table ---');
        if (tables.includes('Actions')) {
            const actionsResult = await pool.request().query(`
                SELECT TOP 5 a.*,
                       ua.FirstName as assignedToFirstName, ua.LastName as assignedToLastName, ua.Email as assignedToEmail,
                       uc.FirstName as createdByFirstName, uc.LastName as createdByLastName
                FROM Actions a
                LEFT JOIN Users ua ON a.AssignedTo = ua.Id
                LEFT JOIN Users uc ON a.CreatedBy = uc.Id
                ORDER BY a.CreatedAt DESC
            `);
            console.log(`✅ Success! Fetched ${actionsResult.recordset.length} actions.`);
            if (actionsResult.recordset.length > 0) {
                console.log('Sample Action:', JSON.stringify(actionsResult.recordset[0], null, 2));
            }
        } else {
            console.log('❌ Actions table does not exist.');
        }

        console.log('\n--- Querying TaskTemplates Table ---');
        if (tables.includes('TaskTemplates')) {
            const templatesResult = await pool.request().query('SELECT TOP 5 * FROM TaskTemplates');
            console.log(`✅ Success! Fetched ${templatesResult.recordset.length} task templates.`);
        } else {
            console.log('❌ TaskTemplates table does not exist.');
        }

        console.log('\n🎉 DATABASE DIAGNOSTICS COMPLETED SUCCESSFULLY!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database Diagnostics Failed:', error);
        process.exit(1);
    }
}

testFetch();
