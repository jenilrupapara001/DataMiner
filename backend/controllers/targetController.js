const { getPool, sql, generateId } = require('../database/db');
const { endOfMonth, startOfMonth, format, addDays } = require('date-fns');
const SystemLogService = require('../services/SystemLogService');

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
                orParts.push(`s.Id IN (${params.join(',')})`);
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
            LEFT JOIN Sellers s ON t.SellerId = s.SellerId
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
                SELECT s.SellerId AS ReadableSellerId, p.Date,
                       SUM(ISNULL(p.AdSpend, 0)) as AdSpend,
                       SUM(ISNULL(p.AdSales, 0)) as AdSales,
                       SUM(ISNULL(p.OrganicSales, 0)) as OrganicSales
                FROM Asins a
                INNER JOIN AdsPerformance p ON a.AsinCode = p.Asin
                INNER JOIN Sellers s ON a.SellerId = s.Id
                WHERE s.SellerId IN (${sellerParams.join(',')})
                  AND p.Date >= @minDate AND p.Date <= @maxDate
                GROUP BY s.SellerId, p.Date
            `;
            const dailyResult = await statsRequest.query(dailyQuery);

            dailyResult.recordset.forEach(row => {
                const sId = row.ReadableSellerId;
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
                VALUES (@id, @sellerId, @brandManager, @targetType, @year, @month, @totalTargetValue, @goalType, dbo.GetEnvDate(), dbo.GetEnvDate())
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

        try {
            for (const targetConfig of targets) {
                await SystemLogService.log({
                    type: 'TARGET_CREATE',
                    entityType: 'TARGET',
                    entityId: targetConfig.sellerId,
                    entityTitle: targetConfig.sellerId,
                    user: req.user,
                    description: `Created ${targetConfig.targetType} target for brand ${targetConfig.sellerId} (${targetConfig.goalType}, Year: ${targetConfig.year}, Total: ${targetConfig.totalTargetValue})`,
                    metadata: { sellerId: targetConfig.sellerId, year: targetConfig.year, goalType: targetConfig.goalType, total: targetConfig.totalTargetValue }
                });
            }
        } catch (logErr) {
            console.error('Failed to log targets creation:', logErr);
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

        try {
            await SystemLogService.log({
                type: 'ACHIEVEMENT_UPDATE',
                entityType: 'TARGET',
                entityId: updates[0]?.breakdownId || 'BULK',
                entityTitle: 'Target vs Achievement Breakdowns',
                user: req.user,
                description: `Updated/overrode target achievements values for ${updates.length} breakdowns`,
                metadata: { count: updates.length }
            });
        } catch (logErr) {
            console.error('Failed to log achievements update:', logErr);
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

        const targetInfo = await pool.request()
            .input('id', sql.VarChar, id)
            .query('SELECT SellerId, TargetType, Year, GoalType FROM GmsTargets WHERE Id = @id');
        const target = targetInfo.recordset[0];

        await pool.request()
            .input('id', sql.VarChar, id)
            .query('DELETE FROM GmsTargets WHERE Id = @id');

        try {
            if (target) {
                await SystemLogService.log({
                    type: 'TARGET_DELETE',
                    entityType: 'TARGET',
                    entityId: id,
                    entityTitle: target.SellerId,
                    user: req.user,
                    description: `Deleted ${target.TargetType} target for brand ${target.SellerId} (${target.GoalType}, Year: ${target.Year})`,
                    metadata: { targetId: id, sellerId: target.SellerId, year: target.Year, goalType: target.GoalType }
                });
            }
        } catch (logErr) {
            console.error('Failed to log target deletion:', logErr);
        }

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

        const targetInfo = await pool.request().query(`SELECT SellerId, TargetType, Year, GoalType FROM GmsTargets WHERE Id IN (${parameters.join(', ')})`);
        const targets = targetInfo.recordset;
        
        const query = `DELETE FROM GmsTargets WHERE Id IN (${parameters.join(', ')})`;
        await request.query(query);

        try {
            for (const t of targets) {
                await SystemLogService.log({
                    type: 'TARGET_DELETE',
                    entityType: 'TARGET',
                    entityId: 'BULK',
                    entityTitle: t.SellerId,
                    user: req.user,
                    description: `Deleted ${t.TargetType} target for brand ${t.SellerId} (${t.GoalType}, Year: ${t.Year}) via bulk delete`,
                    metadata: { sellerId: t.SellerId, year: t.Year, goalType: t.GoalType }
                });
            }
        } catch (logErr) {
            console.error('Failed to log bulk target deletion:', logErr);
        }
        
        res.json({ success: true, message: "Bulk targets deleted successfully!" });
    } catch (e) {
        console.error("deleteTargetsBulk error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/targets/import-achievements
// Bulk import target achievements from Excel
//
// Accepts rows with either:
//   - brandName  → auto-resolved to sellerId (Sellers.SellerId code)
//   - sellerId   → used directly (expects Sellers.SellerId string code)
//
// Manager auto-fetched via UserSellers junction:
//   UserSellers(UserId → Sellers.Id) joined with Users → manager name
// ═══════════════════════════════════════════════════════════════
exports.importAchievements = async (req, res) => {
    try {
        const { rows } = req.body;

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No rows provided',
                imported: 0,
                updated: 0,
                skipped: 0,
                errors: []
            });
        }

        const pool = await getPool();

        // ─── 1) Load all sellers ───────────────────────────────
        const sellersResult = await pool.request().query(`
            SELECT Id, SellerId, Name
            FROM Sellers
            WHERE SellerId IS NOT NULL
        `);

        const sellerNameToCode = new Map();         // "lotus premium" → "AMAZON_LOTUS"
        const sellerCodeToInternalId = new Map();   // "AMAZON_LOTUS" → Sellers.Id (UUID)
        const internalIdToSellerCode = new Map();   // Sellers.Id → "AMAZON_LOTUS"

        sellersResult.recordset.forEach(s => {
            if (s.Name && s.SellerId) {
                sellerNameToCode.set(String(s.Name).toLowerCase().trim(), s.SellerId);
            }
            if (s.SellerId && s.Id) {
                const cleanId = String(s.Id).toLowerCase().trim();
                sellerCodeToInternalId.set(s.SellerId, cleanId);
                internalIdToSellerCode.set(cleanId, s.SellerId);
            }
        });

        // ─── 2) Load UserSellers → manager names ───────────────
        // UserSellers links Users.Id → Sellers.Id (internal UUID)
        // We resolve manager by SellerId (string code) for easy lookup later
        const sellerCodeToManagerName = new Map();  // "AMAZON_LOTUS" → "Chintan Patel"

        try {
            const assignmentsResult = await pool.request().query(`
                SELECT
                    us.SellerId   AS InternalSellerId,
                    u.FirstName,
                    u.LastName,
                    u.Id          AS UserId,
                    r.Name        AS RoleName
                FROM UserSellers us
                INNER JOIN Users u ON u.Id = us.UserId
                LEFT JOIN Roles r ON u.RoleId = r.Id
                WHERE u.IsActive = 1
            `);

            console.log(`[Import] Loaded ${assignmentsResult.recordset.length} user-seller assignments`);

            assignmentsResult.recordset.forEach(row => {
                const managerName = `${row.FirstName || ''} ${row.LastName || ''}`.trim();
                if (!managerName || !row.InternalSellerId) return;

                const cleanInternalSellerId = String(row.InternalSellerId).toLowerCase().trim();
                const sellerCode = internalIdToSellerCode.get(cleanInternalSellerId);
                if (sellerCode) {
                    const role = String(row.RoleName || '').toLowerCase();
                    // Prioritize Brand Manager or manager roles over admin/viewer if multiple assignments exist
                    if (!sellerCodeToManagerName.has(sellerCode) || role === 'brand manager' || role === 'brand_manager' || role === 'manager') {
                        sellerCodeToManagerName.set(sellerCode, managerName);
                    }
                }
            });

            console.log(`[Import] Mapped ${sellerCodeToManagerName.size} sellers to managers`);
        } catch (err) {
            console.error('[Import] Failed to load UserSellers:', err.message);
        }

        // ─── 3) Begin transaction ──────────────────────────────
        const transaction = pool.transaction();
        await transaction.begin();

        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            try {
                const {
                    brandName,
                    sellerId: payloadSellerId,
                    year,
                    month,
                    goalType,
                    achievedValue,
                    targetValue,
                    managerName: payloadManagerName,
                    managerId: payloadManagerId
                } = row;

                // ─── Resolve sellerId from brandName if not provided ──
                let sellerId = payloadSellerId;
                if (!sellerId && brandName) {
                    sellerId = sellerNameToCode.get(String(brandName).toLowerCase().trim());
                }

                if (!sellerId) {
                    errors.push({
                        row: rowNum,
                        reason: `Brand "${brandName || 'N/A'}" not found in Sellers table`
                    });
                    skipped++;
                    continue;
                }

                // ─── Auto-resolve brand manager from seller ─────────
                let brandManagerVal = payloadManagerName || payloadManagerId || null;
                if (!brandManagerVal && sellerCodeToManagerName.has(sellerId)) {
                    brandManagerVal = sellerCodeToManagerName.get(sellerId);
                }

                // ─── Field validation ─────────────────────────────
                if (!year || !month || !goalType) {
                    errors.push({ row: rowNum, reason: 'Missing required fields (year, month, goalType)' });
                    skipped++;
                    continue;
                }

                const numYear = parseInt(year, 10);
                const numMonth = parseInt(month, 10);

                if (isNaN(numYear) || isNaN(numMonth) || numMonth < 1 || numMonth > 12) {
                    errors.push({ row: rowNum, reason: `Invalid year/month: ${year}/${month}` });
                    skipped++;
                    continue;
                }

                const numericAchieved = (achievedValue !== undefined && achievedValue !== null) ? parseFloat(achievedValue) : 0;
                const numericTarget = (targetValue !== undefined && targetValue !== null) ? parseFloat(targetValue) : 0;

                if (isNaN(numericAchieved) || isNaN(numericTarget)) {
                    errors.push({ row: rowNum, reason: 'Invalid achieved/target value' });
                    skipped++;
                    continue;
                }

                // ══════════════════════════════════════
                // FIND OR CREATE YEARLY target
                // ══════════════════════════════════════
                let yearlyTargetId = null;
                const yearlyResult = await transaction.request()
                    .input('sellerId', sql.NVarChar, sellerId)
                    .input('year', sql.Int, numYear)
                    .input('goalType', sql.VarChar, goalType)
                    .query(`
                        SELECT TOP 1 Id FROM GmsTargets
                        WHERE SellerId = @sellerId
                          AND Year = @year
                          AND GoalType = @goalType
                          AND TargetType = 'YEARLY'
                    `);

                let isNewYearlyTarget = false;
                if (yearlyResult.recordset.length > 0) {
                    yearlyTargetId = yearlyResult.recordset[0].Id;
                } else {
                    // Create new YEARLY target
                    yearlyTargetId = generateId();
                    isNewYearlyTarget = true;
                    await transaction.request()
                        .input('id', sql.VarChar, yearlyTargetId)
                        .input('sellerId', sql.NVarChar, sellerId)
                        .input('brandManager', sql.NVarChar, brandManagerVal)
                        .input('targetType', sql.VarChar, 'YEARLY')
                        .input('year', sql.Int, numYear)
                        .input('totalTargetValue', sql.Decimal(18, 2), 0)
                        .input('goalType', sql.VarChar, goalType)
                        .query(`
                            INSERT INTO GmsTargets
                                (Id, SellerId, BrandManager, TargetType, Year, Month, TotalTargetValue, GoalType, CreatedAt, UpdatedAt)
                            VALUES
                                (@id, @sellerId, @brandManager, @targetType, @year, NULL, @totalTargetValue, @goalType, dbo.GetEnvDate(), dbo.GetEnvDate())
                        `);

                    // Also initialize breakdowns for all 12 months, 48 weeks, and 336 days to 0!
                    const allInitRows = [];
                    for (let m = 1; m <= 12; m++) {
                        const monthlyBreakdownId = generateId();
                        allInitRows.push({
                            id: monthlyBreakdownId,
                            targetId: yearlyTargetId,
                            periodType: 'MONTH',
                            periodValue: m,
                            targetValue: 0,
                            achievedValue: 0,
                            percentage: 0,
                            specificDate: null
                        });

                        for (let w = 1; w <= 4; w++) {
                            const compositeWeekValue = m * 10 + w;
                            allInitRows.push({
                                id: generateId(),
                                targetId: yearlyTargetId,
                                periodType: 'WEEK',
                                periodValue: compositeWeekValue,
                                targetValue: 0,
                                achievedValue: 0,
                                percentage: 25.00,
                                specificDate: null
                            });

                            const weekStartRange = getWeekRange(numYear, m, w);
                            let currentDay = new Date(weekStartRange.startDate);

                            for (let d = 1; d <= 7; d++) {
                                allInitRows.push({
                                    id: generateId(),
                                    targetId: yearlyTargetId,
                                    periodType: 'DAY',
                                    periodValue: d,
                                    targetValue: 0,
                                    achievedValue: 0,
                                    percentage: null,
                                    specificDate: format(currentDay, 'yyyy-MM-dd')
                                });
                                currentDay = addDays(currentDay, 1);
                            }
                        }
                    }

                    // Bulk insert the initialization rows in chunks of 50
                    const CHUNK_SIZE = 50;
                    for (let cIdx = 0; cIdx < allInitRows.length; cIdx += CHUNK_SIZE) {
                        const chunk = allInitRows.slice(cIdx, cIdx + CHUNK_SIZE);
                        const values = [];
                        const insertRequest = transaction.request();

                        chunk.forEach((row, idx) => {
                            insertRequest.input(`id_${idx}`, sql.VarChar, row.id);
                            insertRequest.input(`tid_${idx}`, sql.VarChar, row.targetId);
                            insertRequest.input(`pt_${idx}`, sql.VarChar, row.periodType);
                            insertRequest.input(`pv_${idx}`, sql.Int, row.periodValue);
                            insertRequest.input(`tv_${idx}`, sql.Decimal(18, 2), row.targetValue);
                            insertRequest.input(`av_${idx}`, sql.Decimal(18, 2), row.achievedValue);
                            insertRequest.input(`pc_${idx}`, sql.Decimal(5, 2), row.percentage);
                            insertRequest.input(`sd_${idx}`, sql.Date, row.specificDate);

                            values.push(`(@id_${idx}, @tid_${idx}, @pt_${idx}, @pv_${idx}, @sd_${idx}, @tv_${idx}, @av_${idx}, @pc_${idx})`);
                        });

                        const insertQuery = `
                            INSERT INTO GmsTargetBreakdowns (Id, TargetId, PeriodType, PeriodValue, SpecificDate, TargetValue, AchievedValue, PercentageContribution)
                            VALUES ${values.join(', ')}
                        `;
                        await insertRequest.query(insertQuery);
                    }
                }

                // ══════════════════════════════════════
                // UPDATE SPECIFIC MONTH AND AUTO-DISTRIBUTE
                // ══════════════════════════════════════
                const perWeekTarget = numericTarget / 4;
                const perWeekAchieved = numericAchieved / 4;
                const perDayTarget = perWeekTarget / 7;
                const perDayAchieved = perWeekAchieved / 7;

                // Update Month breakdown
                await transaction.request()
                    .input('target', sql.Decimal(18, 2), numericTarget)
                    .input('achieved', sql.Decimal(18, 2), numericAchieved)
                    .input('targetId', sql.VarChar, yearlyTargetId)
                    .input('periodValue', sql.Int, numMonth)
                    .query(`
                        UPDATE GmsTargetBreakdowns
                        SET TargetValue = @target, AchievedValue = @achieved
                        WHERE TargetId = @targetId
                          AND PeriodType = 'MONTH'
                          AND PeriodValue = @periodValue
                    `);

                // Update 4 Weeks breakdowns
                const pvMin = numMonth * 10 + 1;
                const pvMax = numMonth * 10 + 4;
                await transaction.request()
                    .input('target', sql.Decimal(18, 2), perWeekTarget)
                    .input('achieved', sql.Decimal(18, 2), perWeekAchieved)
                    .input('targetId', sql.VarChar, yearlyTargetId)
                    .input('pvMin', sql.Int, pvMin)
                    .input('pvMax', sql.Int, pvMax)
                    .query(`
                        UPDATE GmsTargetBreakdowns
                        SET TargetValue = @target, AchievedValue = @achieved
                        WHERE TargetId = @targetId
                          AND PeriodType = 'WEEK'
                          AND PeriodValue BETWEEN @pvMin AND @pvMax
                    `);

                // Update 28 Days breakdowns
                const { startDate, endDate } = getMonthRange(numYear, numMonth);
                await transaction.request()
                    .input('target', sql.Decimal(18, 2), perDayTarget)
                    .input('achieved', sql.Decimal(18, 2), perDayAchieved)
                    .input('targetId', sql.VarChar, yearlyTargetId)
                    .input('startDate', sql.Date, startDate)
                    .input('endDate', sql.Date, endDate)
                    .query(`
                        UPDATE GmsTargetBreakdowns
                        SET TargetValue = @target, AchievedValue = @achieved
                        WHERE TargetId = @targetId
                          AND PeriodType = 'DAY'
                          AND SpecificDate >= @startDate
                          AND SpecificDate <= @endDate
                    `);

                // Update BrandManager and TotalTargetValue of the Yearly Target
                const sumResult = await transaction.request()
                    .input('targetId', sql.VarChar, yearlyTargetId)
                    .query(`
                        SELECT SUM(ISNULL(TargetValue, 0)) AS TotalTarget
                        FROM GmsTargetBreakdowns
                        WHERE TargetId = @targetId AND PeriodType = 'MONTH'
                    `);
                const calculatedTotalTarget = sumResult.recordset[0].TotalTarget || 0;

                await transaction.request()
                    .input('brandManager', sql.NVarChar, brandManagerVal)
                    .input('totalTarget', sql.Decimal(18, 2), calculatedTotalTarget)
                    .input('id', sql.VarChar, yearlyTargetId)
                    .query(`
                        UPDATE GmsTargets
                        SET BrandManager = ISNULL(NULLIF(BrandManager, ''), @brandManager),
                            TotalTargetValue = @totalTarget,
                            UpdatedAt = dbo.GetEnvDate()
                        WHERE Id = @id
                    `);

                if (isNewYearlyTarget) {
                    imported++;
                } else {
                    updated++;
                }
            } catch (err) {
                console.error(`[Import] Row ${rowNum} error:`, err.message);
                errors.push({
                    row: rowNum,
                    reason: err.message || 'Unknown error'
                });
                skipped++;
            }

        }

        await transaction.commit();

        try {
            await SystemLogService.log({
                type: 'TARGET_IMPORT',
                entityType: 'TARGET',
                entityId: 'IMPORT',
                entityTitle: 'Excel Bulk Import',
                user: req.user,
                description: `Bulk imported target achievements from Excel: ${imported} created, ${updated} updated, ${skipped} skipped`,
                metadata: { imported, updated, skipped, errorsCount: errors.length }
            });
        } catch (logErr) {
            console.error('Failed to log Excel targets import:', logErr);
        }

        const totalProcessed = imported + updated;
        const success = errors.length === 0 && totalProcessed > 0;

        return res.json({
            success,
            imported,
            updated,
            skipped,
            errors,
            message: `Processed ${rows.length} record(s): ${imported} new, ${updated} updated, ${skipped} skipped`
        });
    } catch (e) {
        try {
            await transaction.rollback();
        } catch (rollbackErr) {
            console.error('[Import] Rollback error:', rollbackErr);
        }
        console.error('[Import] Fatal error:', e);
        return res.status(500).json({
            success: false,
            message: e.message || 'Internal server error',
            imported: 0,
            updated: 0,
            skipped: 0,
            errors: [{ row: 0, reason: e.message }]
        });
    }
};

/**
 * Edit single or bulk targets total value and redistributes breakdowns
 * Now accepts achievedValue per breakdown and uses batched SQL for speed
 */
exports.updateTarget = async (req, res) => {
    try {
        const { targetId, totalTargetValue, breakdowns, updates } = req.body;

        // Bulk updates branch
        if (updates && Array.isArray(updates)) {
            const pool = await getPool();
            const transaction = pool.transaction();
            await transaction.begin();

            try {
                const allRows = [];

                for (const update of updates) {
                    const { targetId: uTargetId, totalTargetValue: uTotalTargetValue, breakdowns: uBreakdowns } = update;
                    if (!uTargetId || !Array.isArray(uBreakdowns)) {
                        await transaction.rollback();
                        return res.status(400).json({ success: false, message: "Invalid payload inside updates array." });
                    }

                    // Auto-calculate the total target value from uBreakdowns
                    let calculatedTotalTarget = 0;
                    for (const breakdownItem of uBreakdowns) {
                        calculatedTotalTarget += parseFloat(breakdownItem.targetValue) || 0;
                    }

                    // 1. Fetch the existing target record
                    const targetResult = await transaction.request()
                        .input(`tId_${uTargetId}`, sql.VarChar, uTargetId)
                        .query(`SELECT Id, SellerId, TargetType, Year, Month FROM GmsTargets WHERE Id = @tId_${uTargetId}`);
                    
                    const target = targetResult.recordset[0];
                    if (!target) {
                        await transaction.rollback();
                        return res.status(404).json({ success: false, message: `Target ${uTargetId} not found.` });
                    }

                    const { TargetType: targetType, Year: year, Month: month } = target;

                    // 2. Update TotalTargetValue on GmsTargets
                    await transaction.request()
                        .input(`tId_up_${uTargetId}`, sql.VarChar, uTargetId)
                        .input(`ttVal_${uTargetId}`, sql.Decimal(18, 2), calculatedTotalTarget)
                        .query(`UPDATE GmsTargets SET TotalTargetValue = @ttVal_${uTargetId}, UpdatedAt = dbo.GetEnvDate() WHERE Id = @tId_up_${uTargetId}`);

                    // 3. Clear existing breakdowns
                    await transaction.request()
                        .input(`tId_del_${uTargetId}`, sql.VarChar, uTargetId)
                        .query(`DELETE FROM GmsTargetBreakdowns WHERE TargetId = @tId_del_${uTargetId}`);

                    // 4. Build all breakdown rows in memory
                    if (targetType === 'YEARLY') {
                        for (const breakdownItem of uBreakdowns) {
                            const { periodValue, targetValue, achievedValue } = breakdownItem;
                            const monthlyBreakdownId = generateId();
                            const percentageContribution = calculatedTotalTarget > 0 ? (targetValue / calculatedTotalTarget) * 100 : 0;

                            const monthlyAchieved = (achievedValue !== undefined && achievedValue !== null) ? (parseFloat(achievedValue) || 0) : null;
                            const weeklyAchieved = monthlyAchieved !== null ? monthlyAchieved / 4 : null;
                            const dailyAchieved = weeklyAchieved !== null ? weeklyAchieved / 7 : null;

                            // Month row
                            allRows.push({
                                id: monthlyBreakdownId,
                                targetId: uTargetId,
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
                                      targetId: uTargetId,
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
                                          targetId: uTargetId,
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
                        for (const breakdownItem of uBreakdowns) {
                            const { periodValue, targetValue, achievedValue } = breakdownItem;
                            const percentageContribution = calculatedTotalTarget > 0 ? (targetValue / calculatedTotalTarget) * 100 : 0;

                            const weeklyAchieved = (achievedValue !== undefined && achievedValue !== null) ? (parseFloat(achievedValue) || 0) : null;
                            const dailyAchieved = weeklyAchieved !== null ? weeklyAchieved / 7 : null;

                            // Week row
                            allRows.push({
                                id: generateId(),
                                targetId: uTargetId,
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
                                    targetId: uTargetId,
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
                }

                // 5. Batch insert all rows in chunks
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

                try {
                    for (const update of updates) {
                        await SystemLogService.log({
                            type: 'TARGET_UPDATE',
                            entityType: 'TARGET',
                            entityId: update.targetId,
                            entityTitle: 'Bulk Target Edit',
                            user: req.user,
                            description: `Bulk updated targets for target ID ${update.targetId}`,
                            metadata: { targetId: update.targetId }
                        });
                    }
                } catch (logErr) {
                    console.error('Failed to log bulk targets update:', logErr);
                }

                return res.json({ success: true, message: "All targets updated and distributed successfully!" });
            } catch (innerErr) {
                await transaction.rollback();
                throw innerErr;
            }
        }

        // Single update fallback
        if (!targetId || !Array.isArray(breakdowns)) {
            return res.status(400).json({ success: false, message: "Invalid payload: targetId and breakdowns array required." });
        }

        const pool = await getPool();
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Auto-calculate the total target value from breakdowns
            let calculatedTotalTarget = 0;
            for (const breakdownItem of breakdowns) {
                calculatedTotalTarget += parseFloat(breakdownItem.targetValue) || 0;
            }

            // 1. Fetch the existing target record
            const targetResult = await transaction.request()
                .input('targetId', sql.VarChar, targetId)
                .query('SELECT Id, SellerId, TargetType, Year, Month, GoalType FROM GmsTargets WHERE Id = @targetId');
            
            const target = targetResult.recordset[0];
            if (!target) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: "Target not found." });
            }

            const { TargetType: targetType, Year: year, Month: month, SellerId: sellerId, GoalType: goalType } = target;

            // 2. Update TotalTargetValue on GmsTargets
            await transaction.request()
                .input('targetId', sql.VarChar, targetId)
                .input('totalTargetValue', sql.Decimal(18, 2), calculatedTotalTarget)
                .query('UPDATE GmsTargets SET TotalTargetValue = @totalTargetValue, UpdatedAt = dbo.GetEnvDate() WHERE Id = @targetId');

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
                    const percentageContribution = calculatedTotalTarget > 0 ? (targetValue / calculatedTotalTarget) * 100 : 0;

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
                    const percentageContribution = calculatedTotalTarget > 0 ? (targetValue / calculatedTotalTarget) * 100 : 0;

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

            try {
                await SystemLogService.log({
                    type: 'TARGET_UPDATE',
                    entityType: 'TARGET',
                    entityId: targetId,
                    entityTitle: sellerId,
                    user: req.user,
                    description: `Updated target for brand ${sellerId} (${goalType}, Year: ${year}, New Total: ${calculatedTotalTarget})`,
                    metadata: { targetId, sellerId, year, goalType, total: calculatedTotalTarget }
                });
            } catch (logErr) {
                console.error('Failed to log target update:', logErr);
            }

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


