const { sql, getPool, generateId } = require('../database/db');
const XLSX = require('xlsx');
const fs = require('fs');
const { logTagChange } = require('./tagsHistoryController');

// Default tags
const DEFAULT_TAGS = [
    'Best Seller', 'Low Margin', 'High Margin', 'Needs Optimization',
    'A+ Content Missing', 'Low LQS', 'BuyBox Lost', 'Price Drop',
    '30Days', '60 Days', '90Days', '180 Days', '365 Days', '365 + Days',
    'Seasonal', 'Clearance', 'Replenishment',
    'Ad Active', 'No Ads', 'Review Alert', 'Competitor Alert',
    'MAP Violation', 'Hijacker Alert', 'Inventory Low', 'Out of Stock'
];

/**
 * Get all available tags
 * GET /api/asins/tags
 */
exports.getTags = async (req, res) => {
    try {
        const pool = await getPool();
        
        // Fetch predefined tags from database
        let currentDefaultTags = [...DEFAULT_TAGS];
        try {
            const predefinedResult = await pool.request().query('SELECT Name FROM PredefinedTags ORDER BY Category, Name');
            if (predefinedResult.recordset.length > 0) {
                currentDefaultTags = predefinedResult.recordset.map(r => r.Name);
            }
        } catch (dbErr) {
            console.error('Failed to fetch predefined tags from database:', dbErr.message);
        }

        const result = await pool.request().query(`
            SELECT Tags FROM Asins WHERE Tags IS NOT NULL AND Tags != '[]' AND Tags != ''
        `);
        
        const usedTags = new Set();
        result.recordset.forEach(row => {
            try {
                const tags = JSON.parse(row.Tags);
                if (Array.isArray(tags)) {
                    tags.forEach(t => { if (t && t.trim()) usedTags.add(t.trim()); });
                }
            } catch (e) {}
        });
        
        res.json({
            success: true,
            data: {
                default: currentDefaultTags,
                used: [...usedTags],
                all: [...new Set([...currentDefaultTags, ...usedTags])].sort()
            }
        });
    } catch (error) {
        console.error('getTags error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Update tags for a single ASIN with audit logging
 * PUT /api/asins/:asinId/tags
 */
exports.updateAsinTags = async (req, res) => {
    try {
        const { asinId } = req.params;
        const { tags } = req.body;
        const userId = (req.user?.Id || req.user?._id || req.user?.id || '').toString();
        const firstName = req.user?.FirstName || req.user?.firstName || '';
        const lastName = req.user?.LastName || req.user?.lastName || '';
        const email = req.user?.Email || req.user?.email || '';
        const userName = firstName 
            ? `${firstName} ${lastName}`.trim() 
            : (email || 'Unknown User');
        
        if (!asinId) {
            return res.status(400).json({ success: false, error: 'ASIN ID required' });
        }

        const pool = await getPool();

        // Get current tags BEFORE update
        const currentResult = await pool.request()
            .input('id', sql.VarChar, asinId)
            .query('SELECT Tags FROM Asins WHERE Id = @id');

        if (currentResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'ASIN not found' });
        }

        let currentTags = [];
        try { 
            currentTags = JSON.parse(currentResult.recordset[0].Tags || '[]'); 
        } catch { 
            currentTags = []; 
        }

        const newTags = Array.isArray(tags) ? tags : [];

        // Only log if tags actually changed
        const currentSorted = [...currentTags].sort().join(',');
        const newSorted = [...newTags].sort().join(',');
        
        if (currentSorted !== newSorted) {
            // Save new tags
            await pool.request()
                .input('id', sql.VarChar, asinId)
                .input('tags', sql.NVarChar, JSON.stringify(newTags))
                .query('UPDATE Asins SET Tags = @tags, UpdatedAt = DATEADD(minute, 330, GETUTCDATE()) WHERE Id = @id');

            // Log the change
            await logTagChange(asinId, currentTags, newTags, userId, userName, 'manual');
        }

        res.json({ 
            success: true, 
            message: 'Tags updated', 
            tags: newTags,
            changed: currentSorted !== newSorted
        });
    } catch (error) {
        console.error('updateAsinTags Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Bulk update tags via CSV with audit logging
 * POST /api/asins/tags/bulk-upload
 */
exports.bulkUpdateTagsCSV = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const sellerId = req.body.sellerId || '';
        const userId = (req.user?.Id || req.user?._id || req.user?.id || '').toString();
        const firstName = req.user?.FirstName || req.user?.firstName || '';
        const lastName = req.user?.LastName || req.user?.lastName || '';
        const email = req.user?.Email || req.user?.email || '';
        const userName = firstName 
            ? `${firstName} ${lastName}`.trim() 
            : (email || 'Unknown User');
        
        const filePath = req.file.path;
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        
        if (data.length === 0) {
            try { fs.unlinkSync(filePath); } catch (e) {}
            return res.status(400).json({ success: false, error: 'Empty file' });
        }
        
        const pool = await getPool();
        let updated = 0;
        let skipped = 0;
        const errors = [];
        
        for (const row of data) {
            const asinCode = (row['Child ASIN'] || row['ASIN'] || row['asinCode'] || row['asin'] || '').toString().trim();
            const tagsStr = (row['Tags'] || row['tags'] || '').toString().trim();
            
            if (!asinCode) {
                skipped++;
                continue;
            }
            
            const newTags = tagsStr ? tagsStr.split(/[,|;]/).map(t => t.trim()).filter(Boolean) : [];
            
            try {
                // Fetch current ASIN and tags to log diff
                let selectQuery = 'SELECT Id, Tags FROM Asins WHERE AsinCode = @asinCode';
                const selectRequest = pool.request().input('asinCode', sql.VarChar, asinCode);
                
                if (sellerId) {
                    selectQuery += ' AND SellerId = @sellerId';
                    selectRequest.input('sellerId', sql.VarChar, sellerId);
                }
                
                const currentResult = await selectRequest.query(selectQuery);
                
                if (currentResult.recordset.length > 0) {
                    const asin = currentResult.recordset[0];
                    let currentTags = [];
                    try { currentTags = JSON.parse(asin.Tags || '[]'); } catch { currentTags = []; }
                    
                    const currentSorted = [...currentTags].sort().join(',');
                    const newSorted = [...newTags].sort().join(',');
                    
                    if (currentSorted !== newSorted) {
                        await pool.request()
                            .input('id', sql.VarChar, asin.Id)
                            .input('tags', sql.NVarChar, JSON.stringify(newTags))
                            .query('UPDATE Asins SET Tags = @tags, UpdatedAt = DATEADD(minute, 330, GETUTCDATE()) WHERE Id = @id');
                        
                        await logTagChange(asin.Id, currentTags, newTags, userId, userName, 'bulk_upload');
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    skipped++;
                    errors.push({ asin: asinCode, reason: 'Not found' });
                }
            } catch (e) {
                skipped++;
                errors.push({ asin: asinCode, reason: e.message });
            }
        }
        
        try { fs.unlinkSync(filePath); } catch (e) {}
        
        res.json({
            success: true,
            message: `Processed ${data.length} ASINs: ${updated} updated, ${skipped} skipped`,
            updated,
            skipped,
            errors: errors.slice(0, 10)
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        console.error('bulkUpdateTags error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Download tags template CSV
 * GET /api/asins/tags/template
 */
exports.downloadTagsTemplate = async (req, res) => {
    try {
        const { sellerId } = req.query;
        const pool = await getPool();
        
        let query = `
            SELECT 
                a.ParentAsin as [Parent ASIN],
                a.AsinCode as [Child ASIN],
                s.Name as [Seller Name],
                ISNULL(a.Tags, '[]') as [Tags],
                a.Title as [Title]
            FROM Asins a
            LEFT JOIN Sellers s ON a.SellerId = s.Id
            WHERE 1=1
        `;
        
        const request = pool.request();
        
        if (sellerId) {
            query += ' AND a.SellerId = @sellerId';
            request.input('sellerId', sql.VarChar, sellerId);
        }
        
        query += ' ORDER BY a.ParentAsin, a.AsinCode';
        
        const result = await request.query(query);
        
        // Format data for Excel
        const data = result.recordset.map(row => ({
            'Parent ASIN': row['Parent ASIN'] || '',
            'Child ASIN': row['Child ASIN'] || '',
            'Seller Name': row['Seller Name'] || '',
            'Tags': (() => {
                try {
                    const tags = JSON.parse(row['Tags'] || '[]');
                    return Array.isArray(tags) ? tags.join(', ') : '';
                } catch (e) {
                    return row['Tags'] || '';
                }
            })(),
            'Title': (row['Title'] || '').substring(0, 100)
        }));
        
        // Create workbook
        const ws = XLSX.utils.json_to_sheet(data);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 15 },  // Parent ASIN
            { wch: 15 },  // Child ASIN
            { wch: 25 },  // Seller Name
            { wch: 50 },  // Tags
            { wch: 60 },  // Title
        ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tags Template');
        
        // Add a second sheet with available tags from database
        let templateDefaultTags = [...DEFAULT_TAGS];
        try {
            const predefinedResult = await pool.request().query('SELECT Name FROM PredefinedTags ORDER BY Name');
            if (predefinedResult.recordset.length > 0) {
                templateDefaultTags = predefinedResult.recordset.map(r => r.Name);
            }
        } catch (dbErr) {
            console.error('Failed to fetch predefined tags for template:', dbErr.message);
        }

        const tagsSheet = XLSX.utils.json_to_sheet(
            templateDefaultTags.map(tag => ({ 'Available Tags': tag }))
        );
        XLSX.utils.book_append_sheet(wb, tagsSheet, 'Available Tags');
        
        const fileName = `tags_template_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        res.send(buffer);
    } catch (error) {
        console.error('downloadTagsTemplate error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
/**
 * Bulk update tags for multiple ASINs
 * POST /api/asins/bulk-tags
 * 
 * Body: {
 *   asinIds: ["id1", "id2", ...],
 *   tags: ["tag1", "tag2", ...],
 *   action: "add" | "remove" | "replace"  // default: "replace"
 * }
 */
exports.bulkUpdateTags = async (req, res) => {
  try {
    const { asinIds, tags, action = 'replace' } = req.body;
    const userId = (req.user?.Id || req.user?._id || req.user?.id || '').toString();
    const userName = req.user?.FirstName 
      ? `${req.user.FirstName} ${req.user.LastName || ''}`.trim() 
      : (req.user?.Email || req.user?.email || req.user?.firstName || 'Unknown User');

    if (!asinIds || !Array.isArray(asinIds) || asinIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No ASINs selected' });
    }

    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ success: false, error: 'No tags provided' });
    }

    const pool = await getPool();
    
    const asinResult = await pool.request()
      .query(`SELECT Id, AsinCode, Tags FROM Asins WHERE Id IN (${asinIds.map(id => `'${id}'`).join(',')})`);

    if (asinResult.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'No ASINs found' });
    }

    let updated = 0;
    let skipped = 0;
    const summary = {
      total: asinResult.recordset.length,
      updated: 0,
      skipped: 0
    };

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const records = asinResult.recordset;
      for (let i = 0; i < records.length; i++) {
        const asin = records[i];
        let currentTags = [];
        try {
          currentTags = JSON.parse(asin.Tags || '[]');
          if (!Array.isArray(currentTags)) currentTags = [];
        } catch (e) {
          currentTags = [];
        }

        let newTags = [...currentTags];
        if (action === 'add') {
          tags.forEach(t => {
            if (!newTags.includes(t)) newTags.push(t);
          });
        } else if (action === 'remove') {
          newTags = newTags.filter(t => !tags.includes(t));
        } else {
          newTags = [...tags];
        }

        // Only update if changed
        if (JSON.stringify([...currentTags].sort()) !== JSON.stringify([...newTags].sort())) {
          updated++;
          summary.updated++;

          // 1. Update Asins
          await transaction.request()
            .input('id', sql.VarChar, asin.Id)
            .input('tags', sql.NVarChar, JSON.stringify(newTags))
            .query('UPDATE Asins SET Tags = @tags, UpdatedAt = DATEADD(minute, 330, GETUTCDATE()) WHERE Id = @id');

          // 2. Log to TagsHistory
          const historyId = generateId();
          const addedTags = newTags.filter(t => !currentTags.includes(t));
          const removedTags = currentTags.filter(t => !newTags.includes(t));

          await transaction.request()
            .input('id', sql.VarChar, historyId)
            .input('asinId', sql.VarChar, asin.Id)
            .input('userId', sql.VarChar, userId || null)
            .input('userName', sql.NVarChar, userName || 'System')
            .input('previousTags', sql.NVarChar, JSON.stringify(currentTags))
            .input('newTags', sql.NVarChar, JSON.stringify(newTags))
            .input('addedTags', sql.NVarChar, JSON.stringify(addedTags))
            .input('removedTags', sql.NVarChar, JSON.stringify(removedTags))
            .input('action', sql.NVarChar, action === 'replace' ? 'bulk_update' : action)
            .input('source', sql.NVarChar, 'bulk_manager')
            .input('notes', sql.NVarChar, `Bulk ${action} tags on ${asinIds.length} ASINs`)
            .query(`
              INSERT INTO TagsHistory (Id, AsinId, UserId, UserName, PreviousTags, NewTags, AddedTags, RemovedTags, Action, Source, Notes, CreatedAt)
              VALUES (@id, @asinId, @userId, @userName, @previousTags, @newTags, @addedTags, @removedTags, @action, @source, @notes, DATEADD(minute, 330, GETUTCDATE()))
            `);
        } else {
          skipped++;
          summary.skipped++;
        }
      }

      if (updated > 0) {
        await transaction.commit();
      } else {
        await transaction.rollback();
      }

      res.json({
        success: true,
        message: `Updated ${updated} ASINs (${skipped} unchanged)`,
        updated,
        skipped,
        total: asinResult.recordset.length,
        summary
      });
    } catch (err) {
      if (transaction) await transaction.rollback().catch(() => {});
      throw err;
    }
  } catch (error) {
    console.error('bulkUpdateTags Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get all predefined tags (complete list with categories)
 * GET /api/asins/predefined-tags
 */
exports.getPredefinedTags = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT Id, Name, Category, CreatedAt FROM PredefinedTags ORDER BY Category, Name');
        res.json({
            success: true,
            data: result.recordset.map(row => ({
                id: row.Id,
                _id: row.Id,
                name: row.Name,
                category: row.Category,
                createdAt: row.CreatedAt
            }))
        });
    } catch (error) {
        console.error('getPredefinedTags error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Add a new predefined tag
 * POST /api/asins/predefined-tags
 */
exports.addPredefinedTag = async (req, res) => {
    try {
        const { name, category = 'General' } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Tag name is required' });
        }
        
        const tagName = name.trim();
        const pool = await getPool();

        // Check if exists
        const existsRes = await pool.request()
            .input('name', sql.NVarChar, tagName)
            .query('SELECT 1 FROM PredefinedTags WHERE Name = @name');

        if (existsRes.recordset.length > 0) {
            return res.status(400).json({ success: false, error: 'Predefined tag with this name already exists' });
        }

        const id = generateId();
        await pool.request()
            .input('id', sql.VarChar, id)
            .input('name', sql.NVarChar, tagName)
            .input('category', sql.NVarChar, category)
            .query('INSERT INTO PredefinedTags (Id, Name, Category, CreatedAt, UpdatedAt) VALUES (@id, @name, @category, DATEADD(minute, 330, GETUTCDATE()), DATEADD(minute, 330, GETUTCDATE()))');

        res.status(201).json({
            success: true,
            message: 'Predefined tag added successfully',
            data: { id, _id: id, name: tagName, category }
        });
    } catch (error) {
        console.error('addPredefinedTag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Update an existing predefined tag
 * PUT /api/asins/predefined-tags/:id
 */
exports.updatePredefinedTag = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Tag ID is required' });
        }

        const pool = await getPool();

        // Verify exists
        const existsRes = await pool.request()
            .input('id', sql.VarChar, id)
            .query('SELECT Name, Category FROM PredefinedTags WHERE Id = @id');

        if (existsRes.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Predefined tag not found' });
        }

        const currentTag = existsRes.recordset[0];
        const newName = name !== undefined ? name.trim() : currentTag.Name;
        const newCategory = category !== undefined ? category.trim() : currentTag.Category;

        if (!newName) {
            return res.status(400).json({ success: false, error: 'Tag name cannot be empty' });
        }

        // If name changes, check uniqueness
        if (newName !== currentTag.Name) {
            const uniqueRes = await pool.request()
                .input('name', sql.NVarChar, newName)
                .input('id', sql.VarChar, id)
                .query('SELECT 1 FROM PredefinedTags WHERE Name = @name AND Id != @id');

            if (uniqueRes.recordset.length > 0) {
                return res.status(400).json({ success: false, error: 'Another tag with this name already exists' });
            }
        }

        await pool.request()
            .input('id', sql.VarChar, id)
            .input('name', sql.NVarChar, newName)
            .input('category', sql.NVarChar, newCategory)
            .query('UPDATE PredefinedTags SET Name = @name, Category = @category, UpdatedAt = DATEADD(minute, 330, GETUTCDATE()) WHERE Id = @id');

        res.json({
            success: true,
            message: 'Predefined tag updated successfully',
            data: { id, _id: id, name: newName, category: newCategory }
        });
    } catch (error) {
        console.error('updatePredefinedTag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Delete a predefined tag
 * DELETE /api/asins/predefined-tags/:id
 */
exports.deletePredefinedTag = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Tag ID is required' });
        }

        const pool = await getPool();

        // Verify exists
        const existsRes = await pool.request()
            .input('id', sql.VarChar, id)
            .query('SELECT Name FROM PredefinedTags WHERE Id = @id');

        if (existsRes.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Predefined tag not found' });
        }

        await pool.request()
            .input('id', sql.VarChar, id)
            .query('DELETE FROM PredefinedTags WHERE Id = @id');

        res.json({
            success: true,
            message: 'Predefined tag deleted successfully'
        });
    } catch (error) {
        console.error('deletePredefinedTag error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
