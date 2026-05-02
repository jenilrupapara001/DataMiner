const { sql, getPool, generateId } = require('../database/db');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const AutoTagService = require('../services/autoTagService');

/**
 * Bulk Catalog Sync with Release Date support
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
        
        let data = [];
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
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
            autoTagged: 0,
            errors: []
        };

        console.log(`📦 [BulkUpload] Processing Catalog Sync: ${req.file.originalname} (${data.length} rows)`);

        // Cache for brand-to-seller mapping to avoid redundant queries
        const sellerMapByBrand = new Map();
        
        // If a default sellerId was provided, seed the map
        if (sellerId && sellerId !== 'all') {
            const defaultSeller = await pool.request()
                .input('id', sql.VarChar, sellerId)
                .query('SELECT Id, Name FROM Sellers WHERE Id = @id');
            if (defaultSeller.recordset.length > 0) {
                sellerMapByBrand.set(defaultSeller.recordset[0].Name.toLowerCase(), sellerId);
            }
        }

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
                const childAsin = getValue(row, ['Child ASIN', 'ASIN', 'asin', 'child_asin', 'asinCode'])
                    .toString().trim().toUpperCase();
                const parentAsin = getValue(row, ['Parent ASIN', 'parent_asin', 'parentAsin'])
                    .toString().trim().toUpperCase();
                const sku = getValue(row, ['SKU', 'sku']).toString().trim();
                const uploadedPrice = parseFloat(getValue(row, ['Price', 'price', 'Uploaded Price', 'uploaded_price'])) || null;
                const brandName = getValue(row, ['Brand', 'Seller', 'brand', 'seller_name']).toString().trim();
                
                // 1. Resolve Seller ID
                let rowSellerId = sellerId;
                if (brandName) {
                    const brandLower = brandName.toLowerCase();
                    if (sellerMapByBrand.has(brandLower)) {
                        rowSellerId = sellerMapByBrand.get(brandLower);
                    } else {
                        // Look up seller by name
                        const sellerLookup = await pool.request()
                            .input('name', sql.NVarChar, brandName)
                            .query('SELECT Id FROM Sellers WHERE Name = @name');
                        
                        if (sellerLookup.recordset.length > 0) {
                            rowSellerId = sellerLookup.recordset[0].Id;
                            sellerMapByBrand.set(brandLower, rowSellerId);
                        } else if (!rowSellerId || rowSellerId === 'all') {
                            // If no seller found and no default provided, skip this row
                            results.skipped++;
                            results.errors.push({ asin: childAsin, reason: `Seller/Brand "${brandName}" not found in database.` });
                            continue;
                        }
                    }
                }

                if (!childAsin || !rowSellerId || rowSellerId === 'all') {
                    results.skipped++;
                    continue;
                }

                // 2. Handle Dates (Support DD/MM/YY)
                let releaseDate = null;
                const dateStr = getValue(row, ['Release Date', 'release_date', 'ReleaseDate', 'Launch Date', 'launch_date', 'Created Date', 'created_date']);
                
                if (dateStr) {
                    const parsed = new Date(dateStr);
                    if (!isNaN(parsed.getTime())) {
                        releaseDate = parsed;
                    } else {
                        // Check for DD/MM/YY or DD/MM/YYYY
                        const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
                        if (dmyMatch) {
                            const [_, day, month, year] = dmyMatch;
                            const fullYear = year.length === 2 ? (parseInt(year) < 50 ? `20${year}` : `19${year}`) : year;
                            releaseDate = new Date(`${fullYear}-${month}-${day}`);
                        }
                    }
                }
                if (!releaseDate || isNaN(releaseDate.getTime())) releaseDate = new Date();

                const autoTags = AutoTagService.calculateAgeTags(releaseDate);

                // 3. Update or Insert
                const existingResult = await transaction.request()
                    .input('asin', sql.VarChar, childAsin)
                    .input('sellerId', sql.VarChar, rowSellerId)
                    .query('SELECT Id, Tags FROM Asins WHERE AsinCode = @asin AND SellerId = @sellerId');
                
                const existing = existingResult.recordset[0];

                if (existing) {
                    let existingTags = [];
                    try { existingTags = JSON.parse(existing.tags || '[]'); } catch (e) {}
                    const mergedTags = AutoTagService.mergeTags(existingTags, autoTags, true);

                    await transaction.request()
                        .input('id', sql.VarChar, existing.Id)
                        .input('parentAsin', sql.NVarChar, parentAsin || null)
                        .input('sku', sql.NVarChar, sku || null)
                        .input('releaseDate', sql.DateTime2, releaseDate)
                        .input('tags', sql.NVarChar, JSON.stringify(mergedTags))
                        .input('uploadedPrice', sql.Decimal(10, 2), uploadedPrice)
                        .query(`
                            UPDATE Asins SET 
                                ParentAsin = CASE WHEN @parentAsin != '' AND @parentAsin IS NOT NULL THEN @parentAsin ELSE ParentAsin END,
                                Sku = CASE WHEN @sku != '' AND @sku IS NOT NULL THEN @sku ELSE Sku END,
                                ReleaseDate = @releaseDate,
                                UploadedPrice = CASE WHEN @uploadedPrice IS NOT NULL THEN @uploadedPrice ELSE UploadedPrice END,
                                Tags = @tags,
                                UpdatedAt = GETDATE()
                            WHERE Id = @id
                        `);
                    results.updated++;
                } else {
                    const newId = generateId();
                    await transaction.request()
                        .input('id', sql.VarChar, newId)
                        .input('asinCode', sql.VarChar, childAsin)
                        .input('sellerId', sql.VarChar, rowSellerId)
                        .input('parentAsin', sql.NVarChar, parentAsin || null)
                        .input('sku', sql.NVarChar, sku || null)
                        .input('releaseDate', sql.DateTime2, releaseDate)
                        .input('tags', sql.NVarChar, JSON.stringify(autoTags))
                        .input('uploadedPrice', sql.Decimal(10, 2), uploadedPrice)
                        .query(`
                            INSERT INTO Asins (Id, AsinCode, SellerId, ParentAsin, Sku, ReleaseDate, UploadedPrice, Tags, Status, ScrapeStatus, CreatedAt, UpdatedAt)
                            VALUES (@id, @asinCode, @sellerId, @parentAsin, @sku, @releaseDate, @uploadedPrice, @tags, 'Active', 'PENDING', GETDATE(), GETDATE())
                        `);
                    results.created++;
                }
                if (autoTags.length > 0) results.autoTagged++;
            }

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            try { fs.unlinkSync(filePath); } catch (e) {}
            throw err;
        }

        console.log(`✅ [BulkUpload] Catalog Sync Complete: ${results.updated} updated, ${results.created} created, ${results.skipped} skipped.`);

        res.json({
            success: true,
            message: `Processed ${data.length} rows: ${results.updated} updated, ${results.created} created, ${results.skipped} skipped.`,
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

        console.log(`📦 [BulkUpload] Processing Tags Import: ${req.file.originalname} (${data.length} rows)`);

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

        console.log(`✅ [BulkUpload] Tags Import Complete: ${results.updated} updated, ${results.notFound} not found, ${results.skipped} skipped.`);

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
        const headers = ['Parent ASIN', 'Child ASIN', 'SKU', 'Release Date', 'Price'];
        
        // Sample data row
        const sampleRow = ['B09XYZ123', 'B0XXX111', 'SKU-001', '2025-01-15', '499.00'];
        
        const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
        ws['!cols'] = [
            { wch: 15 },
            { wch: 15 },
            { wch: 30 },
            { wch: 15 },
            { wch: 12 }
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
