const { getPool, sql } = require('./db');

async function main() {
    try {
        const pool = await getPool();
        console.log("Starting Live Sync columns migration...");

        // 1. Sellers Columns
        const sellersColumns = [
            { name: 'LiveSyncClientId', type: 'NVARCHAR(255) NULL' },
            { name: 'LiveSyncClientSecret', type: 'NVARCHAR(500) NULL' },
            { name: 'PartnerTag', type: 'NVARCHAR(100) NULL' },
            { name: 'Marketplace', type: 'NVARCHAR(100) DEFAULT \'www.amazon.in\'' },
            { name: 'LiveSyncEnabled', type: 'BIT DEFAULT 0' },
            { name: 'LastLiveSyncAt', type: 'DATETIME NULL' }
        ];

        for (const col of sellersColumns) {
            const checkQuery = `
                IF NOT EXISTS (
                    SELECT * FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[dbo].[Sellers]') AND name = '${col.name}'
                )
                BEGIN
                    ALTER TABLE Sellers ADD ${col.name} ${col.type};
                    SELECT 'ADDED' AS status;
                END
                ELSE
                BEGIN
                    SELECT 'EXISTS' AS status;
                END
            `;
            const res = await pool.request().query(checkQuery);
            if (res.recordset[0]?.status === 'ADDED') {
                console.log(`Added ${col.name} to Sellers`);
            } else {
                console.log(`${col.name} already exists in Sellers`);
            }
        }

        // 2. Asins Columns
        const asinsColumns = [
            { name: 'ParentAsin', type: 'NVARCHAR(20) NULL' },
            { name: 'SellerExternalId', type: 'NVARCHAR(100) NULL' },
            { name: 'CategoryPath', type: 'NVARCHAR(500) NULL' },
            { name: 'BulletPoints', type: 'NVARCHAR(MAX) NULL' },
            { name: 'VariantImages', type: 'NVARCHAR(MAX) NULL' },
            { name: 'Dimensions', type: 'NVARCHAR(MAX) NULL' },
            { name: 'BuyBoxes', type: 'NVARCHAR(MAX) NULL' },
            { name: 'HasDeal', type: 'BIT DEFAULT 0' },
            { name: 'DealType', type: 'NVARCHAR(50) NULL' },
            { name: 'DealEndTime', type: 'DATETIME NULL' },
            { name: 'AplusContent', type: 'NVARCHAR(MAX) NULL' },
            { name: 'AplusModuleCount', type: 'INT DEFAULT 0' },
            { name: 'RatingBreakdown', type: 'NVARCHAR(MAX) NULL' },
            { name: 'LastLiveSyncAt', type: 'DATETIME NULL' },
            { name: 'LastOctoparseSyncAt', type: 'DATETIME NULL' },
            { name: 'LastSyncSource', type: 'NVARCHAR(20) NULL' }
        ];

        for (const col of asinsColumns) {
            const checkQuery = `
                IF NOT EXISTS (
                    SELECT * FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = '${col.name}'
                )
                BEGIN
                    ALTER TABLE Asins ADD ${col.name} ${col.type};
                    SELECT 'ADDED' AS status;
                END
                ELSE
                BEGIN
                    SELECT 'EXISTS' AS status;
                END
            `;
            const res = await pool.request().query(checkQuery);
            if (res.recordset[0]?.status === 'ADDED') {
                console.log(`Added ${col.name} to Asins`);
            } else {
                console.log(`${col.name} already exists in Asins`);
            }
        }

        // 3. AsinHistory Source Column
        const checkHistoryQuery = `
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID(N'[dbo].[AsinHistory]') AND name = 'Source'
            )
            BEGIN
                ALTER TABLE AsinHistory ADD Source NVARCHAR(20) NULL;
                SELECT 'ADDED' AS status;
            END
            ELSE
            BEGIN
                SELECT 'EXISTS' AS status;
            END
        `;
        const resHistory = await pool.request().query(checkHistoryQuery);
        if (resHistory.recordset[0]?.status === 'ADDED') {
            console.log("Added Source to AsinHistory");
        } else {
            console.log("Source already exists in AsinHistory");
        }

        console.log("Live Sync migration completed successfully!");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        process.exit(0);
    }
}

main();
