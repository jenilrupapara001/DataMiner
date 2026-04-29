const { sql, getPool } = require('../database/db');
const XLSX = require('xlsx');
const fs = require('fs');

// Default tags
const DEFAULT_TAGS = [
    'Best Seller', 'Low Margin', 'High Margin', 'Needs Optimization',
    'A+ Content Missing', 'Low LQS', 'BuyBox Lost', 'Price Drop',
    'New Launch', 'Seasonal', 'Clearance', 'Replenishment',
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
                default: DEFAULT_TAGS,
                used: [...usedTags],
                all: [...new Set([...DEFAULT_TAGS, ...usedTags])].sort()
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
        const userId = (req.user?._id || req.user?.id || '').toString();
        const userName = req.user?.firstName 
            ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() 
            : (req.user?.email || 'Unknown User');
        
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
                .query('UPDATE Asins SET Tags = @tags, UpdatedAt = GETDATE() WHERE Id = @id');

            // Log the change
            const { logTagChange } = require('./tagsHistoryController');
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
exports.bulkUpdateTags = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const sellerId = req.body.sellerId || '';
        const userId = (req.user?._id || req.user?.id || '').toString();
        const userName = req.user?.firstName 
            ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() 
            : (req.user?.email || 'Unknown User');
        
        const filePath = req.file.path;
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        
        if (data.length === 0) {
            try { fs.unlinkSync(filePath); } catch (e) {}
            return res.status(400).json({ success: false, error: 'Empty file' });
        }
        
        const pool = await getPool();
        const { logTagChange } = require('./tagsHistoryController');
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
                            .query('UPDATE Asins SET Tags = @tags, UpdatedAt = GETDATE() WHERE Id = @id');
                        
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
        
        // Add a second sheet with available tags
        const tagsSheet = XLSX.utils.json_to_sheet(
            DEFAULT_TAGS.map(tag => ({ 'Available Tags': tag }))
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
