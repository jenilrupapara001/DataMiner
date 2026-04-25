const mongoose = require('mongoose');
const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// SQL Config
const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

// MongoDB Models
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const Seller = require('../models/Seller');
const Asin = require('../models/Asin');
const Action = require('../models/Action');
const Goal = require('../models/Goal');
const Objective = require('../models/Objective');
const KeyResult = require('../models/KeyResult');
const AdsPerformance = require('../models/AdsPerformance');
const Order = require('../models/Order');

async function migrate() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🔄 Connecting to SQL Server...');
        await sql.connect(sqlConfig);
        console.log('✅ Connected to SQL Server');

        // 1. Migrate Permissions
        console.log('🚀 Migrating Permissions...');
        const permissions = await Permission.find().lean();
        for (const p of permissions) {
            await sql.query`
                IF NOT EXISTS (SELECT 1 FROM Permissions WHERE Id = ${p._id.toString()})
                INSERT INTO Permissions (Id, Name, DisplayName, Category, Action, Description, CreatedAt)
                VALUES (${p._id.toString()}, ${p.name}, ${p.displayName || null}, ${p.category || null}, ${p.action || null}, ${p.description || null}, ${p.createdAt || new Date()})
            `;
        }

        // 2. Migrate Roles
        console.log('🚀 Migrating Roles...');
        const roles = await Role.find().lean();
        for (const r of roles) {
            await sql.query`
                IF NOT EXISTS (SELECT 1 FROM Roles WHERE Id = ${r._id.toString()})
                INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
                VALUES (
                    ${r._id.toString()}, ${r.name}, ${r.displayName || null}, ${r.description || null}, 
                    ${r.level || 0}, ${r.color || '#4F46E5'}, ${r.isSystem ? 1 : 0}, ${r.isActive !== false ? 1 : 0}, 
                    ${r.createdAt || new Date()}, ${r.updatedAt || new Date()}
                )
            `;
            
            // Migrate Role-Permission Junction
            if (r.permissions && r.permissions.length > 0) {
                for (const pId of r.permissions) {
                    await sql.query`
                        IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE RoleId = ${r._id.toString()} AND PermissionId = ${pId.toString()})
                        INSERT INTO RolePermissions (RoleId, PermissionId)
                        VALUES (${r._id.toString()}, ${pId.toString()})
                    `;
                }
            }
        }

        // 3. Migrate Users
        console.log('🚀 Migrating Users...');
        const users = await User.find().lean();
        for (const u of users) {
            await sql.query`
                IF NOT EXISTS (SELECT 1 FROM Users WHERE Id = ${u._id.toString()})
                INSERT INTO Users (Id, Email, Password, FirstName, LastName, Avatar, RoleId, IsEmailVerified, IsActive, IsOnline, LastSeen, Preferences, CreatedAt, UpdatedAt)
                VALUES (
                    ${u._id.toString()}, ${u.email}, ${u.password}, ${u.firstName || null}, ${u.lastName || null}, ${u.avatar || null}, 
                    ${u.role ? u.role.toString() : null}, ${u.isEmailVerified ? 1 : 0}, ${u.isActive !== false ? 1 : 0}, 
                    ${u.isOnline ? 1 : 0}, ${u.lastSeen || null}, ${u.preferences ? JSON.stringify(u.preferences) : null}, 
                    ${u.createdAt || new Date()}, ${u.updatedAt || new Date()}
                )
            `;
        }

        // 3b. Migrate User-Supervisor Junction (after all users are in)
        console.log('🚀 Migrating User-Supervisor relationships...');
        for (const u of users) {
            if (u.supervisors && u.supervisors.length > 0) {
                for (const sId of u.supervisors) {
                    // Ensure supervisor exists in Users table
                    const supervisorExists = await sql.query`SELECT 1 FROM Users WHERE Id = ${sId.toString()}`;
                    if (supervisorExists.recordset.length > 0) {
                        await sql.query`
                            IF NOT EXISTS (SELECT 1 FROM UserSupervisors WHERE UserId = ${u._id.toString()} AND SupervisorId = ${sId.toString()})
                            INSERT INTO UserSupervisors (UserId, SupervisorId)
                            VALUES (${u._id.toString()}, ${sId.toString()})
                        `;
                    } else {
                        console.warn(`⚠️ Skipping supervisor ${sId} for user ${u.email} as supervisor does not exist.`);
                    }
                }
            }
        }

        // 4. Migrate Sellers
        console.log('🚀 Migrating Sellers...');
        const sellers = await Seller.find().lean();
        for (const s of sellers) {
            const octoId = s.marketSyncTaskId ? s.marketSyncTaskId.toString() : null;
            const sellerId = s._id.toString();

            const existing = await sql.query`SELECT 1 FROM Sellers WHERE Id = ${sellerId}`;
            if (existing.recordset.length > 0) {
                await sql.query`
                    UPDATE Sellers SET 
                        Name = ${s.name}, 
                        Marketplace = ${s.marketplace || null}, 
                        SellerId = ${s.sellerId || null}, 
                        OctoparseId = ${octoId}, 
                        IsActive = ${s.status === 'Active' ? 1 : 0}, 
                        [Plan] = ${s.plan || 'Starter'}, 
                        ScrapeLimit = ${s.scrapeLimit || 100}, 
                        ScrapeUsed = ${s.scrapeUsed || 0}, 
                        LastScrapedAt = ${s.lastScraped || null},
                        OctoparseConfig = ${s.marketSyncUrls ? JSON.stringify({ urls: s.marketSyncUrls }) : null},
                        UpdatedAt = ${s.updatedAt || new Date()}
                    WHERE Id = ${sellerId}
                `;
            } else {
                await sql.query`
                    INSERT INTO Sellers (
                        Id, Name, Marketplace, SellerId, OctoparseId, IsActive, 
                        [Plan], ScrapeLimit, ScrapeUsed, LastScrapedAt,
                        OctoparseConfig, KeepaConfig, CreatedAt, UpdatedAt
                    )
                    VALUES (
                        ${sellerId}, ${s.name}, ${s.marketplace || null}, ${s.sellerId || null}, ${octoId},
                        ${s.status === 'Active' ? 1 : 0}, 
                        ${s.plan || 'Starter'}, ${s.scrapeLimit || 100}, ${s.scrapeUsed || 0}, ${s.lastScraped || null},
                        ${s.marketSyncUrls ? JSON.stringify({ urls: s.marketSyncUrls }) : null}, 
                        ${null}, 
                        ${s.createdAt || new Date()}, ${s.updatedAt || new Date()}
                    )
                `;
            }

            // Migrate User-Seller Junction
            const usersWithSeller = await User.find({ assignedSellers: s._id }).lean();
            for (const u of usersWithSeller) {
                await sql.query`
                    IF NOT EXISTS (SELECT 1 FROM UserSellers WHERE UserId = ${u._id.toString()} AND SellerId = ${s._id.toString()})
                    INSERT INTO UserSellers (UserId, SellerId)
                    VALUES (${u._id.toString()}, ${s._id.toString()})
                `;
            }
        }

        /* 
        // 5. Migrate Asins (Skipped as per user request - too large)
        console.log('🚀 Migrating Asins (and history)...');
        const asins = await Asin.find().lean();
        for (const a of asins) {
            await sql.query`
                IF NOT EXISTS (SELECT 1 FROM Asins WHERE Id = ${a._id.toString()})
                INSERT INTO Asins (
                    Id, AsinCode, SellerId, Status, ScrapeStatus, Category, Brand, Title, ImageUrl, 
                    CurrentPrice, BSR, Rating, ReviewCount, LQS, LqsDetails, CdqComponents, 
                    FeePreview, BuyBoxStatus, LastScrapedAt, CreatedAt, UpdatedAt
                )
                VALUES (
                    ${a._id.toString()}, ${a.asinCode}, ${a.seller ? a.seller.toString() : null}, 
                    ${a.status}, ${a.scrapeStatus}, ${a.category}, ${a.brand}, ${a.title}, ${a.imageUrl},
                    ${a.currentPrice}, ${a.bsr}, ${a.rating}, ${a.reviewCount}, ${a.lqs},
                    ${a.lqsDetails ? JSON.stringify(a.lqsDetails) : null}, 
                    ${a.cdqComponents ? JSON.stringify(a.cdqComponents) : null},
                    ${a.feePreview ? JSON.stringify(a.feePreview) : null},
                    ${a.buyBoxStatus ? 1 : 0}, ${a.lastScrapedAt},
                    ${a.createdAt || new Date()}, ${a.updatedAt || new Date()}
                )
            `;

            // Migrate weekHistory
            if (a.weekHistory && a.weekHistory.length > 0) {
                for (const wh of a.weekHistory) {
                    await sql.query`
                        INSERT INTO AsinWeekHistory (AsinId, WeekStartDate, AvgPrice, AvgBSR, AvgRating, TotalReviews)
                        VALUES (${a._id.toString()}, ${wh.date || new Date()}, ${wh.price}, ${wh.bsr}, ${wh.rating}, ${wh.reviews})
                    `;
                }
            }

            // Migrate daily history
            if (a.history && a.history.length > 0) {
                for (const h of a.history) {
                    await sql.query`
                        INSERT INTO AsinHistory (AsinId, Date, Price, BSR, Rating, ReviewCount)
                        VALUES (${a._id.toString()}, ${h.date}, ${h.price}, ${h.bsr}, ${h.rating}, ${h.reviewCount})
                    `;
                }
            }
        }
        */

        // 6. Migrate OKRs
        console.log('🚀 Migrating OKRs...');
        const goals = await Goal.find().lean();
        for (const g of goals) {
            await sql.query`
                IF NOT EXISTS (SELECT 1 FROM Goals WHERE Id = ${g._id.toString()})
                INSERT INTO Goals (Id, Title, Description, OwnerId, StartDate, EndDate, Status, Progress, CreatedAt, UpdatedAt)
                VALUES (${g._id.toString()}, ${g.title}, ${g.description}, ${g.owner ? g.owner.toString() : null}, ${g.startDate}, ${g.endDate}, ${g.status}, ${g.progress}, ${g.createdAt}, ${g.updatedAt})
            `;
        }

        const objectives = await Objective.find().lean();
        for (const o of objectives) {
            if (o.goal) {
                const goalId = o.goal.toString();
                const goalExists = await sql.query`SELECT 1 FROM Goals WHERE Id = ${goalId}`;
                if (goalExists.recordset.length > 0) {
                    try {
                        await sql.query`
                            IF NOT EXISTS (SELECT 1 FROM Objectives WHERE Id = ${o._id.toString()})
                            INSERT INTO Objectives (Id, GoalId, Title, Description, OwnerId, Status, Progress, CreatedAt, UpdatedAt)
                            VALUES (${o._id.toString()}, ${goalId}, ${o.title}, ${o.description}, ${o.owner ? o.owner.toString() : null}, ${o.status}, ${o.progress}, ${o.createdAt || new Date()}, ${o.updatedAt || new Date()})
                        `;
                    } catch (e) {
                        console.error(`❌ Failed to migrate objective ${o._id}: ${e.message}`);
                    }
                } else {
                    console.warn(`⚠️ Skipping objective ${o._id} as goal ${goalId} does not exist in SQL.`);
                }
            } else {
                console.warn(`⚠️ Skipping objective ${o._id} as it has no goal assigned.`);
            }
        }

        const krs = await KeyResult.find().lean();
        for (const k of krs) {
            if (k.objective) {
                const objectiveId = k.objective.toString();
                const objExists = await sql.query`SELECT 1 FROM Objectives WHERE Id = ${objectiveId}`;
                if (objExists.recordset.length > 0) {
                    try {
                        await sql.query`
                            IF NOT EXISTS (SELECT 1 FROM KeyResults WHERE Id = ${k._id.toString()})
                            INSERT INTO KeyResults (Id, ObjectiveId, Title, Description, OwnerId, Status, CurrentValue, TargetValue, Unit, Progress, CreatedAt, UpdatedAt)
                            VALUES (${k._id.toString()}, ${objectiveId}, ${k.title}, ${k.description}, ${k.owner ? k.owner.toString() : null}, ${k.status}, ${k.currentValue}, ${k.targetValue}, ${k.unit}, ${k.progress}, ${k.createdAt || new Date()}, ${k.updatedAt || new Date()})
                        `;
                    } catch (e) {
                        console.error(`❌ Failed to migrate key result ${k._id}: ${e.message}`);
                    }
                } else {
                    console.warn(`⚠️ Skipping key result ${k._id} as objective ${objectiveId} does not exist in SQL.`);
                }
            } else {
                console.warn(`⚠️ Skipping key result ${k._id} as it has no objective assigned.`);
            }
        }

        /*
        // 7. Migrate Actions
        console.log('🚀 Migrating Actions...');
        const actions = await Action.find().lean();
        for (const ac of actions) {
            await sql.query`
                IF NOT EXISTS (SELECT 1 FROM Actions WHERE Id = ${ac._id.toString()})
                INSERT INTO Actions (
                    Id, Title, Description, Status, Priority, Type, CreatedBy, AssignedTo, 
                    SellerId, GoalId, ObjectiveId, KeyResultId, DueDate, CompletedAt, CreatedAt, UpdatedAt
                )
                VALUES (
                    ${ac._id.toString()}, ${ac.title}, ${ac.description}, ${ac.status}, ${ac.priority}, ${ac.type},
                    ${ac.createdBy ? ac.createdBy.toString() : null}, ${ac.assignedTo ? ac.assignedTo.toString() : null},
                    ${ac.seller ? ac.seller.toString() : null}, ${ac.goal ? ac.goal.toString() : null},
                    ${ac.objective ? ac.objective.toString() : null}, ${ac.keyResult ? ac.keyResult.toString() : null},
                    ${ac.dueDate}, ${ac.completedAt}, ${ac.createdAt}, ${ac.updatedAt}
                )
            `;

            if (ac.stage && ac.stage.history) {
                for (const h of ac.stage.history) {
                    await sql.query`
                        INSERT INTO ActionHistory (ActionId, StatusFrom, StatusTo, ChangedBy, ChangedAt, Comment)
                        VALUES (${ac._id.toString()}, ${h.from}, ${h.to}, ${h.by ? h.by.toString() : null}, ${h.at}, ${h.comment})
                    `;
                }
            }
        }
        */

        /*
        // 8. AdsPerformance & Orders (Time-series data)
        console.log('🚀 Migrating AdsPerformance...');
        const ads = await AdsPerformance.find().lean();
        for (const ad of ads) {
            await sql.query`
                INSERT INTO AdsPerformance (
                    Asin, AdvertisedSku, Date, Month, ReportType, AdSpend, AdSales, Impressions, 
                    Clicks, Orders, ACoS, RoAS, CTR, CPC, ConversionRate, OrganicSales, OrganicOrders, Sessions, UploadedAt
                )
                VALUES (
                    ${ad.asin}, ${ad.advertised_sku}, ${ad.date}, ${ad.month}, ${ad.reportType},
                    ${ad.ad_spend}, ${ad.ad_sales}, ${ad.impressions}, ${ad.clicks}, ${ad.orders},
                    ${ad.acos}, ${ad.roas}, ${ad.ctr}, ${ad.cpc}, ${ad.conversion_rate},
                    ${ad.organic_sales}, ${ad.organic_orders}, ${ad.sessions}, ${ad.uploaded_at}
                )
            `;
        }

        console.log('🚀 Migrating Orders...');
        const orders = await Order.find().lean();
        for (const ord of orders) {
            await sql.query`
                IF NOT EXISTS (SELECT 1 FROM Orders WHERE Asin = ${ord.asin} AND Date = ${ord.date})
                INSERT INTO Orders (Asin, Sku, Date, Units, Revenue, Returns, Currency, Marketplace, Source, CreatedAt, UpdatedAt)
                VALUES (${ord.asin}, ${ord.sku}, ${ord.date}, ${ord.units}, ${ord.revenue}, ${ord.returns}, ${ord.currency}, ${ord.marketplace}, ${ord.source}, ${ord.createdAt}, ${ord.updatedAt})
            `;
        }
        */

        console.log('✨ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await mongoose.connection.close();
        await sql.close();
    }
}

migrate();
