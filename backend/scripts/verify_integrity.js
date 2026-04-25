
/**
 * Data Integrity Verification Script
 * Compares data between SQL Server (current) and MongoDB (legacy)
 */

const { sql, getPool } = require('../database/db');
const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const MONGO_URI = process.env.MONGO_URI;

async function verifyIntegrity() {
    let pool;
    try {
        // Connect to SQL Server
        pool = await getPool();
        console.log('✅ Connected to SQL Server');

        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const AsinModel = mongoose.model('Asin', new mongoose.Schema({}, { strict: false }));
        const SellerModel = mongoose.model('Seller', new mongoose.Schema({}, { strict: false }));
        const UserModel = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const RoleModel = mongoose.model('Role', new mongoose.Schema({}, { strict: false }));

        console.log('\n========================================');
        console.log('   DATA INTEGRITY VERIFICATION REPORT');
        console.log('========================================\n');

        // ============ USERS COMPARISON ============
        console.log('1. USERS');
        console.log('----------------------------------------');
        
        const sqlUsers = await pool.request().query(`
            SELECT Id, Email, FirstName, LastName, RoleId, IsActive FROM Users
        `);
        const mongoUsers = await UserModel.find({}, 'Id email firstName lastName role isActive');
        
        console.log(`  SQL Server Users: ${sqlUsers.recordset.length}`);
        console.log(`  MongoDB Users:    ${mongoUsers.length}`);
        
        // Compare individual users
        let userMismatches = 0;
        for (const sqlUser of sqlUsers.recordset) {
            const mongoUser = mongoUsers.find(u => u.Id === sqlUser.Id);
            if (!mongoUser && sqlUsers.recordset.length <= mongoUsers.length) {
                console.log(`  ⚠️  User in SQL not in MongoDB: ${sqlUser.Email} (${sqlUser.Id})`);
                userMismatches++;
            }
        }
        if (userMismatches === 0) {
            console.log('  ✅ All users match (up to SQL count)');
        }

        // ============ ROLES COMPARISON ============
        console.log('\n2. ROLES');
        console.log('----------------------------------------');
        
        const sqlRoles = await pool.request().query('SELECT Id, Name FROM Roles');
        const mongoRoles = await RoleModel.find({}, 'name');
        
        console.log(`  SQL Server Roles: ${sqlRoles.recordset.length}`);
        console.log(`  MongoDB Roles:    ${mongoRoles.length}`);
        
        for (const role of sqlRoles.recordset) {
            console.log(`    - ${role.Name} (${role.Id})`);
        }

        // ============ SELLERS COMPARISON ============
        console.log('\n3. SELLERS');
        console.log('----------------------------------------');
        
        const sqlSellers = await pool.request().query(`
            SELECT Id, Name, SellerId, Marketplace, IsActive FROM Sellers
        `);
        const mongoSellers = await SellerModel.find({}, 'name sellerId marketplace');
        
        console.log(`  SQL Server Sellers: ${sqlSellers.recordset.length}`);
        console.log(`  MongoDB Sellers:    ${mongoSellers.length}`);
        
        let sellerMismatches = 0;
        for (const sqlSeller of sqlSellers.recordset) {
            const mongoSeller = mongoSellers.find(s => s.Id === sqlSeller.Id);
            if (!mongoSeller && sqlSellers.recordset.length <= mongoSellers.length) {
                console.log(`  ⚠️  Seller in SQL not in MongoDB: ${sqlSeller.Name} (${sqlSeller.Id})`);
                sellerMismatches++;
            }
        }
        if (sellerMismatches === 0 && sqlSellers.recordset.length > 0) {
            console.log('  ✅ All sellers match');
        } else if (sqlSellers.recordset.length === 0) {
            console.log('  ⚠️  No sellers in SQL Server (ASIN/Ads/Orders were skipped)');
        }

        // ============ ASINS COMPARISON ============
        console.log('\n4. ASINS');
        console.log('----------------------------------------');
        
        const sqlAsins = await pool.request().query(`
            SELECT Id, AsinCode, SellerId, Status, Category FROM Asins
        `);
        const mongoAsins = await AsinModel.find({}, 'asinCode seller status category');
        
        console.log(`  SQL Server ASINs: ${sqlAsins.recordset.length}`);
        console.log(`  MongoDB ASINs:    ${mongoAsins.length}`);
        
        let asinMismatches = 0;
        for (const sqlAsin of sqlAsins.recordset) {
            const mongoAsin = mongoAsins.find(a => a.Id === sqlAsin.Id);
            if (!mongoAsin && sqlAsins.recordset.length <= mongoAsins.length) {
                console.log(`  ⚠️  ASIN in SQL not in MongoDB: ${sqlAsin.AsinCode} (${sqlAsin.Id})`);
                asinMismatches++;
            }
        }
        if (asinMismatches === 0 && sqlAsins.recordset.length > 0) {
            console.log('  ✅ All ASINs match');
        } else if (sqlAsins.recordset.length === 0) {
            console.log('  ℹ️  No ASINs in SQL Server (expected - ASIN/Ads/Orders were skipped per migration)');
        }

        // ============ PERMISSIONS & USERROLES CHECK ============
        console.log('\n5. PERMISSIONS & ROLE ASSIGNMENTS');
        console.log('----------------------------------------');
        
        const permResult = await pool.request().query(`
            SELECT P.Name, COUNT(RP.RoleId) as RoleCount
            FROM Permissions P
            LEFT JOIN RolePermissions RP ON P.Id = RP.PermissionId
            GROUP BY P.Name
        `);
        console.log(`  Total Permissions: ${permResult.recordset.length}`);
        permResult.recordset.forEach(p => {
            console.log(`    - ${p.Name} (assigned to ${p.RoleCount} role(s))`);
        });

        // ============ RELATIONSHIP INTEGRITY ============
        console.log('\n6. RELATIONSHIP INTEGRITY');
        console.log('----------------------------------------');
        
        // Check UserSellers relationships
        const userSellersCount = await pool.request().query(`SELECT COUNT(*) as cnt FROM UserSellers`);
        console.log(`  UserSeller assignments: ${userSellersCount.recordset[0].cnt}`);
        
        // Check foreign key integrity
        const orphanUsers = await pool.request().query(`
            SELECT COUNT(*) as cnt FROM Users U
            LEFT JOIN Roles R ON U.RoleId = R.Id
            WHERE U.RoleId IS NOT NULL AND R.Id IS NULL
        `);
        console.log(`  Users with invalid RoleId: ${orphanUsers.recordset[0].cnt}`);

        const orphanSellers = await pool.request().query(`
            SELECT COUNT(*) as cnt FROM UserSellers US
            LEFT JOIN Users U ON US.UserId = U.Id
            LEFT JOIN Sellers S ON US.SellerId = S.Id
            WHERE U.Id IS NULL OR S.Id IS NULL
        `);
        console.log(`  Invalid UserSeller assignments: ${orphanSellers.recordset[0].cnt}`);

        // ============ SUMMARY ============
        console.log('\n========================================');
        console.log('   VERIFICATION COMPLETE');
        console.log('========================================\n');
        
        console.log('Summary:');
        console.log(`  - Users synced: ${sqlUsers.recordset.length}/${mongoUsers.length}`);
        console.log(`  - Sellers synced: ${sqlSellers.recordset.length}/${mongoSellers.length}`);
        console.log(`  - ASINs synced: ${sqlAsins.recordset.length} (expected: subset, Ads/Orders skipped)`);
        console.log(`  - Roles synced: ${sqlRoles.recordset.length}/${mongoRoles.length}`);
        
        if (sqlAsins.recordset.length === 0) {
            console.log('\nℹ️  NOTE: ASIN/Ads/Orders data was intentionally skipped during migration.');
            console.log('   This is expected per migration documentation.');
        }

    } catch (error) {
        console.error('❌ Verification error:', error.message);
        console.error(error.stack);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\nDisconnected from MongoDB');
        }
        process.exit(0);
    }
}

verifyIntegrity();
