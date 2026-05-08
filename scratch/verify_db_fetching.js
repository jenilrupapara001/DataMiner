const { getPool } = require('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/database/db');

async function testFetch() {
    try {
        console.log('🔄 Connecting to database...');
        const pool = await getPool();
        console.log('✅ Connected successfully!');

        console.log('\n--- Testing Actions Query ---');
        const actionsResult = await pool.request().query(`
            SELECT TOP 5 a.*,
                   ua.FirstName as assignedToFirstName, ua.LastName as assignedToLastName, ua.Email as assignedToEmail,
                   uc.FirstName as createdByFirstName, uc.LastName as createdByLastName,
                   s.Name as sellerName, s.Marketplace as sellerMarketplace
            FROM Actions a
            LEFT JOIN Users ua ON a.AssignedTo = ua.Id
            LEFT JOIN Users uc ON a.CreatedBy = uc.Id
            LEFT JOIN Sellers s ON a.SellerId = s.Id
            ORDER BY a.CreatedAt DESC
        `);
        console.log(`✅ Success! Fetched ${actionsResult.recordset.length} actions.`);
        if (actionsResult.recordset.length > 0) {
            console.log('Sample Action:', JSON.stringify(actionsResult.recordset[0], null, 2));
        }

        console.log('\n--- Testing TaskTemplates Query ---');
        const templatesResult = await pool.request().query('SELECT TOP 5 * FROM TaskTemplates ORDER BY Category, Title');
        console.log(`✅ Success! Fetched ${templatesResult.recordset.length} templates.`);

        console.log('\n--- Testing Users Query ---');
        const usersResult = await pool.request().query('SELECT TOP 5 Id, FirstName, LastName, Email, RoleId FROM Users');
        console.log(`✅ Success! Fetched ${usersResult.recordset.length} users.`);

        console.log('\n🎉 ALL DATABASE TEST QUERIES EXECUTED SUCCESSFULLY WITHOUT ANY ERRORS!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database Query Test Failed:', error);
        process.exit(1);
    }
}

testFetch();
