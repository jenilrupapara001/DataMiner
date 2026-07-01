/**
 * PEMS V2 Demo Seed Script
 * Creates templates + task instances with SOP for demo
 */
const { sql, getPool } = require('../../database/db');
const pemsService = require('../../services/pems/pemsService');

async function seedDemo() {
  console.log('🌱 Seeding PEMS demo data...');

  const pool = await getPool();

  const existing = await pool.request().query('SELECT COUNT(*) as c FROM PemsTaskTemplates');
  const instCheck = await pool.request().query('SELECT COUNT(*) as c FROM PemsTaskInstances');
  if (instCheck.recordset[0].c >= 3) {
    console.log('  Demo data already seeded, skipping.');
    return { message: 'Data already seeded', templates: existing.recordset[0].c };
  }

  // Fetch specific sellers
  const sellerIds = [
    '01a792a381134350842fab46', '0700e608b34f4250bab7b191', '1216fe9a57f942e29eeb37e8',
    '126ee8bbe8a64506921dfce0', '164b8c59d93e46809656efd7', '1c1a33a2fdd2446390fa7262',
    '1cbef3e026ae4b9db6bcc122', '29cd6e9a98a04feca0fe7908', '3ae26bace56b499b97cc3ced',
    '4021b4e425bf49bd912b23a8', '41ec63f2ce354edb88500330', '4ea5f807ac82476781e1e790'
  ];

  const placeholders = sellerIds.map((_, i) => `@s${i}`).join(',');
  const sellerReq = pool.request();
  sellerIds.forEach((id, i) => sellerReq.input(`s${i}`, sql.VarChar, id));
  const sellerResult = await sellerReq.query(`SELECT Id, Name FROM Sellers WHERE Id IN (${placeholders})`);
  const sellers = sellerResult.recordset;
  console.log(`  Found ${sellers.length} sellers`);

  if (sellers.length === 0) {
    console.log('  No matching sellers found, aborting seed.');
    return { message: 'No sellers found' };
  }

  // Fetch brand managers WITH their seller assignments
  const bmResult = await pool.request().query(`
    SELECT DISTINCT u.Id, u.FirstName, u.LastName, u.Email, us.SellerId
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId = r.Id
    LEFT JOIN UserSellers us ON u.Id = us.UserId
    WHERE r.Name IN ('brand_manager', 'admin', 'super_admin', 'operational_manager')
    AND us.SellerId IS NOT NULL
    ORDER BY u.FirstName
  `);
  const brandManagers = bmResult.recordset.map(u => ({
    ...u, FullName: `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email,
  }));
  console.log(`  Found ${brandManagers.length} brand manager-seller assignments`);

  // Build seller → brand manager mapping
  const sellerBMMap = {};
  brandManagers.forEach(bm => {
    if (!sellerBMMap[bm.SellerId]) sellerBMMap[bm.SellerId] = [];
    sellerBMMap[bm.SellerId].push(bm);
  });

  // Fetch reviewers
  const revResult = await pool.request().query(`
    SELECT TOP 4 u.Id, u.FirstName, u.LastName, u.Email
    FROM Users u LEFT JOIN Roles r ON u.RoleId = r.Id
    WHERE r.Name IN ('reviewer', 'operational_manager', 'admin', 'super_admin')
    ORDER BY NEWID()
  `);
  const reviewers = revResult.recordset.map(u => ({
    ...u, FullName: `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email,
  }));
  console.log(`  Found ${reviewers.length} reviewers`);

  // Default user for templates
  const defaultUser = brandManagers[0] || reviewers[0] || { Id: 'system', FullName: 'System' };

  // ── Templates ──
  const templates = [
    {
      name: 'Optimize Product Listings', category: 'LISTING', department: 'Operations',
      frequency: 'WEEKLY', slaHours: 48, tatHours: 24, priority: 'HIGH', targetType: 'NUMERIC', defaultTarget: 50,
      expectedOutput: 'Optimized listings with improved LQS scores',
      subTaskDefinitions: [
        { title: 'Keyword Research', activities: [
          { title: 'Download Search Query Report', instructions: 'Download last 30 days SQR report from Amazon Seller Central', expectedOutput: 'SQR Excel Report', validationRules: 'Report must contain at least 100 search terms', estimatedMinutes: 15 },
          { title: 'Identify High-Impact Keywords', instructions: 'Filter keywords by conversion rate > 15% and impressions > 1000', expectedOutput: 'Top 20 keywords list', validationRules: 'Keywords must be relevant to product category', estimatedMinutes: 20 },
          { title: 'Update Backend Search Terms', instructions: 'Update backend search terms with identified keywords', expectedOutput: 'Updated listing', validationRules: 'No competitor brand names allowed', estimatedMinutes: 10 },
        ]},
        { title: 'Image Optimization', activities: [
          { title: 'Audit Current Images', instructions: 'Check all images against Amazon image requirements', expectedOutput: 'Image audit report', validationRules: 'Minimum 7 images required', estimatedMinutes: 15 },
          { title: 'Upload Lifestyle Images', instructions: 'Create and upload 3 new lifestyle images', expectedOutput: '3 new images uploaded', validationRules: 'Images must be 2000x2000px minimum', estimatedMinutes: 30 },
        ]},
        { title: 'A+ Content Review', activities: [
          { title: 'Check A+ Content Status', instructions: 'Verify if A+ content is live and compliant', expectedOutput: 'A+ status report', validationRules: 'No policy violations', estimatedMinutes: 10 },
          { title: 'Update A+ Modules', instructions: 'Replace underperforming A+ modules with updated content', expectedOutput: 'Updated A+ content', validationRules: 'Follow Amazon A+ guidelines', estimatedMinutes: 45 },
        ]}
      ]
    },
    {
      name: 'Price & BuyBox Monitoring', category: 'PRICING', department: 'Brand Managers',
      frequency: 'DAILY', slaHours: 24, tatHours: 12, priority: 'CRITICAL', targetType: 'NUMERIC', defaultTarget: 30,
      expectedOutput: 'Price adjustment report with BuyBox status',
      subTaskDefinitions: [
        { title: 'Price Audit', activities: [
          { title: 'Export Current Price List', instructions: 'Export all ASIN prices from Seller Central', expectedOutput: 'Price CSV export', validationRules: 'Include all active ASINs', estimatedMinutes: 10 },
          { title: 'Compare with Competitors', instructions: 'Run price comparison against top 5 competitors per ASIN', expectedOutput: 'Competitive analysis sheet', validationRules: 'Include BuyBox winner info', estimatedMinutes: 25 },
          { title: 'Identify Price Disputes', instructions: 'Flag ASINs where our price differs from uploaded price by more than ₹5', expectedOutput: 'Price dispute list', validationRules: 'Include root cause for each dispute', estimatedMinutes: 15 },
        ]},
        { title: 'Action Items', activities: [
          { title: 'Adjust Prices', instructions: 'Update prices for ASINs losing BuyBox', expectedOutput: 'Updated price list', validationRules: 'Margin must stay above 15%', estimatedMinutes: 20 },
          { title: 'Submit Price Changes', instructions: 'Submit price changes via bulk upload or API', expectedOutput: 'Submission confirmation', validationRules: 'All changes must be logged', estimatedMinutes: 10 },
        ]}
      ]
    },
    {
      name: 'Inventory Health Check', category: 'INVENTORY', department: 'Catalog Team',
      frequency: 'WEEKLY', slaHours: 72, tatHours: 48, priority: 'MEDIUM', targetType: 'PERCENTAGE', defaultTarget: 95,
      expectedOutput: 'Inventory health report with restock recommendations',
      subTaskDefinitions: [
        { title: 'Stock Analysis', activities: [
          { title: 'Pull Inventory Report', instructions: 'Download current inventory levels from all warehouses', expectedOutput: 'Inventory snapshot', validationRules: 'Include FBA and FBF quantities', estimatedMinutes: 15 },
          { title: 'Calculate Days of Supply', instructions: 'Compute days of supply based on 30-day sales velocity', expectedOutput: 'DOS calculation sheet', validationRules: 'Flag items with DOS < 14', estimatedMinutes: 20 },
          { title: 'Identify Out-of-Stock Risks', instructions: 'Identify ASINs at risk of running out within 2 weeks', expectedOutput: 'Risk list with urgency', validationRules: 'Include estimated stockout date', estimatedMinutes: 15 },
        ]},
        { title: 'Replenishment Planning', activities: [
          { title: 'Create PO Requests', instructions: 'Generate purchase order requests for low-stock items', expectedOutput: 'PO draft', validationRules: 'MOQ compliance check required', estimatedMinutes: 30 },
          { title: 'Update Forecast', instructions: 'Update demand forecast based on current trends', expectedOutput: 'Updated forecast', validationRules: 'Include seasonal adjustments', estimatedMinutes: 20 },
        ]}
      ]
    },
    {
      name: 'Sponsored Ads Weekly Review', category: 'ADS', department: 'Brand Managers',
      frequency: 'WEEKLY', slaHours: 36, tatHours: 24, priority: 'HIGH', targetType: 'NUMERIC', defaultTarget: 20,
      expectedOutput: 'Ad optimization report with ACoS targets',
      subTaskDefinitions: [
        { title: 'Performance Analysis', activities: [
          { title: 'Pull Campaign Reports', instructions: 'Download last 7 days sponsored products report', expectedOutput: 'Campaign performance CSV', validationRules: 'Include all active campaigns', estimatedMinutes: 10 },
          { title: 'Analyze ACoS by Campaign', instructions: 'Calculate ACoS for each campaign and identify underperformers', expectedOutput: 'ACoS breakdown', validationRules: 'Flag campaigns with ACoS > 30%', estimatedMinutes: 25 },
          { title: 'Review Search Term Report', instructions: 'Identify negative keyword opportunities', expectedOutput: 'Negative keyword list', validationRules: 'At least 10 negative keywords per campaign', estimatedMinutes: 20 },
        ]},
        { title: 'Optimization', activities: [
          { title: 'Adjust Bids', instructions: 'Increase bids on high-converting keywords, decrease on low performers', expectedOutput: 'Bid adjustment log', validationRules: 'Max bid increase 20% per day', estimatedMinutes: 30 },
          { title: 'Add Negative Keywords', instructions: 'Apply negative keywords to reduce wasted spend', expectedOutput: 'Updated campaign structure', validationRules: 'Do not negate brand terms', estimatedMinutes: 15 },
        ]}
      ]
    },
    {
      name: 'Competitor Analysis', category: 'ANALYTICS', department: 'Brand Managers',
      frequency: 'MONTHLY', slaHours: 120, tatHours: 72, priority: 'MEDIUM', targetType: 'QUALITATIVE', defaultTarget: 0,
      expectedOutput: 'Competitor intelligence report',
      subTaskDefinitions: [
        { title: 'Data Collection', activities: [
          { title: 'Scrape Competitor Listings', instructions: 'Collect data on top 5 competitors for each ASIN', expectedOutput: 'Competitor data sheet', validationRules: 'Include price, BSR, reviews, images', estimatedMinutes: 45 },
          { title: 'Analyze Pricing Trends', instructions: 'Track competitor pricing patterns over last 30 days', expectedOutput: 'Pricing trend analysis', validationRules: 'Include historical data points', estimatedMinutes: 30 },
        ]},
        { title: 'Strategy Development', activities: [
          { title: 'Identify Gaps', instructions: 'Find gaps in competitor listings that we can exploit', expectedOutput: 'Gap analysis report', validationRules: 'Include actionable recommendations', estimatedMinutes: 40 },
          { title: 'Create Action Plan', instructions: 'Develop response strategy for competitor moves', expectedOutput: 'Action plan document', validationRules: 'Include timeline and responsible parties', estimatedMinutes: 30 },
        ]}
      ]
    },
    {
      name: 'Returns Monitoring', category: 'GENERAL', department: 'Operations',
      frequency: 'DAILY', slaHours: 24, tatHours: 12, priority: 'HIGH', targetType: 'NUMERIC', defaultTarget: 10,
      expectedOutput: 'Returns analysis and action plan',
      subTaskDefinitions: [
        { title: 'Data Pull', activities: [
          { title: 'Download Returns Report', instructions: 'Export last 24h returns data from Seller Central', expectedOutput: 'Returns CSV', validationRules: 'Include return reason codes', estimatedMinutes: 10 },
          { title: 'Categorize Returns', instructions: 'Group returns by reason code and identify patterns', expectedOutput: 'Return category breakdown', validationRules: 'Include top 5 reasons', estimatedMinutes: 20 },
        ]},
        { title: 'Resolution', activities: [
          { title: 'Escalate Quality Issues', instructions: 'Flag products with return rate > 5% for quality review', expectedOutput: 'Escalation list', validationRules: 'Include ASIN, return count, and reason', estimatedMinutes: 15 },
        ]}
      ]
    },
    {
      name: 'Brand Growth Plan', category: 'GENERAL', department: 'Brand Managers',
      frequency: 'QUARTERLY', slaHours: 240, tatHours: 120, priority: 'HIGH', targetType: 'PERCENTAGE', defaultTarget: 15,
      expectedOutput: 'Quarterly brand growth report with targets',
      subTaskDefinitions: [
        { title: 'Performance Review', activities: [
          { title: 'Analyze Sales Trends', instructions: 'Review quarter-over-quarter sales performance across all ASINs', expectedOutput: 'Sales trend report', validationRules: 'Include YoY comparison', estimatedMinutes: 60 },
          { title: 'Review Ad Spend ROI', instructions: 'Calculate ROAS for each campaign type', expectedOutput: 'Ad ROI dashboard', validationRules: 'Include total spend vs revenue', estimatedMinutes: 45 },
        ]},
        { title: 'Planning', activities: [
          { title: 'Set Next Quarter Targets', instructions: 'Define revenue and growth targets for next quarter', expectedOutput: 'Target document', validationRules: 'Targets must be SMART', estimatedMinutes: 30 },
          { title: 'Create Action Items', instructions: 'Break targets into actionable weekly tasks', expectedOutput: 'Action item list', validationRules: 'Each item must have owner and deadline', estimatedMinutes: 30 },
        ]}
      ]
    },
  ];

  // ── Create Templates ──
  const createdTemplates = [];
  for (const tpl of templates) {
    const result = await pemsService.createTemplate({
      ...tpl,
      isActive: true,
      createdBy: defaultUser.Id,
    });
    createdTemplates.push(result);
  }
  console.log(`  Created ${createdTemplates.length} templates`);

  // ── Create Task Instances ──
  const statuses = ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DRAFT', 'ACCEPTED', 'REJECTED'];
  const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'HIGH', 'CRITICAL', 'MEDIUM', 'LOW', 'HIGH', 'MEDIUM', 'CRITICAL', 'LOW'];
  const taskNames = [
    'Optimize Wireless Earbuds listings', 'Monitor Air Purifier BuyBox pricing',
    'Audit Kitchen Scale inventory levels', 'Review Smart Watch ad campaigns',
    'Analyze Yoga Mat competitor landscape', 'Monitor Security Camera return rates',
    'Create Brand Growth Plan for Q3', 'Optimize Speaker System listings',
    'Monitor LED Bulb pricing across sellers', 'Audit Phone Case inventory status',
    'Review Laptop Backpack ad performance', 'Check Headphone BuyBox status',
    'Optimize Camera Lens listing content', 'Monitor Blender pricing daily',
    'Audit Travel Bag stock levels', 'Review Smart Home Hub campaigns',
    'Analyze Fitness Tracker competitor pricing', 'Check Power Bank BuyBox status',
    'Optimize Tablet Case listings for SEO', 'Monitor Router pricing trends',
    'Audit Mouse inventory health', 'Review Keyboard ad spend ROI',
    'Create Quarterly Brand Review', 'Check Speaker quality return rates',
  ];

  const instanceCount = Math.min(sellers.length * 2, taskNames.length);
  for (let i = 0; i < instanceCount; i++) {
    const tpl = createdTemplates[i % createdTemplates.length];
    const seller = sellers[i % sellers.length];
    
    // Get brand manager assigned to THIS seller
    const sellerBMs = sellerBMMap[seller.Id] || [];
    const bm = sellerBMs[i % sellerBMs.length] || defaultUser;
    const reviewer = reviewers[i % reviewers.length] || defaultUser;
    const status = statuses[i % statuses.length];
    const priority = priorities[i % priorities.length];
    const targetsArr = [50, 30, 95, 20, 100, 40, 75, 60, 25, 80, 150, 45];
    const achievementPcts = [100, 0, 85, 60, 0, 100, 75, 40, 90, 0, 55, 100, 30, 80, 0, 65, 100, 45, 70, 20, 95, 0, 88, 50];
    const target = targetsArr[i % targetsArr.length];
    const achievementPct = achievementPcts[i % achievementPcts.length];
    const achievement = Math.round(target * achievementPct / 100);
    const progressPcts = [100, 75, 100, 50, 0, 100, 100, 25, 80, 0, 60, 100, 15, 90, 0, 40, 100, 30, 55, 10, 100, 0, 85, 35];

    const instance = await pemsService.createInstance({
      templateId: tpl.id,
      title: taskNames[i],
      sellerId: seller.Id,
      sellerName: seller.Name,
      assignedTo: bm.Id,
      assigneeName: bm.FullName,
      reviewerId: reviewer.Id,
      reviewerName: reviewer.FullName,
      department: ['Operations', 'Brand Managers', 'Catalog Team'][i % 3],
      status,
      priority,
      target,
      frequency: i < 4 ? 'WEEKLY' : i < 8 ? 'DAILY' : 'MONTHLY',
      slaHours: [24, 48, 72, 36][i % 4],
    });

    // Update achievement and progress
    const pool = await getPool();
    await pool.request()
      .input('id', sql.VarChar, instance.id)
      .input('achievement', sql.Decimal(18, 2), achievement)
      .input('achievementPct', sql.Decimal(7, 2), achievementPct)
      .input('progressPct', sql.Decimal(5, 2), progressPcts[i % progressPcts.length])
      .query(`UPDATE PemsTaskInstances 
        SET Achievement = @achievement, AchievementPct = @achievementPct, 
        ProgressPct = @progressPct,
        Variance = @achievement - Target
        WHERE Id = @id`);
  }
  console.log(`  Created ${instanceCount} task instances with achievement data`);

  const tplCount = await pool.request().query('SELECT COUNT(*) as c FROM PemsTaskTemplates');
  const instCount = await pool.request().query('SELECT COUNT(*) as c FROM PemsTaskInstances');
  console.log(`  ✅ Total: ${tplCount.recordset[0].c} templates, ${instCount.recordset[0].c} instances`);
  return { success: true, templates: tplCount.recordset[0].c, instances: instCount.recordset[0].c };
}

module.exports = { seedDemo };
