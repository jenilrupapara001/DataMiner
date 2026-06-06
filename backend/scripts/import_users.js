const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql, getPool, generateId } = require('../database/db');

async function importUsers() {
    console.log('Starting user import...');
    try {
        const pool = await getPool();

        // Read CSV
        const csvPath = '/Users/jenilrupapara/Downloads/Database_backup/emails-users.csv';
        const fileContent = fs.readFileSync(csvPath, 'utf8');
        
        const lines = fileContent.split('\n').filter(l => l.trim().length > 0);
        // Skip header
        lines.shift();
        
        const records = lines.map(line => {
            // regex to split by comma unless inside quotes
            const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
            const parts = [];
            let match;
            while ((match = regex.exec(line)) !== null) {
                parts.push(match[1].replace(/^"|"$/g, ''));
            }
            if(parts.length < 5) {
                 const rawParts = line.split(',');
                 return {
                     Email: rawParts[0],
                     FirstName: rawParts[1],
                     LastName: rawParts[2],
                     'Supervisor ID': rawParts.slice(3, rawParts.length - 1).join(',').replace(/^"|"$/g, ''),
                     'Role ID': rawParts[rawParts.length - 1]
                 };
            }
            return {
                Email: parts[0],
                FirstName: parts[1],
                LastName: parts[2],
                'Supervisor ID': parts[3],
                'Role ID': parts[4]
            };
        });

        console.log(`Found ${records.length} users to import/update.`);

        let insertedCount = 0;
        let updatedCount = 0;

        for (const record of records) {
            const email = record.Email.trim();
            const firstName = record.FirstName.trim();
            const lastName = record.LastName.trim();
            const password = email; // Password is the email itself
            const roleId = record['Role ID'] ? record['Role ID'].trim() : null;


            // Check if user already exists
            const existing = await pool.request()
                .input('email', sql.NVarChar, email)
                .query('SELECT Id FROM Users WHERE Email = @email');

            let userId;
            const hashedPassword = await bcrypt.hash(password, 12);

            if (existing.recordset.length > 0) {
                userId = existing.recordset[0].Id;
                // Update user
                await pool.request()
                    .input('id', sql.VarChar, userId)
                    .input('password', sql.NVarChar, hashedPassword)
                    .input('firstName', sql.NVarChar, firstName)
                    .input('lastName', sql.NVarChar, lastName)
                    .input('roleId', sql.VarChar, roleId)
                    .query(`
                        UPDATE Users 
                        SET Password = @password, FirstName = @firstName, LastName = @lastName, RoleId = @roleId, UpdatedAt = DATEADD(minute, 330, GETUTCDATE())
                        WHERE Id = @id
                    `);
                console.log(`Updated existing user: ${email}`);
                updatedCount++;
            } else {
                // Insert new user
                userId = generateId();
                
                await pool.request()
                    .input('id', sql.VarChar, userId)
                    .input('email', sql.NVarChar, email)
                    .input('password', sql.NVarChar, hashedPassword)
                    .input('firstName', sql.NVarChar, firstName)
                    .input('lastName', sql.NVarChar, lastName)
                    .input('roleId', sql.VarChar, roleId)
                    .query(`
                        INSERT INTO Users (Id, Email, Password, FirstName, LastName, RoleId, IsActive, CreatedAt, UpdatedAt) 
                        VALUES (@id, @email, @password, @firstName, @lastName, @roleId, 1, DATEADD(minute, 330, GETUTCDATE()), DATEADD(minute, 330, GETUTCDATE()))
                    `);
                
                console.log(`Inserted user: ${email}`);
                insertedCount++;
            }

            // Handle Supervisors
            const supervisorString = record['Supervisor ID'];
            if (supervisorString) {
                const supervisors = supervisorString.split(',').map(s => s.trim()).filter(Boolean);
                
                // Clear old supervisors for this user
                await pool.request()
                    .input('uid', sql.VarChar, userId)
                    .query('DELETE FROM UserSupervisors WHERE UserId = @uid');

                for (const supervisorId of supervisors) {
                    // Check if supervisor actually exists before inserting
                    const supCheck = await pool.request()
                        .input('sid', sql.VarChar, supervisorId)
                        .query('SELECT Id FROM Users WHERE Id = @sid');
                    
                    if (supCheck.recordset.length > 0) {
                        await pool.request()
                            .input('uid', sql.VarChar, userId)
                            .input('sid', sql.VarChar, supervisorId)
                            .query('INSERT INTO UserSupervisors (UserId, SupervisorId) VALUES (@uid, @sid)');
                        console.log(`  -> Assigned supervisor ${supervisorId} to ${email}`);
                    } else {
                        console.log(`  -> WARNING: Supervisor ID ${supervisorId} not found in DB. Skipping.`);
                    }
                }
            }
        }

        console.log(`\nImport complete! Inserted: ${insertedCount}, Updated: ${updatedCount}.`);
    } catch (err) {
        console.error('Failed to import users:', err);
    } finally {
        process.exit(0);
    }
}

importUsers();
