const { getPool } = require('../backend/database/db');

async function test() {
    try {
        const pool = await getPool();
        console.log('Connected to database successfully.');
        
        // 1. Test querying Asins
        console.log('Querying Asins...');
        const asinRes = await pool.request()
            .input('id', '7e78eebe3e46471897fe9362')
            .query('SELECT Id, AsinCode, Tags FROM Asins WHERE Id = @id');
        console.log('Asin result:', asinRes.recordset);
        
        // 2. Test querying TagsHistory count
        console.log('Querying TagsHistory...');
        const countRes = await pool.request()
            .input('asinId', '7e78eebe3e46471897fe9362')
            .query('SELECT COUNT(*) as total FROM TagsHistory WHERE AsinId = @asinId');
        console.log('TagsHistory total:', countRes.recordset);

        // 3. Test querying TagsHistory rows
        const historyRes = await pool.request()
            .input('asinId', '7e78eebe3e46471897fe9362')
            .query('SELECT * FROM TagsHistory WHERE AsinId = @asinId');
        console.log('TagsHistory rows:', historyRes.recordset);
        
        console.log('All queries passed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Test query failed:', err);
        process.exit(1);
    }
}

test();
