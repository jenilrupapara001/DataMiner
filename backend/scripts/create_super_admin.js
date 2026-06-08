const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getPool, generateId } = require('../database/db');
const bcrypt = require('bcryptjs');

async function createSuperAdmin() {
    try {
        const pool = await getPool();
        
        // Ensure Super Admin role exists
        let roleId;
        const roleQuery = await pool.request().query("SELECT Id FROM Roles WHERE Name = 'Super Admin' OR Name = 'super_admin' OR Name = 'admin'");
        if (roleQuery.recordset.length > 0) {
            roleId = roleQuery.recordset[0].Id;
        } else {
            console.log("Super Admin role not found. Creating 'super_admin' role...");
            roleId = generateId();
            await pool.request().query(`INSERT INTO Roles (Id, Name, DisplayName, Description, Level, IsSystem, IsActive) VALUES ('${roleId}', 'super_admin', 'Super Admin', 'Full system access', 100, 1, 1)`);
        }

        const email = 'admin@gms.com';
        const password = 'Admin@123';
        
        // Check if user exists
        const userQuery = await pool.request().query(`SELECT Id FROM Users WHERE Email = '${email}'`);
        if (userQuery.recordset.length > 0) {
            console.log(`User ${email} already exists. Updating password and role...`);
            const hashedPassword = await bcrypt.hash(password, 12);
            await pool.request().query(`UPDATE Users SET Password = '${hashed}', RoleId = '${roleId}', IsActive = 1, IsEmailVerified = 1 WHERE Email = '${email}'`);
            console.log('✅ Super Admin updated successfully.');
        } else {
            const userId = generateId();
            const hashedPassword = await bcrypt.hash(password, 12);
            await pool.request().query(`
                INSERT INTO Users (Id, Email, Password, FirstName, LastName, RoleId, IsActive, IsEmailVerified, CreatedAt, UpdatedAt)
                VALUES ('${userId}', '${email}', '${hashedPassword}', 'Super', 'Admin', '${roleId}', 1, 1, dbo.GetEnvDate(), dbo.GetEnvDate())
            `);
            console.log('✅ Super Admin created successfully.');
        }
    } catch (err) {
        console.error('Error creating super admin:', err.message);
    } finally {
        process.exit(0);
    }
}

createSuperAdmin();
