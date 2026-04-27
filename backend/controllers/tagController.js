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
 * Update tags for a single ASIN
 * PUT /api/asins/:asinId/tags
 */
exports.updateAsinTags = async (req, res) => {
    try {
        const { asinId } = req.params;
        const { tags } = req.body;
        
        if (!asinId) {
            return res.status(400).json({ success: false, error: 'ASIN ID required' });
        }
        
        const pool = await getPool();
        
        const result = await pool.request()
            .input('id', sql.VarChar, asinId)
            .input('tags', sql.NVarChar, JSON.stringify(tags || []))
            .query('UPDATE Asins SET Tags = @tags, UpdatedAt = GETDATE() WHERE Id = @id');
        
        if (result.rowsAffected?.[0] === 0) {
            return res.status(404).json({ success: false, error: 'ASIN not found' });
        }
        
        res.json({ success: true, message: 'Tags updated', tags });
    } catch (error) {
        console.error('updateAsinTags error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Bulk update tags via CSV
 * POST /api/asins/tags/bulk-upload
 */
exports.bulkUpdateTags = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const sellerId = req.body.sellerId || '';
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
            // Flexible column matching
            const asinCode = (row['Child ASIN'] || row['ASIN'] || row['asinCode'] || row['asin'] || '').toString().trim();
            const tagsStr = (row['Tags'] || row['tags'] || '').toString().trim();
            
            if (!asinCode) {
                skipped++;
                continue;
            }
            
            // Parse tags (comma, pipe, or semicolon separated)
            const tags = tagsStr
                ? tagsStr.split(/[,|;]/).map(t => t.trim()).filter(Boolean)
                : [];
            
            try {
                let query = 'UPDATE Asins SET Tags = @tags, UpdatedAt = GETDATE() WHERE AsinCode = @asinCode';
                const request = pool.request()
                    .input('asinCode', sql.VarChar, asinCode)
                    .input('tags', sql.NVarChar, JSON.stringify(tags));
                
                if (sellerId) {
                    query += ' AND SellerId = @sellerId';
                    request.input('sellerId', sql.VarChar, sellerId);
                }
                
                const result = await request.query(query);
                
                if (result.rowsAffected?.[0] > 0) {
                    updated++;
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
            message: `Updated ${updated} ASINs, ${skipped} skipped`,
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
