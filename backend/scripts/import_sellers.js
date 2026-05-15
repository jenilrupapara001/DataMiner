const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql, getPool, generateId } = require('../database/db');

function parseCSV(text) {
    const lines = [];
    let currentLine = [];
    let currentCell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++; // skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentLine.push(currentCell);
            currentCell = '';
        } else if (char === '\n' && !inQuotes) {
            currentLine.push(currentCell);
            lines.push(currentLine);
            currentLine = [];
            currentCell = '';
        } else if (char === '\r' && !inQuotes) {
            // ignore
        } else {
            currentCell += char;
        }
    }
    if (currentCell !== '' || currentLine.length > 0) {
        currentLine.push(currentCell);
        lines.push(currentLine);
    }
    return lines;
}

async function importSellers() {
    console.log('Starting sellers import...');
    try {
        const pool = await getPool();

        const csvPath = '/Users/jenilrupapara/Downloads/Database_backup/sellers.csv';
        const fileContent = fs.readFileSync(csvPath, 'utf8');
        
        const lines = parseCSV(fileContent);
        
        // Ensure at least header exists
        if (lines.length === 0) return;
        
        const header = lines[0];
        console.log(`CSV Headers: ${header.slice(0, 15).join(', ')}...`);

        // Skip header
        const records = lines.slice(1).filter(l => l.length >= 2 && l[0].trim() !== '');

        console.log(`Found ${records.length} sellers to process.`);

        let insertedSellers = 0;
        let updatedSellers = 0;
        let userAssignments = 0;

        for (const record of records) {
            let [
                id, name, userEmail, marketplace, sellerId, isActive, 
                octoparseConfig, keepaConfig, createdAt, updatedAt, 
                octoparseId, plan, scrapeLimit, scrapeUsed, lastScrapedAt
            ] = record;

            // Trim and handle NULLs
            const clean = (val) => (!val || val.trim() === '' || val.trim().toUpperCase() === 'NULL') ? null : val.trim();
            
            id = clean(id) || generateId();
            name = clean(name);
            userEmail = clean(userEmail);
            marketplace = clean(marketplace);
            sellerId = clean(sellerId);
            isActive = clean(isActive);
            octoparseConfig = clean(octoparseConfig);
            keepaConfig = clean(keepaConfig);
            createdAt = clean(createdAt);
            updatedAt = clean(updatedAt);
            octoparseId = clean(octoparseId);
            plan = clean(plan);
            scrapeLimit = clean(scrapeLimit);
            scrapeUsed = clean(scrapeUsed);
            lastScrapedAt = clean(lastScrapedAt);

            if (!name) continue;

            const activeBit = (isActive === '1' || isActive === 'true') ? 1 : 0;
            
            // Validate JSON if present
            if (octoparseConfig && !octoparseConfig.startsWith('{') && !octoparseConfig.startsWith('[')) {
                octoparseConfig = null; // invalid json string
            }

            // Check if seller already exists by Id or Name
            const existingSeller = await pool.request()
                .input('id', sql.VarChar, id)
                .input('name', sql.NVarChar, name)
                .query('SELECT Id FROM Sellers WHERE Id = @id OR Name = @name');

            let finalSellerId = id;

            if (existingSeller.recordset.length > 0) {
                finalSellerId = existingSeller.recordset[0].Id;
                // Update
                await pool.request()
                    .input('id', sql.VarChar, finalSellerId)
                    .input('name', sql.NVarChar, name)
                    .input('marketplace', sql.NVarChar, marketplace)
                    .input('sellerId', sql.NVarChar, sellerId)
                    .input('octoparseId', sql.NVarChar, octoparseId)
                    .input('isActive', sql.Bit, activeBit)
                    .input('plan', sql.NVarChar, plan)
                    .input('scrapeLimit', sql.Int, scrapeLimit ? parseInt(scrapeLimit) : null)
                    .input('scrapeUsed', sql.Int, scrapeUsed ? parseInt(scrapeUsed) : null)
                    .input('octoparseConfig', sql.NVarChar, octoparseConfig)
                    .input('keepaConfig', sql.NVarChar, keepaConfig)
                    .query(`
                        UPDATE Sellers 
                        SET Name = @name, Marketplace = @marketplace, SellerId = @sellerId, 
                            OctoparseId = @octoparseId, IsActive = @isActive, [Plan] = @plan, 
                            ScrapeLimit = @scrapeLimit, ScrapeUsed = @scrapeUsed, 
                            OctoparseConfig = @octoparseConfig, KeepaConfig = @keepaConfig,
                            UpdatedAt = GETDATE()
                        WHERE Id = @id
                    `);
                updatedSellers++;
            } else {
                // Insert
                await pool.request()
                    .input('id', sql.VarChar, finalSellerId)
                    .input('name', sql.NVarChar, name)
                    .input('marketplace', sql.NVarChar, marketplace)
                    .input('sellerId', sql.NVarChar, sellerId)
                    .input('octoparseId', sql.NVarChar, octoparseId)
                    .input('isActive', sql.Bit, activeBit)
                    .input('plan', sql.NVarChar, plan)
                    .input('scrapeLimit', sql.Int, scrapeLimit ? parseInt(scrapeLimit) : null)
                    .input('scrapeUsed', sql.Int, scrapeUsed ? parseInt(scrapeUsed) : null)
                    .input('octoparseConfig', sql.NVarChar, octoparseConfig)
                    .input('keepaConfig', sql.NVarChar, keepaConfig)
                    .query(`
                        INSERT INTO Sellers (Id, Name, Marketplace, SellerId, OctoparseId, IsActive, [Plan], ScrapeLimit, ScrapeUsed, OctoparseConfig, KeepaConfig, CreatedAt, UpdatedAt)
                        VALUES (@id, @name, @marketplace, @sellerId, @octoparseId, @isActive, @plan, @scrapeLimit, @scrapeUsed, @octoparseConfig, @keepaConfig, GETDATE(), GETDATE())
                    `);
                insertedSellers++;
            }

            // Assign to User if User Email is provided
            if (userEmail) {
                const userRes = await pool.request()
                    .input('email', sql.NVarChar, userEmail)
                    .query('SELECT Id FROM Users WHERE Email = @email');

                if (userRes.recordset.length > 0) {
                    const userId = userRes.recordset[0].Id;

                    // Ensure mapping in UserSellers
                    const mappingRes = await pool.request()
                        .input('uid', sql.VarChar, userId)
                        .input('sid', sql.VarChar, finalSellerId)
                        .query('SELECT 1 FROM UserSellers WHERE UserId = @uid AND SellerId = @sid');

                    if (mappingRes.recordset.length === 0) {
                        await pool.request()
                            .input('uid', sql.VarChar, userId)
                            .input('sid', sql.VarChar, finalSellerId)
                            .query('INSERT INTO UserSellers (UserId, SellerId) VALUES (@uid, @sid)');
                        userAssignments++;
                        console.log(`Mapped Seller ${name} to User ${userEmail}`);
                    }
                } else {
                    console.log(`WARNING: User with email ${userEmail} not found. Cannot map seller ${name}.`);
                }
            }
        }

        console.log(`\nSellers Import Complete!`);
        console.log(`Inserted: ${insertedSellers}, Updated: ${updatedSellers}, New Assignments: ${userAssignments}`);

    } catch (err) {
        console.error('Failed to import sellers:', err);
    } finally {
        process.exit(0);
    }
}

importSellers();
