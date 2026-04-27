const { sql, getPool, generateId } = require('../database/db');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Bulk Catalog Sync - Upload CSV with Parent ASIN, Child ASIN, SKU mapping
 * POST /api/bulk/catalog-sync
 * 
 * Expected CSV columns:
 * - Parent ASIN (or parent_asin, parentAsin)
 * - Child ASIN (or ASIN, asin, child_asin, childAsin)  
 * - SKU (optional)
 * - Seller ID / Seller Name (for mapping)
 */
exports.catalogSync = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const sellerId = req.body.sellerId;
        if (!sellerId) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
            return res.status(400).json({ success: false, error: 'Seller ID is required' });
        }

        const filePath = req.file.path;
        const workbook = XLSX.readFile(filePath);
        
        // Find first sheet with data
        let data = [];
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (jsonData.length > 0) {
                data = jsonData;
                break;
            }
        }

        if (data.length === 0) {
            try { fs.unlinkSync(filePath); } catch (e) {}
            return res.status(400).json({ success: false, error: 'No data found in file' });
        }

        const pool = await getPool();
        const results = {
            total: data.length,
            updated: 0,
            created: 0,
            skipped: 0,
            errors: []
        };

        // First, get all existing ASINs for this seller
        const existingResult = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query('SELECT Id, AsinCode FROM Asins WHERE SellerId = @sellerId');
        
        const existingMap = new Map();
        existingResult.recordset.forEach(a => {
            existingMap.set(a.AsinCode.toUpperCase(), a.Id);
        });

        // Helper to find value by multiple possible column names
        const getValue = (row, possibleKeys) => {
            const keys = Object.keys(row);
            const lowerKeys = keys.map(k => k.toLowerCase().trim().replace(/[\s_-]/g, ''));
            const targetLower = possibleKeys.map(k => k.toLowerCase().trim().replace(/[\s_-]/g, ''));
            
            for (let i = 0; i < lowerKeys.length; i++) {
                if (targetLower.includes(lowerKeys[i])) {
                    return row[keys[i]];
                }
            }
            return '';
        };

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (const row of data) {
                const childAsin = getValue(row, ['Child ASIN', 'ASIN', 'asin', 'child_asin', 'childAsin', 'asinCode']).toString().trim().toUpperCase();
                const parentAsin = getValue(row, ['Parent ASIN', 'parent_asin', 'parentAsin', 'parent']).toString().trim().toUpperCase();
                const sku = getValue(row, ['SKU', 'sku']).toString().trim();

                if (!childAsin) {
                    results.skipped++;
                    results.errors.push({ row: results.updated + results.skipped, reason: 'Missing Child ASIN' });
                    continue;
                }

                const existingId = existingMap.get(childAsin);

                if (existingId) {
                    // Update existing ASIN
                    await transaction.request()
                        .input('id', sql.VarChar, existingId)
                        .input('parentAsin', sql.NVarChar, parentAsin || null)
                        .input('sku', sql.NVarChar, sku || null)
                        .query(`
                            UPDATE Asins SET 
                                ParentAsin = CASE WHEN @parentAsin != '' THEN @parentAsin ELSE ParentAsin END,
                                Sku = CASE WHEN @sku != '' THEN @sku ELSE Sku END,
                                UpdatedAt = GETDATE()
                            WHERE Id = @id
                        `);
                    results.updated++;
                } else {
                    // Create new ASIN
                    const newId = generateId();
                    await transaction.request()
                        .input('id', sql.VarChar, newId)
                        .input('asinCode', sql.VarChar, childAsin)
                        .input('sellerId', sql.VarChar, sellerId)
                        .input('parentAsin', sql.NVarChar, parentAsin || null)
                        .input('sku', sql.NVarChar, sku || null)
                        .query(`
                            INSERT INTO Asins (Id, AsinCode, SellerId, ParentAsin, Sku, Status, ScrapeStatus, CreatedAt, UpdatedAt)
                            VALUES (@id, @asinCode, @sellerId, @parentAsin, @sku, 'Active', 'PENDING', GETDATE(), GETDATE())
                        `);
                    results.created++;
                }
            }

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            try { fs.unlinkSync(filePath); } catch (e) {}
            throw err;
        }

        try { fs.unlinkSync(filePath); } catch (e) {}

        res.json({
            success: true,
            message: `Updated ${results.updated} ASINs, Created ${results.created} new, ${results.skipped} skipped`,
            ...results
        });

    } catch (error) {
        console.error('Catalog Sync Error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Bulk Tags Import - Maps tags to ASINs by exact ASIN code match
 * POST /api/bulk/tags-import
 * 
 * Expected CSV columns:
 * - Child ASIN (or ASIN, asin) - REQUIRED - this is how we match
 * - Tags (comma separated tag names)
 * - Seller ID (optional, for scoping)
 */
exports.tagsImport = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const sellerId = req.body.sellerId || '';
        const filePath = req.file.path;
        const workbook = XLSX.readFile(filePath);
        
        let data = [];
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (jsonData.length > 0) {
                data = jsonData;
                break;
            }
        }

        if (data.length === 0) {
            try { fs.unlinkSync(filePath); } catch (e) {}
            return res.status(400).json({ success: false, error: 'No data found in file' });
        }

        const pool = await getPool();
        const results = {
            total: data.length,
            updated: 0,
            skipped: 0,
            notFound: 0,
            errors: []
        };

        // Helper for flexible column matching
        const getValue = (row, possibleKeys) => {
            const keys = Object.keys(row);
            const lowerKeys = keys.map(k => k.toLowerCase().trim().replace(/[\s_-]/g, ''));
            const targetLower = possibleKeys.map(k => k.toLowerCase().trim().replace(/[\s_-]/g, ''));
            
            for (let i = 0; i < lowerKeys.length; i++) {
                if (targetLower.includes(lowerKeys[i])) {
                    return row[keys[i]];
                }
            }
            return '';
        };

        // Build a map of all ASIN codes for this seller
        let asinQuery = 'SELECT Id, AsinCode FROM Asins WHERE 1=1';
        if (sellerId) {
            asinQuery += ' AND SellerId = @sellerId';
        }
        
        const asinRequest = pool.request();
        if (sellerId) asinRequest.input('sellerId', sql.VarChar, sellerId);
        
        const asinResult = await asinRequest.query(asinQuery);
        const asinMap = new Map();
        asinResult.recordset.forEach(a => {
            asinMap.set(a.AsinCode.toUpperCase(), a.Id);
        });

        console.log(`[TagsImport] Found ${asinMap.size} ASINs ${sellerId ? 'for seller ' + sellerId : 'in total'}`);

        // Process each row
        for (const row of data) {
            const childAsin = getValue(row, ['Child ASIN', 'ASIN', 'asin', 'asinCode', 'child_asin']).toString().trim().toUpperCase();
            const tagsStr = getValue(row, ['Tags', 'tags', 'tag']).toString().trim();

            if (!childAsin) {
                results.skipped++;
                results.errors.push({ reason: 'Missing ASIN code', row: JSON.stringify(row).substring(0, 50) });
                continue;
            }

            const asinId = asinMap.get(childAsin);
            if (!asinId) {
                results.notFound++;
                results.errors.push({ asin: childAsin, reason: 'ASIN not found in database' });
                continue;
            }

            // Parse tags - support comma, pipe, semicolon, or newline separated
            const tags = tagsStr
                ? tagsStr.split(/[,|;\n]+/)
                    .map(t => t.trim())
                    .filter(t => t.length > 0 && t.length < 100)
                : [];

            try {
                await pool.request()
                    .input('id', sql.VarChar, asinId)
                    .input('tags', sql.NVarChar, JSON.stringify(tags))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = GETDATE() WHERE Id = @id');
                results.updated++;
            } catch (e) {
                results.errors.push({ asin: childAsin, reason: e.message });
            }
        }

        try { fs.unlinkSync(filePath); } catch (e) {}

        res.json({
            success: true,
            message: `Tags updated for ${results.updated} ASINs. ${results.notFound} ASINs not found. ${results.skipped} skipped.`,
            ...results
        });

    } catch (error) {
        console.error('Tags Import Error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Download Catalog Template
 * GET /api/bulk/catalog-template
 */
exports.downloadCatalogTemplate = async (req, res) => {
    try {
        const headers = ['Parent ASIN', 'Child ASIN', 'SKU'];
        
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        ws['!cols'] = [
            { wch: 15 },
            { wch: 15 },
            { wch: 30 }
        ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Catalog Template');
        
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="catalog_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
