const { getPool } = require('../database/db');

async function main() {
    const pool = await getPool();

    console.log('--- sample GmsTargets SellerIds ---');
    const targets = await pool.request().query('SELECT TOP 10 Id, SellerId, GoalType, TargetType, Year FROM GmsTargets');
    console.log(targets.recordset);

    console.log('--- checking if GmsTargets.SellerId matches Sellers.Id ---');
    const matchId = await pool.request().query(`
        SELECT DISTINCT TOP 5 t.SellerId as targetSellerId, s.Id as sellerId, s.SellerId as sellerCode, s.Name
        FROM GmsTargets t
        INNER JOIN Sellers s ON t.SellerId = s.Id
    `);
    console.log('Matches by Sellers.Id:', matchId.recordset);

    console.log('--- checking if GmsTargets.SellerId matches Sellers.SellerId ---');
    const matchCode = await pool.request().query(`
        SELECT DISTINCT TOP 5 t.SellerId as targetSellerId, s.Id as sellerId, s.SellerId as sellerCode, s.Name
        FROM GmsTargets t
        INNER JOIN Sellers s ON t.SellerId = s.SellerId
    `);
    console.log('Matches by Sellers.SellerId:', matchCode.recordset);
}

main().catch(console.error);
