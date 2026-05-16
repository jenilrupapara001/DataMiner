const { sql, getPool, generateId } = require('../database/db');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const AutoTagService = require('../services/autoTagService');
const SystemLogService = require('../services/SystemLogService');

// Helper to robustly parse multiple date formats, preferring DD/MM/YYYY as requested
const parseFlexibleDate = (val) => {
    if (!val) return null;
    
    // 1. Handle Excel serial numeric dates
    if (typeof val === 'number') {
        const d = new Date(Date.UTC(1899, 11, 30));
        d.setDate(d.getDate() + Math.floor(val));
        const fractionalDay = val - Math.floor(val);
        const millisecondsInDay = 24 * 60 * 60 * 1000;
        d.setMilliseconds(d.getMilliseconds() + Math.round(fractionalDay * millisecondsInDay));
        return isNaN(d.getTime()) ? null : d;
    }
    
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    
    const str = val.toString().trim();
    if (!str) return null;

    // 2. Handle DD-MMM-YYYY or MMM-DD-YYYY (e.g. 15-Jan-2025)
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const alphaMatch = str.match(/^(\d{1,2})[-/\s]([a-z]{3,10})[-/\s](\d{2,4})$/i);
    if (alphaMatch) {
        const d = parseInt(alphaMatch[1]);
        const mStr = alphaMatch[2].toLowerCase().substring(0, 3);
        const yStr = alphaMatch[3];
        const m = monthNames.indexOf(mStr);
        if (m !== -1) {
            let y = parseInt(yStr);
            if (y < 100) y += (y < 50 ? 2000 : 1900);
            const dateObj = new Date(y, m, d);
            if (!isNaN(dateObj.getTime())) return dateObj;
        }
    }

    // 3. Standard ISO Matches (YYYY-MM-DD)
    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1]);
        const month = parseInt(isoMatch[2]) - 1;
        const day = parseInt(isoMatch[3]);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
    }
    
    // 4. Generic Delimited Format: DD/MM/YY, MM/DD/YYYY, etc.
    const match = str.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (match) {
        let part1 = parseInt(match[1]);
        let part2 = parseInt(match[2]);
        let part3 = parseInt(match[3]);
        
        let year, month, day;
        
        if (part1 > 31) {
            year = part1; month = part2; day = part3;
        } 
        else if (part3 > 31 || match[3].length === 4) {
            year = part3;
            if (part1 > 12) {
                day = part1; month = part2;
            } else if (part2 > 12) {
                month = part1; day = part2;
            } else {
                day = part1; month = part2;
            }
        }
        else {
            year = part3 < 50 ? 2000 + part3 : 1900 + part3;
            if (part1 > 12) { day = part1; month = part2; }
            else if (part2 > 12) { month = part1; day = part2; }
            else { day = part1; month = part2; } 
        }
        
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) return d;
    }
    
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
};

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
            try { fs.unlinkSync(req.file.path); } catch (e) { }
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
            try { fs.unlinkSync(filePath); } catch (e) { }
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
                const childAsin = getValue(row, ['ASIN', 'Child ASIN', 'asin', 'child_asin', 'asinCode', 'Jio Code', 'jio_code', 'JioCode', 'Jio-code', 'ASIN_Code', 'Product_ID'])
                    .toString().trim().toUpperCase();
                const parentAsin = getValue(row, ['PARENT ASIN', 'Parent ASIN', 'parent_asin', 'parentAsin', 'Parent_ASIN', 'ParentASIN', 'Parent_Code', 'ParentCode'])
                    .toString().trim().toUpperCase();
                const sku = getValue(row, ['SKU', 'sku']).toString().trim();
                const uploadedPrice = parseFloat(getValue(row, ['PPrice', 'Price', 'price', 'Uploaded Price', 'uploaded_price'])) || null;
                const brandName = getValue(row, ['Brand', 'Seller', 'Brand Name', 'brand', 'seller_name', 'brand_name']).toString().trim();

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

                // 2. Handle Dates (Fully Dynamic Logic)
                const dateStr = getValue(row, ['Release Date', 'release_date', 'ReleaseDate', 'Released Date', 'Realeased date', 'released_date', 'Launch Date', 'launch_date', 'Created Date', 'created_date']);
                let releaseDate = parseFlexibleDate(dateStr);

                const autoTags = AutoTagService.calculateAgeTags(releaseDate);

                // 3. Update or Insert
                const existingResult = await transaction.request()
                    .input('asin', sql.VarChar, childAsin)
                    .input('sellerId', sql.VarChar, rowSellerId)
                    .query('SELECT Id, Tags FROM Asins WHERE AsinCode = @asin AND SellerId = @sellerId');

                const existing = existingResult.recordset[0];

                if (existing) {
                    let existingTags = [];
                    try { existingTags = JSON.parse(existing.Tags || '[]'); } catch (e) { }
                    
                    let mergedTags = existingTags;
                    if (releaseDate) {
                        mergedTags = AutoTagService.mergeTags(existingTags, autoTags, true);
                    }

                    await transaction.request()
                        .input('id', sql.VarChar, existing.Id)
                        .input('parentAsin', sql.NVarChar, parentAsin || null)
                        .input('sku', sql.NVarChar, sku || null)
                        .input('releaseDate', sql.DateTime2, releaseDate)
                        .input('tags', sql.NVarChar, JSON.stringify(mergedTags))
                        .input('uploadedPrice', sql.Decimal(10, 2), uploadedPrice)
                        .input('brand', sql.NVarChar, brandName || null)
                        .query(`
                            UPDATE Asins SET 
                                ParentAsin = CASE WHEN @parentAsin != '' AND @parentAsin IS NOT NULL THEN @parentAsin ELSE ParentAsin END,
                                Sku = CASE WHEN @sku != '' AND @sku IS NOT NULL THEN @sku ELSE Sku END,
                                ReleaseDate = CASE WHEN @releaseDate IS NOT NULL THEN @releaseDate ELSE ReleaseDate END,
                                UploadedPrice = CASE WHEN @uploadedPrice IS NOT NULL THEN @uploadedPrice ELSE UploadedPrice END,
                                Tags = @tags,
                                Brand = CASE WHEN Brand IS NULL OR Brand = '' THEN @brand ELSE Brand END,
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
                        .input('brand', sql.NVarChar, brandName || null)
                        .query(`
                            INSERT INTO Asins (Id, AsinCode, SellerId, ParentAsin, Sku, ReleaseDate, UploadedPrice, Tags, Status, ScrapeStatus, Brand, CreatedAt, UpdatedAt)
                            VALUES (@id, @asinCode, @sellerId, @parentAsin, @sku, @releaseDate, @uploadedPrice, @tags, 'Active', 'PENDING', @brand, GETDATE(), GETDATE())
                        `);
                    results.created++;
                }
                if (autoTags.length > 0) results.autoTagged++;
            }

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            try { fs.unlinkSync(filePath); } catch (e) { }
            throw err;
        }

        console.log(`✅ [BulkUpload] Catalog Sync Complete: ${results.updated} updated, ${results.created} created, ${results.skipped} skipped.`);

        // Log the activity
        await SystemLogService.log({
            type: 'IMPORT',
            entityType: 'ASIN',
            entityId: sellerId === 'all' ? 'GLOBAL' : sellerId,
            entityTitle: `Catalog Sync: ${req.file.originalname}`,
            user: req.userId || req.user?.Id || req.user?._id,
            description: `Processed ${data.length} rows: ${results.updated} updated, ${results.created} created.`,
            metadata: { 
                filename: req.file.originalname,
                sellerId,
                total: data.length,
                updated: results.updated,
                created: results.created,
                skipped: results.skipped,
                autoTagged: results.autoTagged
            }
        });

        res.json({
            success: true,
            message: `Processed ${data.length} rows: ${results.updated} updated, ${results.created} created, ${results.skipped} skipped.`,
            ...results
        });

    } catch (error) {
        console.error('Catalog Sync Error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
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
            try { fs.unlinkSync(filePath); } catch (e) { }
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

        // Log activity
        await SystemLogService.log({
            type: 'IMPORT',
            entityType: 'ASIN',
            entityTitle: `Tags Import: ${req.file.originalname}`,
            user: req.userId || req.user?.Id || req.user?._id,
            description: `Updated tags for ${results.updated} ASINs.`,
            metadata: { 
                filename: req.file.originalname,
                updated: results.updated,
                notFound: results.notFound,
                skipped: results.skipped
            }
        });

        res.json({
            success: true,
            message: `Tags updated for ${results.updated} ASINs. ${results.notFound} ASINs not found. ${results.skipped} skipped.`,
            ...results
        });

    } catch (error) {
        console.error('Tags Import Error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
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
        let headers = ['PARENT ASIN', 'ASIN', 'SKU', 'Release Date', 'PPrice'];
        let sampleRow = ['B09XYZ123', 'B0XXX111', 'SKU-001', '2025-01-15', '499.00'];
        let sheetName = 'Catalog Template';
        let filename = 'catalog_template.xlsx';

        if (req.query.marketplace === 'ajio') {
            headers = ['Jio Code', 'SKU', 'Release Date', 'MRP', 'ASP', 'Brand'];
            sampleRow = ['703391049004', 'SKU-AJIO-001', '2025-01-15', '2762.00', '1999.00', 'JAAEZAH'];
            sheetName = 'Ajio Catalog Template';
            filename = 'ajio_catalog_template.xlsx';
        }

        const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
        ws['!cols'] = [
            { wch: 15 },
            { wch: 15 },
            { wch: 30 },
            { wch: 15 },
            { wch: 12 },
            { wch: 15 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Handle direct ingestion of Octoparse JSON results file.
 * POST /api/bulk/octoparse-json
 */
exports.octoparseJsonUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const sellerId = req.body.sellerId;
        if (!sellerId) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
            return res.status(400).json({ success: false, error: 'Seller ID is required for JSON ingestion' });
        }

        const allowCreation = req.body.allowCreation === 'true' || req.body.allowCreation === true;

        // 1. Read and parse JSON
        const filePath = req.file.path;
        let rawData;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            rawData = JSON.parse(content);
        } catch (parseErr) {
            try { fs.unlinkSync(filePath); } catch (e) { }
            return res.status(400).json({ success: false, error: 'Invalid JSON file format: ' + parseErr.message });
        }

        if (!Array.isArray(rawData)) {
            try { fs.unlinkSync(filePath); } catch (e) { }
            return res.status(400).json({ success: false, error: 'Expected an array of product objects in the JSON file' });
        }

        console.log(`🗳️ [BulkUpload] Processing Octoparse JSON: ${req.file.originalname} (${rawData.length} items) for Seller ${sellerId}`);

        // 2. Delegate to marketDataSyncService for robust mapping and chunked processing
        const service = require('../services/marketDataSyncService');
        
        const result = await service.processBatchResults(sellerId, rawData, { allowCreation });


        // Cleanup
        try { fs.unlinkSync(filePath); } catch (e) { }

        res.json({
            success: true,
            message: `Successfully processed Octoparse JSON file.`,
            ...result
        });

    } catch (error) {
        console.error('Octoparse JSON Upload Error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

