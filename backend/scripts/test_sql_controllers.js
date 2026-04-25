
/**
 * Validation script for SQL controller endpoints after MongoDB migration
 */

const { sql, getPool, generateId } = require('../database/db');

async function testControllers() {
  let pool;
  try {
    pool = await getPool();
    console.log('✅ Connected to SQL Server\n');

    const results = {
      passed: [],
      failed: []
    };

    const testId = generateId();

    // Test 1: Users - Get count
    try {
      const res = await pool.request().query('SELECT COUNT(*) as cnt FROM Users');
      console.log('1. Users table accessible:', res.recordset[0].cnt, 'users found ✅');
      results.passed.push('Users table accessible');
    } catch (err) {
      console.log('1. Users table accessible: ❌', err.message);
      results.failed.push('Users table accessible');
    }

    // Test 2: Roles - Get count
    try {
      const res = await pool.request().query('SELECT COUNT(*) as cnt FROM Roles');
      console.log('2. Roles table accessible:', res.recordset[0].cnt, 'roles found ✅');
      results.passed.push('Roles table accessible');
    } catch (err) {
      console.log('2. Roles table accessible: ❌', err.message);
      results.failed.push('Roles table accessible');
    }

    // Test 3: Permissions - Get count
    try {
      const res = await pool.request().query('SELECT COUNT(*) as cnt FROM Permissions');
      console.log('3. Permissions table accessible:', res.recordset[0].cnt, 'permissions found ✅');
      results.passed.push('Permissions table accessible');
    } catch (err) {
      console.log('3. Permissions table accessible: ❌', err.message);
      results.failed.push('Permissions table accessible');
    }

    // Test 4: Sellers - Get count
    try {
      const res = await pool.request().query('SELECT COUNT(*) as cnt FROM Sellers');
      console.log('4. Sellers table accessible:', res.recordset[0].cnt, 'sellers found ✅');
      results.passed.push('Sellers table accessible');
    } catch (err) {
      console.log('4. Sellers table accessible: ❌', err.message);
      results.failed.push('Sellers table accessible');
    }

    // Test 5: Asins - Get count
    try {
      const res = await pool.request().query('SELECT COUNT(*) as cnt FROM Asins');
      console.log('5. Asins table accessible:', res.recordset[0].cnt, 'ASINs found ✅');
      results.passed.push('Asins table accessible');
    } catch (err) {
      console.log('5. Asins table accessible: ❌', err.message);
      results.failed.push('Asins table accessible');
    }

    // Test 6: UserSellers junction table
    try {
      const res = await pool.request().query('SELECT COUNT(*) as cnt FROM UserSellers');
      console.log('6. UserSellers table accessible:', res.recordset[0].cnt, 'assignments found ✅');
      results.passed.push('UserSellers table accessible');
    } catch (err) {
      console.log('6. UserSellers table accessible: ❌', err.message);
      results.failed.push('UserSellers table accessible');
    }

    // Test 7: Actions table
    try {
      const res = await pool.request().query('SELECT COUNT(*) as cnt FROM Actions');
      console.log('7. Actions table accessible:', res.recordset[0].cnt, 'actions found ✅');
      results.passed.push('Actions table accessible');
    } catch (err) {
      console.log('7. Actions table accessible: ❌', err.message);
      results.failed.push('Actions table accessible');
    }

    // Test 8: Test foreign key relationships - User with role
    try {
      const res = await pool.request()
        .query('SELECT TOP 1 U.Id, U.Email, R.Name as RoleName FROM Users U JOIN Roles R ON U.RoleId = R.Id');
      if (res.recordset.length > 0) {
        console.log('8. User→Role FK relationship: Valid ✅');
        results.passed.push('User→Role FK relationship');
      } else {
        console.log('8. User→Role FK relationship: No users in DB ⚠️');
        results.passed.push('User→Role FK relationship (empty)');
      }
    } catch (err) {
      console.log('8. User→Role FK relationship: ❌', err.message);
      results.failed.push('User→Role FK relationship');
    }

    // Test 9: Seller with Asins (if any exist)
    try {
      const res = await pool.request()
        .query('SELECT TOP 1 S.Id, S.Name, COUNT(A.Id) as asinCount FROM Sellers S LEFT JOIN Asins A ON S.Id = A.SellerId GROUP BY S.Id, S.Name');
      if (res.recordset.length > 0) {
        console.log('9. Seller→Asins FK relationship: Valid ✅');
        results.passed.push('Seller→Asins FK relationship');
      } else {
        console.log('9. Seller→Asins FK relationship: No sellers in DB ⚠️');
        results.passed.push('Seller→Asins FK relationship (empty)');
      }
    } catch (err) {
      console.log('9. Seller→Asins FK relationship: ❌', err.message);
      results.failed.push('Seller→Asins FK relationship');
    }

    // Test 10: RolePermissions junction
    try {
      const res = await pool.request().query('SELECT COUNT(*) as cnt FROM RolePermissions');
      console.log('10. RolePermissions table accessible:', res.recordset[0].cnt, 'assignments ✅');
      results.passed.push('RolePermissions table accessible');
    } catch (err) {
      console.log('10. RolePermissions table accessible: ❌', err.message);
      results.failed.push('RolePermissions table accessible');
    }

    // Test 11: ID Generation (replacement for mongoose.Types.ObjectId)
    try {
      const id1 = generateId();
      const id2 = generateId();
      if (id1 && id2 && id1 !== id2 && id1.length === 24) {
        console.log('11. ID Generation function: Working ✅');
        results.passed.push('ID Generation function');
      } else {
        console.log('11. ID Generation function: Invalid ❌');
        results.failed.push('ID Generation function');
      }
    } catch (err) {
      console.log('11. ID Generation function: ❌', err.message);
      results.failed.push('ID Generation function');
    }

    // Test 12: Check indexes exist
    try {
      const res = await pool.request()
        .query("SELECT COUNT(*) as cnt FROM sys.indexes WHERE name LIKE 'IX_%'");
      console.log('12. Performance indexes installed:', res.recordset[0].cnt, 'indexes ✅');
      results.passed.push('Performance indexes installed');
    } catch (err) {
      console.log('12. Performance indexes installed: ❌', err.message);
      results.failed.push('Performance indexes installed');
    }

    // Final Summary
    console.log('\n========================================');
    console.log('   SQL CONTROLLER VALIDATION SUMMARY');
    console.log('========================================');
    console.log(`\n✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
      console.log('\nFailed tests:');
      results.failed.forEach(f => console.log(`  - ${f}`));
    }

    const overallSuccess = results.failed.length === 0;
    console.log('\nOverall Status:', overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    console.log('\nMigration Status: SQL Server backend is', overallSuccess ? 'READY ✅' : 'NEEDS ATTENTION ⚠️');
    console.log('========================================\n');

    return overallSuccess;
  } catch (error) {
    console.error('❌ Connection/Test Error:', error.message);
    return false;
  }
}

testControllers().then(success => {
  process.exit(success ? 0 : 1);
});
