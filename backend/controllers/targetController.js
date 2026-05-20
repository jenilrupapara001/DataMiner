const { getPool, sql, generateId } = require('../database/db');
const { endOfMonth, startOfMonth, format, addDays } = require('date-fns');

// Helper to calculate start and end dates for a specific month
function getMonthRange(year, month) {
    const start = new Date(year, month - 1, 1);
    const end = endOfMonth(start);
    return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd')
    };
}

// Helper to calculate start and end dates for weeks of a month
function getWeekRange(year, month, weekNumber) {
    const startMonth = new Date(year, month - 1, 1);
    const lastDay = endOfMonth(startMonth).getDate();
    
    let startDay, endDay;
    if (weekNumber === 1) { startDay = 1; endDay = 7; }
    else if (weekNumber === 2) { startDay = 8; endDay = 14; }
    else if (weekNumber === 3) { startDay = 15; endDay = 21; }
    else if (weekNumber === 4) { startDay = 22; endDay = 28; }
    else { startDay = 29; endDay = lastDay; }

    const start = new Date(year, month - 1, startDay);
    const end = new Date(year, month - 1, endDay);
    
    return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd')
    };
}

/**
 * Get all targets with achievements merged dynamically
 */
exports.getTargets = async (req, res) => {
    try {
        const pool = await getPool();
        
        // 1. Fetch main target records with GoalType and SellerName
        const userRole = req.user?.role?.name || req.user?.role || '';
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        
        let whereClause = 'WHERE 1=1';
        const request = pool.request();

        if (!isGlobalUser && req.user) {
            const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s.Id || s).toString());
            const bmName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
            const bmId = req.user.Id || req.user._id;

            const orParts = [];
            if (assignedSellerIds.length > 0) {
                const params = assignedSellerIds.map((id, i) => {
                    request.input(`sid_${i}`, sql.VarChar, id);
                    return `@sid_${i}`;
                });
                orParts.push(`t.SellerId IN (${params.join(',')})`);
            }
            if (bmName) {
                request.input('bmName', sql.NVarChar, bmName);
                orParts.push(`t.BrandManager = @bmName`);
            }
            if (orParts.length > 0) {
                whereClause += ` AND (${orParts.join(' OR ')})`;
            }
        }

        const targetsQuery = `
            SELECT 
                t.Id, t.SellerId, t.BrandManager, t.TargetType, t.Year, t.Month, t.TotalTargetValue, t.GoalType, t.CreatedAt,
                s.Name AS SellerName
            FROM GmsTargets t
            LEFT JOIN Sellers s ON t.SellerId = s.Id
            ${whereClause}
            ORDER BY t.CreatedAt DESC
        `;
        const targetsResult = await request.query(targetsQuery);
        const targets = targetsResult.recordset;

        if (targets.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // 2. Fetch all breakdowns for all these targets in a single query
        const targetIds = targets.map(t => t.Id);
        const targetIdsPlaceholders = targetIds.map((id, idx) => `@tId_${idx}`);
        const breakdownsRequest = pool.request();
        targetIds.forEach((id, idx) => {
            breakdownsRequest.input(`tId_${idx}`, sql.VarChar, id);
        });

        const breakdownsResult = await breakdownsRequest.query(`
            SELECT 
                Id, TargetId, PeriodType, PeriodValue, SpecificDate, TargetValue, AchievedValue, PercentageContribution
            FROM GmsTargetBreakdowns
            WHERE TargetId IN (${targetIdsPlaceholders.join(',')})
            ORDER BY PeriodType, PeriodValue
        `);
        const allBreakdowns = breakdownsResult.recordset;

        // Group breakdowns by targetId in memory
        const breakdownsByTarget = {};
        allBreakdowns.forEach(b => {
            if (!breakdownsByTarget[b.TargetId]) {
                breakdownsByTarget[b.TargetId] = [];
            }
            breakdownsByTarget[b.TargetId].push(b);
        });

        // 3. Fetch all daily advertising and organic stats for the relevant target sellers and years in a single grouped query
        const sellerIds = [...new Set(targets.map(t => t.SellerId))];
        const minYear = Math.min(...targets.map(t => t.Year));
        const maxYear = Math.max(...targets.map(t => t.Year));

        const dailyStats = {};
        if (sellerIds.length > 0) {
            const statsRequest = pool.request();
            const sellerParams = [];
            sellerIds.forEach((id, idx) => {
                statsRequest.input(`sId_${idx}`, sql.NVarChar, id);
                sellerParams.push(`@sId_${idx}`);
            });
            statsRequest.input('minDate', sql.Date, `${minYear}-01-01`);
            statsRequest.input('maxDate', sql.Date, `${maxYear}-12-31`);

            const dailyQuery = `
                SELECT a.SellerId, p.Date,
                       SUM(ISNULL(p.AdSpend, 0)) as AdSpend,
                       SUM(ISNULL(p.AdSales, 0)) as AdSales,
                       SUM(ISNULL(p.OrganicSales, 0)) as OrganicSales
                FROM Asins a
                INNER JOIN AdsPerformance p ON a.AsinCode = p.Asin
                WHERE a.SellerId IN (${sellerParams.join(',')})
                  AND p.Date >= @minDate AND p.Date <= @maxDate
                GROUP BY a.SellerId, p.Date
            `;
            const dailyResult = await statsRequest.query(dailyQuery);

            dailyResult.recordset.forEach(row => {
                const sId = row.SellerId;
                if (row.Date) {
                    const dateStr = format(new Date(row.Date), 'yyyy-MM-dd');
                    if (!dailyStats[sId]) dailyStats[sId] = {};
                    dailyStats[sId][dateStr] = {
                        adSpend: parseFloat(row.AdSpend || 0),
                        adSales: parseFloat(row.AdSales || 0),
                        organicSales: parseFloat(row.OrganicSales || 0)
                    };
                }
            });
        }

        // Helper to calculate dynamic achievement from in-memory dailyStats
        const calculateAchievementInMemory = (sellerId, startDateStr, endDateStr, goalType) => {
            const sellerData = dailyStats[sellerId];
            if (!sellerData) return 0;

            let totalAdSpend = 0;
            let totalAdSales = 0;
            let totalOrganicSales = 0;

            let curr = new Date(startDateStr);
            const end = new Date(endDateStr);

            while (curr <= end) {
                const dateStr = format(curr, 'yyyy-MM-dd');
                const stats = sellerData[dateStr];
                if (stats) {
                    totalAdSpend += stats.adSpend;
                    totalAdSales += stats.adSales;
                    totalOrganicSales += stats.organicSales;
                }
                curr = addDays(curr, 1);
            }

            if (goalType === 'ADS') {
                return totalAdSpend;
            } else if (goalType === 'ACOS') {
                return totalAdSales > 0 ? (totalAdSpend / totalAdSales) * 100 : 0;
            } else {
                return totalAdSales + totalOrganicSales;
            }
        };

        const calculateDayAchievementInMemory = (sellerId, dateStr, goalType) => {
            const sellerData = dailyStats[sellerId];
            if (!sellerData) return 0;

            const stats = sellerData[dateStr];
            if (!stats) return 0;

            if (goalType === 'ADS') {
                return stats.adSpend;
            } else if (goalType === 'ACOS') {
                return stats.adSales > 0 ? (stats.adSpend / stats.adSales) * 100 : 0;
            } else {
                return stats.adSales + stats.organicSales;
            }
        };

        const enrichedTargets = [];

        for (const target of targets) {
            const { Id: targetId, SellerId: sellerId, TargetType: targetType, Year: year, Month: targetMonth, GoalType: goalType } = target;
            const breakdowns = breakdownsByTarget[targetId] || [];

            const monthlyBreakdown = breakdowns.filter(b => b.PeriodType === 'MONTH');
            const weeklyBreakdown = breakdowns.filter(b => b.PeriodType === 'WEEK');
            const dailyBreakdown = breakdowns.filter(b => b.PeriodType === 'DAY');

            // Dynamic calculation for Month level achievements
            for (const monthItem of monthlyBreakdown) {
                if (monthItem.AchievedValue === null) {
                    const { startDate, endDate } = getMonthRange(year, monthItem.PeriodValue);
                    monthItem.AchievedValue = calculateAchievementInMemory(sellerId, startDate, endDate, goalType);
                }
            }

            // Dynamic calculation for Week level achievements
            for (const weekItem of weeklyBreakdown) {
                if (weekItem.AchievedValue === null) {
                    const actualMonth = targetType === 'MONTHLY' ? targetMonth : Math.floor(weekItem.PeriodValue / 10);
                    const actualWeek = targetType === 'MONTHLY' ? weekItem.PeriodValue : (weekItem.PeriodValue % 10);
                    const { startDate, endDate } = getWeekRange(year, actualMonth, actualWeek);
                    weekItem.AchievedValue = calculateAchievementInMemory(sellerId, startDate, endDate, goalType);
                }
            }

            // Dynamic calculation for Day level achievements
            for (const dayItem of dailyBreakdown) {
                if (dayItem.AchievedValue === null && dayItem.SpecificDate) {
                    const dateStr = format(new Date(dayItem.SpecificDate), 'yyyy-MM-dd');
                    dayItem.AchievedValue = calculateDayAchievementInMemory(sellerId, dateStr, goalType);
                }
            }

            // Total overall achievement
            let overallAchieved = 0;
            if (targetType === 'YEARLY') {
                overallAchieved = monthlyBreakdown.reduce((sum, item) => sum + (item.AchievedValue || 0), 0);
            } else {
                overallAchieved = weeklyBreakdown.reduce((sum, item) => sum + (item.AchievedValue || 0), 0);
            }

            enrichedTargets.push({
                ...target,
                overallAchieved,
                monthlyBreakdown,
                weeklyBreakdown,
                dailyBreakdown
            });
        }

        res.json({ success: true, data: enrichedTargets });
    } catch (e) {
        console.error("getTargets error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};

/**
 * Create Targets and Auto-distribute to months, weeks, and days
 */
exports.createTargets = async (req, res) => {
    try {
        const { targets } = req.body;
        if (!targets || !Array.isArray(targets)) {
            return res.status(400).json({ success: false, message: "Invalid payload: targets array required." });
        }

        const pool = await getPool();

        for (const targetConfig of targets) {
            const { 
                sellerId, brandManager, targetType, year, month, 
                totalTargetValue, goalType, breakdowns 
            } = targetConfig;

            const targetId = generateId();

            // 1. Insert main Target record with GoalType
            const mainQuery = `
                INSERT INTO GmsTargets (Id, SellerId, BrandManager, TargetType, Year, Month, TotalTargetValue, GoalType, CreatedAt, UpdatedAt)
                VALUES (@id, @sellerId, @brandManager, @targetType, @year, @month, @totalTargetValue, @goalType, GETDATE(), GETDATE())
            `;
            await pool.request()
                .input('id', sql.VarChar, targetId)
                .input('sellerId', sql.NVarChar, sellerId)
                .input('brandManager', sql.NVarChar, brandManager || null)
                .input('targetType', sql.VarChar, targetType)
                .input('year', sql.Int, year)
                .input('month', sql.Int, month || null)
                .input('totalTargetValue', sql.Decimal(18, 2), totalTargetValue)
                .input('goalType', sql.VarChar, goalType || 'GMS')
                .query(mainQuery);

            // 2. Insert Monthly/Weekly manually entered breakdowns and auto-distribute downwards
            if (targetType === 'YEARLY') {
                // Config has monthly breakdowns in breakdowns array
                for (const breakdownItem of breakdowns) {
                    const { periodValue, targetValue, percentageContribution } = breakdownItem;
                    const monthlyBreakdownId = generateId();

                    // A. Insert Month Target
                    await pool.request()
                        .input('id', sql.VarChar, monthlyBreakdownId)
                        .input('targetId', sql.VarChar, targetId)
                        .input('periodType', sql.VarChar, 'MONTH')
                        .input('periodValue', sql.Int, periodValue)
                        .input('targetValue', sql.Decimal(18, 2), targetValue)
                        .input('percentage', sql.Decimal(5, 2), percentageContribution)
                        .query(`
                            INSERT INTO GmsTargetBreakdowns (Id, TargetId, PeriodType, PeriodValue, TargetValue, PercentageContribution)
                            VALUES (@id, @targetId, @periodType, @periodValue, @targetValue, @percentage)
                        `);

                    // B. Auto-distribute this Month's Target to 4 Weeks (25% each)
                    const monthlyTarget = parseFloat(targetValue);
                    const weeklyTarget = monthlyTarget / 4;

                    for (let w = 1; w <= 4; w++) {
                        const weeklyBreakdownId = generateId();
                        // Composite PeriodValue to avoid overlap (e.g. Month 5, Week 2 = 52)
                        const compositeWeekValue = periodValue * 10 + w;

                        await pool.request()
                            .input('id', sql.VarChar, weeklyBreakdownId)
                            .input('targetId', sql.VarChar, targetId)
                            .input('periodType', sql.VarChar, 'WEEK')
                            .input('periodValue', sql.Int, compositeWeekValue)
                            .input('targetValue', sql.Decimal(18, 2), weeklyTarget)
                            .input('percentage', sql.Decimal(5, 2), 25.00)
                            .query(`
                                INSERT INTO GmsTargetBreakdowns (Id, TargetId, PeriodType, PeriodValue, TargetValue, PercentageContribution)
                                VALUES (@id, @targetId, @periodType, @periodValue, @targetValue, @percentage)
                            `);

                        // C. Auto-distribute this Week's Target to 7 Days (1/7th each)
                        const dailyTarget = weeklyTarget / 7;
                        const weekStartRange = getWeekRange(year, periodValue, w);
                        let currentDay = new Date(weekStartRange.startDate);

                        for (let d = 1; d <= 7; d++) {
                            const dailyBreakdownId = generateId();
                            await pool.request()
                                .input('id', sql.VarChar, dailyBreakdownId)
                                .input('targetId', sql.VarChar, targetId)
                                .input('periodType', sql.VarChar, 'DAY')
                                .input('periodValue', sql.Int, d)
                                .input('date', sql.Date, format(currentDay, 'yyyy-MM-dd'))
                                .input('targetValue', sql.Decimal(18, 2), dailyTarget)
                                .query(`
                                    INSERT INTO GmsTargetBreakdowns (Id, TargetId, PeriodType, PeriodValue, SpecificDate, TargetValue)
                                    VALUES (@id, @targetId, @periodType, @periodValue, @date, @targetValue)
                                `);
                            currentDay = addDays(currentDay, 1);
                        }
                    }
                }
            } else {
                // Config has weekly breakdowns for a single month in breakdowns array
                for (const breakdownItem of breakdowns) {
                    const { periodValue, targetValue, percentageContribution } = breakdownItem;
                    const weeklyBreakdownId = generateId();

                    // A. Insert Week Target
                    await pool.request()
                        .input('id', sql.VarChar, weeklyBreakdownId)
                        .input('targetId', sql.VarChar, targetId)
                        .input('periodType', sql.VarChar, 'WEEK')
                        .input('periodValue', sql.Int, periodValue)
                        .input('targetValue', sql.Decimal(18, 2), targetValue)
                        .input('percentage', sql.Decimal(5, 2), percentageContribution)
                        .query(`
                            INSERT INTO GmsTargetBreakdowns (Id, TargetId, PeriodType, PeriodValue, TargetValue, PercentageContribution)
                            VALUES (@id, @targetId, @periodType, @periodValue, @targetValue, @percentage)
                        `);

                    // B. Auto-distribute this Week's Target to 7 Days (1/7th each)
                    const weeklyTarget = parseFloat(targetValue);
                    const dailyTarget = weeklyTarget / 7;
                    const weekStartRange = getWeekRange(year, month, periodValue);
                    let currentDay = new Date(weekStartRange.startDate);

                    for (let d = 1; d <= 7; d++) {
                        const dailyBreakdownId = generateId();
                        await pool.request()
                            .input('id', sql.VarChar, dailyBreakdownId)
                            .input('targetId', sql.VarChar, targetId)
                            .input('periodType', sql.VarChar, 'DAY')
                            .input('periodValue', sql.Int, d)
                            .input('date', sql.Date, format(currentDay, 'yyyy-MM-dd'))
                            .input('targetValue', sql.Decimal(18, 2), dailyTarget)
                            .query(`
                                INSERT INTO GmsTargetBreakdowns (Id, TargetId, PeriodType, PeriodValue, SpecificDate, TargetValue)
                                VALUES (@id, @targetId, @periodType, @periodValue, @date, @targetValue)
                            `);
                        currentDay = addDays(currentDay, 1);
                    }
                }
            }
        }

        res.json({ success: true, message: "Targets saved and auto-distributed successfully!" });
    } catch (e) {
        console.error("createTargets error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};

/**
 * Bulk or single override input update for Achievements & Targets values
 */
exports.updateAchievements = async (req, res) => {
    try {
        const { updates } = req.body;
        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ success: false, message: "Invalid payload: updates array required." });
        }

        const pool = await getPool();

        for (const update of updates) {
            const { breakdownId, targetValue, achievedValue } = update;
            
            let query = 'UPDATE GmsTargetBreakdowns SET ';
            const inputs = [];

            if (targetValue !== undefined) {
                inputs.push({ name: 'target', type: sql.Decimal(18, 2), value: targetValue });
                query += 'TargetValue = @target, ';
            }

            if (achievedValue !== undefined) {
                inputs.push({ name: 'achieved', type: sql.Decimal(18, 2), value: achievedValue });
                query += 'AchievedValue = @achieved, ';
            }

            // Remove trailing comma
            query = query.replace(/,\s*$/, '');
            query += ' WHERE Id = @id';

            const request = pool.request().input('id', sql.VarChar, breakdownId);
            inputs.forEach(inp => request.input(inp.name, inp.type, inp.value));

            await request.query(query);
        }

        res.json({ success: true, message: "Values overridden and saved successfully!" });
    } catch (e) {
        console.error("updateAchievements error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};

/**
 * Delete a single target by ID
 */
exports.deleteTarget = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, id)
            .query('DELETE FROM GmsTargets WHERE Id = @id');
        res.json({ success: true, message: "Target deleted successfully!" });
    } catch (e) {
        console.error("deleteTarget error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};

/**
 * Delete multiple targets in bulk
 */
exports.deleteTargetsBulk = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid payload: ids array required." });
        }
        const pool = await getPool();
        
        const request = pool.request();
        const parameters = [];
        ids.forEach((id, index) => {
            request.input(`id${index}`, sql.VarChar, id);
            parameters.push(`@id${index}`);
        });
        
        const query = `DELETE FROM GmsTargets WHERE Id IN (${parameters.join(', ')})`;
        await request.query(query);
        
        res.json({ success: true, message: "Bulk targets deleted successfully!" });
    } catch (e) {
        console.error("deleteTargetsBulk error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};

/**
 * Edit single or bulk targets total value and redistributes breakdowns
 * Now accepts achievedValue per breakdown and uses batched SQL for speed
 */
exports.updateTarget = async (req, res) => {
    try {
        const { targetId, totalTargetValue, breakdowns } = req.body;
        if (!targetId || totalTargetValue === undefined || !Array.isArray(breakdowns)) {
            return res.status(400).json({ success: false, message: "Invalid payload: targetId, totalTargetValue, and breakdowns array required." });
        }

        const pool = await getPool();
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // 1. Fetch the existing target record
            const targetResult = await transaction.request()
                .input('targetId', sql.VarChar, targetId)
                .query('SELECT Id, SellerId, TargetType, Year, Month FROM GmsTargets WHERE Id = @targetId');
            
            const target = targetResult.recordset[0];
            if (!target) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: "Target not found." });
            }

            const { TargetType: targetType, Year: year, Month: month } = target;

            // 2. Update TotalTargetValue on GmsTargets
            await transaction.request()
                .input('targetId', sql.VarChar, targetId)
                .input('totalTargetValue', sql.Decimal(18, 2), totalTargetValue)
                .query('UPDATE GmsTargets SET TotalTargetValue = @totalTargetValue, UpdatedAt = GETDATE() WHERE Id = @targetId');

            // 3. Clear existing breakdowns
            await transaction.request()
                .input('targetId', sql.VarChar, targetId)
                .query('DELETE FROM GmsTargetBreakdowns WHERE TargetId = @targetId');

            // 4. Build all breakdown rows in memory, then batch insert
            const allRows = [];

            if (targetType === 'YEARLY') {
                for (const breakdownItem of breakdowns) {
                    const { periodValue, targetValue, achievedValue } = breakdownItem;
                    const monthlyBreakdownId = generateId();
                    const percentageContribution = totalTargetValue > 0 ? (targetValue / totalTargetValue) * 100 : 0;

                    const monthlyAchieved = (achievedValue !== undefined && achievedValue !== null) ? (parseFloat(achievedValue) || 0) : null;
                    const weeklyAchieved = monthlyAchieved !== null ? monthlyAchieved / 4 : null;
                    const dailyAchieved = weeklyAchieved !== null ? weeklyAchieved / 7 : null;

                    // Month row
                    allRows.push({
                        id: monthlyBreakdownId,
                        targetId,
                        periodType: 'MONTH',
                        periodValue,
                        targetValue: parseFloat(targetValue) || 0,
                        achievedValue: monthlyAchieved,
                        percentage: percentageContribution,
                        specificDate: null
                    });

                     // Distribute to 4 Weeks
                     const monthlyTarget = parseFloat(targetValue) || 0;
                     const weeklyTarget = monthlyTarget / 4;

                     for (let w = 1; w <= 4; w++) {
                          const compositeWeekValue = periodValue * 10 + w;
                          allRows.push({
                              id: generateId(),
                              targetId,
                              periodType: 'WEEK',
                              periodValue: compositeWeekValue,
                              targetValue: weeklyTarget,
                              achievedValue: weeklyAchieved,
                              percentage: 25.00,
                              specificDate: null
                          });

                          // Distribute to 7 Days
                          const dailyTarget = weeklyTarget / 7;
                          const weekStartRange = getWeekRange(year, periodValue, w);
                          let currentDay = new Date(weekStartRange.startDate);

                          for (let d = 1; d <= 7; d++) {
                              allRows.push({
                                  id: generateId(),
                                  targetId,
                                  periodType: 'DAY',
                                  periodValue: d,
                                  targetValue: dailyTarget,
                                  achievedValue: dailyAchieved,
                                  percentage: null,
                                  specificDate: format(currentDay, 'yyyy-MM-dd')
                              });
                              currentDay = addDays(currentDay, 1);
                          }
                      }
                }
            } else {
                // MONTHLY: breakdowns are weekly values
                for (const breakdownItem of breakdowns) {
                    const { periodValue, targetValue, achievedValue } = breakdownItem;
                    const percentageContribution = totalTargetValue > 0 ? (targetValue / totalTargetValue) * 100 : 0;

                    const weeklyAchieved = (achievedValue !== undefined && achievedValue !== null) ? (parseFloat(achievedValue) || 0) : null;
                    const dailyAchieved = weeklyAchieved !== null ? weeklyAchieved / 7 : null;

                    // Week row
                    allRows.push({
                        id: generateId(),
                        targetId,
                        periodType: 'WEEK',
                        periodValue,
                        targetValue: parseFloat(targetValue) || 0,
                        achievedValue: weeklyAchieved,
                        percentage: percentageContribution,
                        specificDate: null
                    });

                    // Distribute to 7 Days
                    const weeklyTarget = parseFloat(targetValue) || 0;
                    const dailyTarget = weeklyTarget / 7;
                    const weekStartRange = getWeekRange(year, month, periodValue);
                    let currentDay = new Date(weekStartRange.startDate);

                    for (let d = 1; d <= 7; d++) {
                        allRows.push({
                            id: generateId(),
                            targetId,
                            periodType: 'DAY',
                            periodValue: d,
                            targetValue: dailyTarget,
                            achievedValue: dailyAchieved,
                            percentage: null,
                            specificDate: format(currentDay, 'yyyy-MM-dd')
                        });
                        currentDay = addDays(currentDay, 1);
                    }
                }
            }

            // 5. Batch insert all rows (chunks of 50 to stay under SQL param limits)
            const CHUNK_SIZE = 50;
            for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
                const chunk = allRows.slice(i, i + CHUNK_SIZE);
                const values = [];
                const request = transaction.request();

                chunk.forEach((row, idx) => {
                    request.input(`id${idx}`, sql.VarChar, row.id);
                    request.input(`tid${idx}`, sql.VarChar, row.targetId);
                    request.input(`pt${idx}`, sql.VarChar, row.periodType);
                    request.input(`pv${idx}`, sql.Int, row.periodValue);
                    request.input(`tv${idx}`, sql.Decimal(18, 2), row.targetValue);
                    request.input(`av${idx}`, sql.Decimal(18, 2), row.achievedValue);
                    request.input(`pc${idx}`, sql.Decimal(5, 2), row.percentage);
                    request.input(`sd${idx}`, sql.Date, row.specificDate);

                    values.push(`(@id${idx}, @tid${idx}, @pt${idx}, @pv${idx}, @sd${idx}, @tv${idx}, @av${idx}, @pc${idx})`);
                });

                const insertQuery = `
                    INSERT INTO GmsTargetBreakdowns (Id, TargetId, PeriodType, PeriodValue, SpecificDate, TargetValue, AchievedValue, PercentageContribution)
                    VALUES ${values.join(', ')}
                `;
                await request.query(insertQuery);
            }

            await transaction.commit();
            res.json({ success: true, message: "Target updated and auto-redistributed successfully!" });
        } catch (innerErr) {
            await transaction.rollback();
            throw innerErr;
        }
    } catch (e) {
        console.error("updateTarget error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};


