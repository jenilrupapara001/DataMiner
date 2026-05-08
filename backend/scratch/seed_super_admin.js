require('dotenv').config({ path: '/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/.env' });
const { sql, getPool, generateId } = require('../database/db');
const bcrypt = require('bcryptjs');

async function seedSuperAdmin() {
    try {
        console.log('🔄 Connecting to database...');
        const pool = await getPool();
        console.log('✅ Connected successfully!');

        // 1. Create or get "Super Admin" Role
        console.log('🔄 Checking/creating Super Admin role...');
        let roleId = 'role_super_admin';
        const roleResult = await pool.request()
            .input('name', 'super_admin')
            .query('SELECT Id FROM Roles WHERE Name = @name');

        if (roleResult.recordset.length > 0) {
            roleId = roleResult.recordset[0].Id;
            console.log(`✅ Super Admin role already exists with ID: ${roleId}`);
        } else {
            await pool.request()
                .input('id', roleId)
                .input('name', 'super_admin')
                .input('dn', 'Super Admin')
                .input('desc', 'Global system administrator with unrestricted read/write capabilities across all components.')
                .input('lvl', 100)
                .input('clr', '#EF4444')
                .query(`
                    INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
                    VALUES (@id, @name, @dn, @desc, @lvl, @clr, 1, 1, GETDATE(), GETDATE())
                `);
            console.log('✅ Created Super Admin role!');
        }

        // 2. Link all existing Permissions to Super Admin Role
        console.log('🔄 Linking all permissions to Super Admin role...');
        const allPermsResult = await pool.request().query('SELECT Id FROM Permissions');
        const allPermIds = allPermsResult.recordset.map(p => p.Id);

        const assignedResult = await pool.request()
            .input('roleId', roleId)
            .query('SELECT PermissionId FROM RolePermissions WHERE RoleId = @roleId');
        const assignedPermIds = new Set(assignedResult.recordset.map(rp => rp.PermissionId));

        let linkedCount = 0;
        for (const permId of allPermIds) {
            if (!assignedPermIds.has(permId)) {
                await pool.request()
                    .input('roleId', roleId)
                    .input('permId', permId)
                    .query('INSERT INTO RolePermissions (RoleId, PermissionId) VALUES (@roleId, @permId)');
                linkedCount++;
            }
        }
        console.log(`✅ Linked ${linkedCount} new permissions to Super Admin role (Total: ${allPermIds.length})`);

        // 3. Create or update Super Admin User
        const email = 'admin@gms.com';
        const rawPassword = 'Admin@123';
        const hashedPassword = await bcrypt.hash(rawPassword, 12);

        console.log(`🔄 Checking/creating user: ${email}...`);
        const userResult = await pool.request()
            .input('email', email)
            .query('SELECT Id FROM Users WHERE Email = @email');

        if (userResult.recordset.length > 0) {
            const userId = userResult.recordset[0].Id;
            await pool.request()
                .input('id', userId)
                .input('pw', hashedPassword)
                .input('roleId', roleId)
                .query(`
                    UPDATE Users 
                    SET Password = @pw, RoleId = @roleId, FirstName = 'Super', LastName = 'Admin', IsActive = 1, UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
            console.log(`✅ Updated existing Super Admin user with new password and role assignment!`);
        } else {
            const userId = generateId();
            await pool.request()
                .input('id', userId)
                .input('email', email)
                .input('pw', hashedPassword)
                .input('roleId', roleId)
                .query(`
                    INSERT INTO Users (Id, Email, Password, FirstName, LastName, RoleId, IsActive, CreatedAt, UpdatedAt)
                    VALUES (@id, @email, @pw, 'Super', 'Admin', @roleId, 1, GETDATE(), GETDATE())
                `);
            console.log(`✅ Created new Super Admin user successfully!`);
        }

        console.log('🎉 SUPER ADMIN ROLE AND USER SEEDED PERFECTLY!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to seed Super Admin role & user:', error);
        process.exit(1);
    }
}

seedSuperAdmin();
