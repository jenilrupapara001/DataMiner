const { MongoClient } = require('mongodb');
const { sql, getPool } = require('../database/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * ULTRA-FAST COMPREHENSIVE MIGRATION SCRIPT
 * MONGODB -> SQL SERVER
 * USES SQL BULK INSERT FOR MASSIVE DATA
 */

async function migrate() {
    const startTime = Date.now();
    console.log('🚀 Starting Ultra-Fast Data Migration...');
    console.log('📡 Mongo URI:', process.env.MONGO_URI ? process.env.MONGO_URI.split('@')[1] || 'Local' : 'MISSING');
    console.log('📡 SQL Server:', process.env.DB_SERVER);

    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI is not defined in .env');
        process.exit(1);
    }

    const mongoClient = new MongoClient(process.env.MONGO_URI);

    try {
        await mongoClient.connect();
        const mongoDb = mongoClient.db();
        const sqlPool = await getPool();

        console.log('✅ Connected to both databases.');

        console.log('🧹 Clearing existing SQL data for high-volume tables...');
        await sqlPool.request().query(`
            DELETE FROM AsinWeekHistory;
            DELETE FROM AsinHistory;
            DELETE FROM Asins;
            DELETE FROM SystemLogs;
        `);
        await migrateCollection(mongoDb, sqlPool, 'roles', 'Roles', row => ({
            Id: row._id.toString(),
            Name: row.name,
            DisplayName: row.displayName || row.name,
            Description: row.description || '',
            Level: row.level || 0,
            Color: row.color || '#4F46E5',
            IsSystem: row.isSystem ? 1 : 0,
            IsActive: row.isActive !== false ? 1 : 0,
            CreatedAt: row.createdAt || new Date(),
            UpdatedAt: row.updatedAt || new Date()
        }));

        // 2. Permissions
        await migrateCollection(mongoDb, sqlPool, 'permissions', 'Permissions', row => ({
            Id: row._id.toString(),
            Name: row.name,
            DisplayName: row.displayName || row.name,
            Category: row.category || '',
            Action: row.action || '',
            Description: row.description || '',
            CreatedAt: row.createdAt || new Date()
        }));

        // 3. Users
        const userResults = await migrateCollection(mongoDb, sqlPool, 'users', 'Users', row => ({
            Id: row._id.toString(),
            Email: row.email,
            Password: row.password,
            FirstName: row.firstName || '',
            LastName: row.lastName || '',
            Phone: row.phone || '',
            Avatar: row.avatar || '',
            RoleId: row.role?.toString() || row.roleId?.toString(),
            IsEmailVerified: row.isEmailVerified ? 1 : 0,
            IsActive: row.isActive !== false ? 1 : 0,
            IsOnline: row.isOnline ? 1 : 0,
            LastSeen: row.lastSeen || null,
            Preferences: row.preferences ? JSON.stringify(row.preferences) : null,
            RefreshToken: row.refreshToken || null,
            CreatedAt: row.createdAt || new Date(),
            UpdatedAt: row.updatedAt || new Date()
        }));

        // Bridge: UserSellers
        if (userResults.raw && userResults.raw.length > 0) {
            console.log('\n🔗 Migrating User-Seller relationships...');
            let bridgeCount = 0;
            for (const user of userResults.raw) {
                if (user.assignedSellers && Array.isArray(user.assignedSellers)) {
                    for (const sellerId of user.assignedSellers) {
                        try {
                            await sqlPool.request()
                                .input('uid', sql.VarChar, user._id.toString())
                                .input('sid', sql.VarChar, sellerId.toString())
                                .query(`
                                    IF NOT EXISTS (SELECT 1 FROM UserSellers WHERE UserId = @uid AND SellerId = @sid)
                                    INSERT INTO UserSellers (UserId, SellerId) VALUES (@uid, @sid)
                                `);
                            bridgeCount++;
                        } catch (e) { }
                    }
                }
            }
            console.log(`✅ Linked ${bridgeCount} User-Seller pairs.`);
        }

        // 4. Sellers
        await migrateCollection(mongoDb, sqlPool, 'sellers', 'Sellers', row => ({
            Id: row._id.toString(),
            Name: row.name,
            Marketplace: row.marketplace || 'amazon.in',
            SellerId: row.sellerId || '',
            OctoparseId: row.octoparseId || '',
            IsActive: row.isActive !== false ? 1 : 0,
            Plan: row.plan || 'Starter',
            ScrapeLimit: row.scrapeLimit || 100,
            ScrapeUsed: row.scrapeUsed || 0,
            LastScrapedAt: row.lastScrapedAt || null,
            OctoparseConfig: row.octoparseConfig ? JSON.stringify(row.octoparseConfig) : null,
            KeepaConfig: row.keepaConfig ? JSON.stringify(row.keepaConfig) : null,
            CreatedAt: row.createdAt || new Date(),
            UpdatedAt: row.updatedAt || new Date()
        }));

        // // 5. Asins (BULK) - COMPREHENSIVE MAPPING
        // await migrateBulk(mongoDb, sqlPool, 'asins', 'Asins', row => ({
        //     Id: row._id.toString(),
        //     AsinCode: row.asinCode || row.asin,
        //     SellerId: row.seller?.toString() || row.sellerId?.toString(),
        //     Status: (row.status || 'Active').substring(0, 50),
        //     ScrapeStatus: (row.scrapeStatus || 'Idle').substring(0, 50),
        //     Category: (row.category || '').substring(0, 255),
        //     Brand: (row.brand || '').substring(0, 255),
        //     Title: row.title || '',
        //     ImageUrl: row.imageUrl || '',
        //     CurrentPrice: parseFloat(row.currentPrice) || 0,
        //     BSR: parseInt(row.bsr) || 0,
        //     Rating: parseFloat(row.rating) || 0,
        //     ReviewCount: parseInt(row.reviewCount) || 0,
        //     LQS: parseFloat(row.lqs) || 0,
        //     LqsDetails: row.lqsDetails ? JSON.stringify(row.lqsDetails) : null,
        //     CdqComponents: row.cdqComponents ? JSON.stringify(row.cdqComponents) : null,
        //     FeePreview: row.feePreview ? JSON.stringify(row.feePreview) : null,
        //     BuyBoxStatus: row.buyBoxStatus ? 1 : 0,
        //     LastScrapedAt: row.lastScrapedAt || null,
        //     CreatedAt: row.createdAt || new Date(),
        //     UpdatedAt: row.updatedAt || new Date(),

        //     // Missing fields found in SQL schema
        //     SoldBy: row.soldBy || '',
        //     BuyBoxWin: row.buyBoxWin ? 1 : 0,
        //     BuyBoxSellerId: row.buyBoxSellerId || '',
        //     Sku: row.sku || '',
        //     HasAplus: row.hasAplus ? 1 : 0,
        //     StockLevel: row.stockLevel || 0,
        //     VideoCount: row.videoCount || 0,
        //     ImagesCount: row.imagesCount || 0,
        //     BulletPoints: row.bulletPoints ? JSON.stringify(row.bulletPoints) : null,
        //     BulletPointsText: row.bulletPointsText || '',
        //     StapleLevel: row.stapleLevel || 'Regular',
        //     Weight: parseFloat(row.weight) || 0,
        //     LossPerReturn: parseFloat(row.lossPerReturn) || 0
        // }));

        // // 6. AsinHistory (BULK)
        // await migrateBulk(mongoDb, sqlPool, 'asinhistory', 'AsinHistory', row => ({
        //     AsinId: row.asin?.toString() || row.asinId?.toString(),
        //     Date: row.date || new Date(),
        //     Price: parseFloat(row.price) || 0,
        //     BSR: parseInt(row.bsr) || 0,
        //     Rating: parseFloat(row.rating) || 0,
        //     ReviewCount: parseInt(row.reviewCount) || 0,
        //     BuyBoxStatus: row.buyBoxStatus ? 1 : 0
        // }));

        // 6b. AsinWeekHistory (BULK) - Required for Trends/Dashboard
        await migrateBulk(mongoDb, sqlPool, 'asinhistory', 'AsinWeekHistory', row => ({
            AsinId: row.asin?.toString() || row.asinId?.toString(),
            WeekStartDate: row.date || new Date(),
            AvgPrice: parseFloat(row.price) || 0,
            AvgBSR: parseInt(row.bsr) || 0,
            AvgRating: parseFloat(row.rating) || 0,
            TotalReviews: parseInt(row.reviewCount) || 0
        }));

        // 7. OKR Entities
        await migrateCollection(mongoDb, sqlPool, 'goals', 'Goals', row => ({
            Id: row._id.toString(),
            Title: row.title,
            Description: row.description || '',
            OwnerId: row.owner?.toString() || row.ownerId?.toString(),
            StartDate: row.startDate || null,
            EndDate: row.endDate || null,
            Status: row.status || 'Draft',
            Progress: row.progress || 0,
            CreatedAt: row.createdAt || new Date(),
            UpdatedAt: row.updatedAt || new Date()
        }));

        await migrateCollection(mongoDb, sqlPool, 'objectives', 'Objectives', row => ({
            Id: row._id.toString(),
            GoalId: row.goal?.toString() || row.goalId?.toString(),
            Title: row.title,
            Description: row.description || '',
            OwnerId: row.owner?.toString() || row.ownerId?.toString(),
            Status: row.status || 'Draft',
            Progress: row.progress || 0,
            CreatedAt: row.createdAt || new Date(),
            UpdatedAt: row.updatedAt || new Date()
        }));

        await migrateCollection(mongoDb, sqlPool, 'keyresults', 'KeyResults', row => ({
            Id: row._id.toString(),
            ObjectiveId: row.objective?.toString() || row.objectiveId?.toString(),
            Title: row.title,
            Description: row.description || '',
            OwnerId: row.owner?.toString() || row.ownerId?.toString(),
            Status: row.status || 'Draft',
            CurrentValue: row.currentValue || 0,
            TargetValue: row.targetValue || 0,
            Unit: row.unit || '',
            Progress: row.progress || 0,
            CreatedAt: row.createdAt || new Date(),
            UpdatedAt: row.updatedAt || new Date()
        }));

        // 8. Actions
        await migrateCollection(mongoDb, sqlPool, 'actions', 'Actions', row => ({
            Id: row._id.toString(),
            Title: row.title,
            Description: row.description || '',
            Status: row.status || 'Pending',
            Priority: row.priority || 'Medium',
            Type: row.type || 'Manual',
            CreatedBy: row.createdBy?.toString(),
            AssignedTo: row.assignedTo?.toString(),
            SellerId: row.seller?.toString() || row.sellerId?.toString(),
            GoalId: row.goal?.toString() || row.goalId?.toString(),
            ObjectiveId: row.objective?.toString() || row.objectiveId?.toString(),
            KeyResultId: row.keyResult?.toString() || row.keyResultId?.toString(),
            DueDate: row.dueDate || null,
            CompletedAt: row.completedAt || null,
            CreatedAt: row.createdAt || new Date(),
            UpdatedAt: row.updatedAt || new Date()
        }));

        // 9. Messaging
        await migrateCollection(mongoDb, sqlPool, 'conversations', 'Conversations', row => ({
            Id: row._id.toString(),
            Type: row.type || 'DIRECT',
            Title: row.title || '',
            IsActive: row.isActive !== false ? 1 : 0,
            CreatedAt: row.createdAt || new Date(),
            UpdatedAt: row.updatedAt || new Date()
        }));

        await migrateCollection(mongoDb, sqlPool, 'messages', 'Messages', row => ({
            Id: row._id.toString(),
            ConversationId: row.conversation?.toString() || row.conversationId?.toString(),
            SenderId: row.sender?.toString() || row.senderId?.toString(),
            Type: row.type || 'TEXT',
            Content: row.content || '',
            FileUrl: row.fileUrl || null,
            ReplyToId: row.replyTo?.toString(),
            CreatedAt: row.createdAt || new Date()
        }));

        // 10. Logs & Settings
        await migrateBulk(mongoDb, sqlPool, 'systemlogs', 'SystemLogs', row => ({
            Level: row.level || 'info',
            Module: row.module || 'system',
            Message: row.message || '',
            Metadata: row.metadata ? JSON.stringify(row.metadata) : null,
            UserId: row.user?.toString() || row.userId?.toString(),
            Timestamp: row.timestamp || row.createdAt || new Date()
        }));

        await migrateCollection(mongoDb, sqlPool, 'systemsettings', 'SystemSettings', row => ({
            Key: row.key,
            Value: row.value ? (typeof row.value === 'object' ? JSON.stringify(row.value) : row.value.toString()) : null,
            Description: row.description || '',
            CreatedAt: row.createdAt || new Date(),
            UpdatedAt: row.updatedAt || new Date()
        }));

        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`\n✨ Full Migration Completed in ${totalTime.toFixed(2)}s!`);

    } catch (err) {
        console.error('\n❌ CRITICAL MIGRATION ERROR:', err);
    } finally {
        await mongoClient.close();
        process.exit(0);
    }
}

async function migrateBulk(mongoDb, sqlPool, mongoCollName, sqlTableName, mapper) {
    console.log(`\n🚀 BULK Migrating ${mongoCollName} -> ${sqlTableName}...`);
    const collStartTime = Date.now();

    try {
        const collection = mongoDb.collection(mongoCollName);
        const count = await collection.countDocuments();

        if (count === 0) {
            console.log(`⚠️  Collection ${mongoCollName} is empty. Skipping.`);
            return;
        }

        const table = new sql.Table(sqlTableName);

        // Get table schema to define bulk columns
        const schemaResult = await sqlPool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = '${sqlTableName}'
            ORDER BY ORDINAL_POSITION
        `);

        for (const col of schemaResult.recordset) {
            // Skip identity columns
            if (col.COLUMN_NAME === 'Id' && (sqlTableName === 'AsinHistory' || sqlTableName === 'SystemLogs' || sqlTableName === 'AsinWeekHistory')) continue;

            let type;
            switch (col.DATA_TYPE) {
                case 'varchar': type = sql.VarChar(col.CHARACTER_MAXIMUM_LENGTH); break;
                case 'nvarchar': type = sql.NVarChar(col.CHARACTER_MAXIMUM_LENGTH === -1 ? sql.MAX : col.CHARACTER_MAXIMUM_LENGTH); break;
                case 'int': type = sql.Int; break;
                case 'bigint': type = sql.BigInt; break;
                case 'decimal': type = sql.Decimal(18, 4); break;
                case 'datetime2': type = sql.DateTime2; break;
                case 'datetime': type = sql.DateTime; break;
                case 'date': type = sql.Date; break;
                case 'bit': type = sql.Bit; break;
                default: type = sql.NVarChar(sql.MAX);
            }
            table.columns.add(col.COLUMN_NAME, type, { nullable: col.IS_NULLABLE === 'YES' });
        }

        const cursor = collection.find({});
        let processed = 0;
        const BATCH_SIZE = 2000;

        while (await cursor.hasNext()) {
            const batchTable = new sql.Table(sqlTableName);
            for (const col of table.columns) {
                batchTable.columns.add(col.name, col.type, { nullable: col.nullable });
            }

            for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
                const row = await cursor.next();
                const mapped = mapper(row);
                const rowValues = [];
                for (const col of batchTable.columns) {
                    rowValues.push(mapped[col.name] !== undefined ? mapped[col.name] : null);
                }
                batchTable.rows.add(...rowValues);
            }

            const request = new sql.Request(sqlPool);
            await request.bulk(batchTable);

            processed += batchTable.rows.length;
            const percentage = Math.round(processed / count * 100);
            process.stdout.write(`\r   ⏳ Progress: ${processed}/${count} (${percentage}%)`);
        }

        const duration = (Date.now() - collStartTime) / 1000;
        console.log(`\n✅ Finished ${sqlTableName} in ${duration.toFixed(2)}s.`);
    } catch (err) {
        console.error(`   ❌ Failed to bulk migrate ${mongoCollName}:`, err.message);
    }
}

async function migrateCollection(mongoDb, sqlPool, mongoCollName, sqlTableName, mapper) {
    console.log(`\n📦 Migrating ${mongoCollName} -> ${sqlTableName}...`);
    const collStartTime = Date.now();

    try {
        const collection = mongoDb.collection(mongoCollName);
        const count = await collection.countDocuments();

        if (count === 0) {
            console.log(`⚠️  Collection ${mongoCollName} is empty. Skipping.`);
            return { raw: [] };
        }

        const cursor = collection.find({});
        let processed = 0;
        const rawData = [];

        while (await cursor.hasNext()) {
            const row = await cursor.next();
            rawData.push(row);
            const mapped = mapper(row);

            try {
                const request = sqlPool.request();
                const columns = [];
                const values = [];

                for (const [key, val] of Object.entries(mapped)) {
                    const paramName = `p_${key.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    columns.push(`[${key}]`);
                    values.push(`@${paramName}`);

                    if (val instanceof Date) {
                        request.input(paramName, sql.DateTime2, val);
                    } else if (typeof val === 'number') {
                        if (Number.isInteger(val)) request.input(paramName, sql.Int, val);
                        else request.input(paramName, sql.Decimal(18, 4), val);
                    } else if (val === null || val === undefined) {
                        request.input(paramName, sql.NVarChar, null);
                    } else {
                        request.input(paramName, sql.NVarChar, val.toString());
                    }
                }

                const query = `
                    IF NOT EXISTS (SELECT 1 FROM ${sqlTableName} WHERE Id = @p_Id)
                    INSERT INTO ${sqlTableName} (${columns.join(', ')}) VALUES (${values.join(', ')})
                `;

                await request.query(query);
            } catch (err) { }

            processed++;
            if (processed % 10 === 0 || processed === count) {
                process.stdout.write(`\r   ⏳ Progress: ${processed}/${count} (${Math.round(processed / count * 100)}%)`);
            }
        }

        const duration = (Date.now() - collStartTime) / 1000;
        console.log(`\n✅ Finished ${sqlTableName} in ${duration.toFixed(2)}s.`);
        return { raw: rawData };
    } catch (err) {
        console.error(`   ❌ Failed to migrate ${mongoCollName}:`, err.message);
        return { raw: [] };
    }
}

migrate();
