const { getPool } = require('../database/db');

async function addTargetIndexes() {
    try {
        const pool = await getPool();
        console.log('✅ Connected to SQL Server. Adding indexes for Target vs Achievement (GmsTargets & GmsTargetBreakdowns)...');

        await pool.request().query(`
-- ============================================================
-- 1. GMSTARGETS TABLE
-- ============================================================

-- Primary filter: TargetType + Year
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_GmsTargets_TargetType_Year'
    AND object_id = OBJECT_ID('GmsTargets')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_GmsTargets_TargetType_Year
        ON GmsTargets (TargetType ASC, Year ASC)
        INCLUDE (
            SellerId,
            BrandManager,
            GoalType,
            Month,
            TotalTargetValue,
            CreatedAt,
            UpdatedAt
        );
    PRINT '✓ IX_GmsTargets_TargetType_Year created';
END
ELSE
    PRINT '- IX_GmsTargets_TargetType_Year already exists, skipping';

-- SellerId lookup
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_GmsTargets_SellerId_Enriched'
    AND object_id = OBJECT_ID('GmsTargets')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_GmsTargets_SellerId_Enriched
        ON GmsTargets (SellerId ASC)
        INCLUDE (
            TargetType,
            Year,
            Month,
            GoalType,
            BrandManager,
            TotalTargetValue
        );
    PRINT '✓ IX_GmsTargets_SellerId_Enriched created';
END
ELSE
    PRINT '- IX_GmsTargets_SellerId_Enriched already exists, skipping';

-- CreatedAt for ORDER BY CreatedAt DESC
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_GmsTargets_CreatedAt_Desc'
    AND object_id = OBJECT_ID('GmsTargets')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_GmsTargets_CreatedAt_Desc
        ON GmsTargets (CreatedAt DESC);
    PRINT '✓ IX_GmsTargets_CreatedAt_Desc created';
END
ELSE
    PRINT '- IX_GmsTargets_CreatedAt_Desc already exists, skipping';

-- Composite: SellerId + TargetType + Year
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_GmsTargets_SellerId_Type_Year'
    AND object_id = OBJECT_ID('GmsTargets')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_GmsTargets_SellerId_Type_Year
        ON GmsTargets (SellerId ASC, TargetType ASC, Year ASC)
        INCLUDE (
            BrandManager,
            GoalType,
            Month,
            TotalTargetValue,
            CreatedAt
        );
    PRINT '✓ IX_GmsTargets_SellerId_Type_Year created';
END
ELSE
    PRINT '- IX_GmsTargets_SellerId_Type_Year already exists, skipping';


-- ============================================================
-- 2. GMSTARGETBREAKDOWNS TABLE
-- Covers all breakdowns (Monthly, Weekly, Daily) in a single table
-- ============================================================

-- Most critical index: TargetId + PeriodType + PeriodValue
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_GmsTargetBreakdowns_TargetId_Period'
    AND object_id = OBJECT_ID('GmsTargetBreakdowns')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_GmsTargetBreakdowns_TargetId_Period
        ON GmsTargetBreakdowns (TargetId ASC, PeriodType ASC, PeriodValue ASC)
        INCLUDE (
            TargetValue,
            AchievedValue,
            PercentageContribution,
            SpecificDate
        );
    PRINT '✓ IX_GmsTargetBreakdowns_TargetId_Period created';
END
ELSE
    PRINT '- IX_GmsTargetBreakdowns_TargetId_Period already exists, skipping';

-- SpecificDate lookup
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_GmsTargetBreakdowns_SpecificDate_Covering'
    AND object_id = OBJECT_ID('GmsTargetBreakdowns')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_GmsTargetBreakdowns_SpecificDate_Covering
        ON GmsTargetBreakdowns (SpecificDate ASC)
        INCLUDE (TargetId, TargetValue, AchievedValue, PeriodType, PeriodValue);
    PRINT '✓ IX_GmsTargetBreakdowns_SpecificDate_Covering created';
END
ELSE
    PRINT '- IX_GmsTargetBreakdowns_SpecificDate_Covering already exists, skipping';


-- ============================================================
-- 3. SELLERS TABLE (used in JOIN)
-- ============================================================

IF COL_LENGTH('Sellers', 'SellerId') IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Sellers_SellerId'
    AND object_id = OBJECT_ID('Sellers')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Sellers_SellerId
        ON Sellers (SellerId ASC)
        INCLUDE (Name, Marketplace);
    PRINT '✓ IX_Sellers_SellerId created';
END
ELSE
    PRINT '- IX_Sellers_SellerId already exists or column not found, skipping';


-- ============================================================
-- 4. UPDATE STATISTICS
-- ============================================================

PRINT '';
PRINT 'Updating statistics...';

UPDATE STATISTICS GmsTargets;
UPDATE STATISTICS GmsTargetBreakdowns;
UPDATE STATISTICS Sellers;

PRINT '✓ Statistics updated';
        `);

        console.log('✅ Indexes and statistics created successfully for Target vs Achievement dashboard!');

        // Run Verification Query
        const verifyResult = await pool.request().query(`
            SELECT
                t.name              AS TableName,
                i.name              AS IndexName,
                i.type_desc         AS IndexType
            FROM sys.indexes       i
            JOIN sys.tables        t  ON i.object_id  = t.object_id
            WHERE t.name IN ('GmsTargets','GmsTargetBreakdowns','Sellers')
              AND i.type > 0
            ORDER BY t.name, i.name;
        `);

        console.log('\n=== Created Indexes Verification ===');
        console.table(verifyResult.recordset);

        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to add indexes:', err.message);
        process.exit(1);
    }
}

addTargetIndexes();
