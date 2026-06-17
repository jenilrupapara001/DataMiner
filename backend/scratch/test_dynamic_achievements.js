const { getPool, sql } = require('../database/db');
const targetController = require('../controllers/targetController');

async function testAchievements() {
    const pool = await getPool();
    console.log('Connected to SQL Server successfully.');

    // 1. Find some existing ADS targets
    console.log('Retrieving some GmsTargets of GoalType = ADS for sellers with data...');
    const targetResult = await pool.request().query(`
        SELECT TOP 5 t.Id, t.SellerId, t.TargetType, t.Year, t.Month, t.TotalTargetValue, t.GoalType
        FROM GmsTargets t
        WHERE t.GoalType = 'ADS' AND t.SellerId IN ('69ea92e64c286d8c1ad6f200', '8f828dad9e1d4768a30ec92c', 'c55ff48848e6497abb2bc0d7')
    `);
    const targets = targetResult.recordset;

    if (targets.length === 0) {
        console.log('No GmsTargets with GoalType = ADS found in database.');
        // Let's look at any other targets
        const anyTargetResult = await pool.request().query(`
            SELECT TOP 5 t.Id, t.SellerId, t.TargetType, t.Year, t.Month, t.TotalTargetValue, t.GoalType
            FROM GmsTargets t
        `);
        console.log('Any GmsTargets in database:', anyTargetResult.recordset);
        return;
    }

    console.log(`Found ${targets.length} ADS target(s):`);
    console.table(targets);

    // Let's run the targetController getTargets mock request
    console.log('Calling getTargets controller function...');
    
    // We mock req and res
    const req = {
        user: {
            role: { name: 'admin' }, // bypass row limits
            assignedSellers: []
        }
    };

    let responseData = null;
    const res = {
        json: (data) => {
            responseData = data;
        },
        status: (code) => {
            return {
                json: (data) => {
                    console.error(`Status code ${code}:`, data);
                }
            };
        }
    };

    await targetController.getTargets(req, res);

    if (!responseData || !responseData.success) {
        console.error('Failed to get targets from controller:', responseData);
        return;
    }

    console.log(`Successfully retrieved ${responseData.data.length} enriched targets from controller.`);

    // Find the retrieved targets that are of type ADS
    const adsTargets = responseData.data.filter(t => t.GoalType === 'ADS');
    console.log(`Found ${adsTargets.length} enriched ADS targets.`);

    for (const target of adsTargets) {
        console.log(`\n--- Target ID: ${target.Id} for Seller: ${target.SellerId} (${target.Year} / TargetType: ${target.TargetType}) ---`);
        console.log(`Total Target Value: ${target.TotalTargetValue}, Overall Achieved Value (calculated): ${target.overallAchieved}`);
        
        console.log('Monthly Breakdown Achievements:');
        target.monthlyBreakdown.forEach(b => {
            console.log(`  Month: ${b.PeriodValue} | Target: ${b.TargetValue} | Achieved (Calculated): ${b.AchievedValue}`);
        });

        // Let's verify with a manual direct query to AdsPerformance for months 4 and 5
        for (const monthItem of target.monthlyBreakdown) {
            const monthVal = monthItem.PeriodValue;
            if (monthVal !== 4 && monthVal !== 5) continue; // Only check April and May

            const startStr = `${target.Year}-${String(monthVal).padStart(2, '0')}-01`;
            const endMonthDate = new Date(target.Year, monthVal, 0); // last day of month
            const endStr = `${target.Year}-${String(monthVal).padStart(2, '0')}-${String(endMonthDate.getDate()).padStart(2, '0')}`;

            console.log(`Manual verification query for Month ${monthVal} (${startStr} to ${endStr}):`);
            const manualQuery = `
                SELECT SUM(ISNULL(p.AdSpend, 0)) as manualAdSpend
                FROM Asins a
                INNER JOIN AdsPerformance p ON a.AsinCode = p.Asin
                INNER JOIN Sellers s ON a.SellerId = s.Id
                WHERE s.Id = @sellerId
                  AND p.Date >= @start
                  AND p.Date <= @end
            `;
            const verifyResult = await pool.request()
                .input('sellerId', sql.NVarChar, target.SellerId)
                .input('start', sql.Date, startStr)
                .input('end', sql.Date, endStr)
                .query(manualQuery);
            
            const manualAdSpend = parseFloat(verifyResult.recordset[0]?.manualAdSpend || 0);
            console.log(`  -> Live AdSpend sum in AdsPerformance: ${manualAdSpend}`);
            console.log(`  -> Controller Monthly Breakdown Achieved: ${monthItem.AchievedValue}`);
            if (Math.abs(monthItem.AchievedValue - manualAdSpend) < 0.01) {
                console.log('  ✅ MATCH! The dynamic calculation works perfectly!');
            } else {
                console.log('  ❌ MISMATCH! Check logic.');
            }
        }
    }
}

testAchievements()
    .then(() => process.exit(0))
    .catch(e => {
        console.error('Test script crashed:', e);
        process.exit(1);
    });
