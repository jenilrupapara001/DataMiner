const { sql, getPool, generateId } = require('../database/db');

const SEED_TAGS = [
  // Performance
  { name: 'Best Seller', category: 'Performance' },
  { name: 'Low Margin', category: 'Performance' },
  { name: 'High Margin', category: 'Performance' },
  { name: 'Needs Optimization', category: 'Performance' },
  { name: 'Suppressed', category: 'Performance' },
  // Content
  { name: 'A+ Content Missing', category: 'Content' },
  { name: 'Low LQS', category: 'Content' },
  { name: 'Title Needs Work', category: 'Content' },
  { name: 'Bullet Points Missing', category: 'Content' },
  { name: 'Images Low', category: 'Content' },
  { name: 'Description Short', category: 'Content' },
  // BuyBox
  { name: 'BuyBox Lost', category: 'BuyBox' },
  { name: 'BuyBox Won', category: 'BuyBox' },
  { name: 'Price Drop', category: 'BuyBox' },
  { name: 'Price Increase', category: 'BuyBox' },
  // Lifecycle
  { name: 'New Launch', category: 'Lifecycle' },
  { name: 'New 30D', category: 'Lifecycle' },
  { name: '30-60 Days', category: 'Lifecycle' },
  { name: '60-90 Days', category: 'Lifecycle' },
  { name: '90-180 Days', category: 'Lifecycle' },
  { name: '180-365 Days', category: 'Lifecycle' },
  { name: '365+ Days', category: 'Lifecycle' },
  { name: 'Growth Phase', category: 'Lifecycle' },
  { name: 'Established', category: 'Lifecycle' },
  { name: 'Mature', category: 'Lifecycle' },
  { name: 'Veteran', category: 'Lifecycle' },
  { name: 'Legacy', category: 'Lifecycle' },
  // Risk
  { name: 'MAP Violation', category: 'Risk' },
  { name: 'Hijacker Alert', category: 'Risk' },
  { name: 'Inventory Low', category: 'Risk' },
  { name: 'Out of Stock', category: 'Risk' },
  { name: 'Review Alert', category: 'Risk' },
  { name: 'Competitor Alert', category: 'Risk' },
  // Ads
  { name: 'Ad Active', category: 'Ads' },
  { name: 'No Ads', category: 'Ads' },
  // Opportunity
  { name: 'High Potential', category: 'Opportunity' },
  { name: 'Trending Up', category: 'Opportunity' },
  { name: 'Trending Down', category: 'Opportunity' },
  { name: 'Seasonal', category: 'Opportunity' },
  { name: 'Clearance', category: 'Opportunity' },
  { name: 'Replenishment', category: 'Opportunity' },
  { name: 'Discontinued', category: 'Opportunity' }
];

async function migrate() {
    try {
        const pool = await getPool();
        console.log('Connected to database. Running PredefinedTags table migration...');

        // 1. Create PredefinedTags table
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PredefinedTags')
            BEGIN
                CREATE TABLE PredefinedTags (
                    Id VARCHAR(24) PRIMARY KEY,
                    Name NVARCHAR(80) NOT NULL UNIQUE,
                    Category NVARCHAR(50) DEFAULT 'General',
                    CreatedAt DATETIME2 DEFAULT GETDATE(),
                    UpdatedAt DATETIME2 DEFAULT GETDATE()
                );
                
                CREATE INDEX IX_PredefinedTags_Category ON PredefinedTags(Category);
                PRINT 'PredefinedTags table created successfully';
            END
            ELSE
            BEGIN
                PRINT 'PredefinedTags table already exists';
            END
        `);

        // 2. Seed PredefinedTags table
        console.log('Checking and seeding default predefined tags...');
        let seeded = 0;
        let existed = 0;
        
        for (const tag of SEED_TAGS) {
            const checkRes = await pool.request()
                .input('name', sql.NVarChar, tag.name)
                .query('SELECT 1 FROM PredefinedTags WHERE Name = @name');
                
            if (checkRes.recordset.length === 0) {
                const id = generateId();
                await pool.request()
                    .input('id', sql.VarChar, id)
                    .input('name', sql.NVarChar, tag.name)
                    .input('category', sql.NVarChar, tag.category)
                    .query(`
                        INSERT INTO PredefinedTags (Id, Name, Category, CreatedAt, UpdatedAt)
                        VALUES (@id, @name, @category, GETDATE(), GETDATE())
                    `);
                seeded++;
            } else {
                existed++;
            }
        }
        
        console.log(`Seeding complete: ${seeded} new tags seeded, ${existed} tags already existed.`);
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
