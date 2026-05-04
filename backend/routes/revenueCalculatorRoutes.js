const express = require('express');
const router = express.Router();
const { sql, getPool, generateId } = require('../database/db');
const { calculateProfits } = require('../services/feeCalculationEngine');
const authController = require('../controllers/authController');
const { authenticate, requirePermission } = require('../middleware/auth');

// Auth Proxy for Revenue Calculator (used by revenueApi in frontend)
router.post('/auth/login', authController.login);

// --- Fee Management Routes ---
// Get all fee structures by type
router.get('/fees/:type', authenticate, requirePermission('calculator_view'), async (req, res) => {
    try {
        const type = req.params.type;
        const pool = await getPool();
        let tableName;

        switch (type) {
            case 'referral': tableName = 'ReferralFees'; break;
            case 'closing': tableName = 'ClosingFees'; break;
            case 'shipping': tableName = 'ShippingFees'; break;
            case 'storage': tableName = 'StorageFees'; break;
            case 'refund': tableName = 'RefundFees'; break;
            default:
                return res.status(400).json({ message: 'Invalid fee type' });
        }

        const result = await pool.request().query(`SELECT * FROM ${tableName}`);
        res.json(result.recordset);
    } catch (error) {
        console.error('Get fees error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create or update fee
router.post('/fees/:type', authenticate, requirePermission('calculator_manage'), async (req, res) => {
    try {
        const type = req.params.type;
        const pool = await getPool();
        const doc = req.body;
        const id = doc.id || doc.Id || generateId();

        if (type === 'referral') {
            await pool.request()
                .input('id', sql.VarChar, id)
                .input('category', sql.NVarChar, doc.Category || doc.category)
                .input('tiers', sql.NVarChar, typeof doc.Tiers === 'string' ? doc.Tiers : JSON.stringify(doc.Tiers || doc.tiers || []))
                .query(`
                    IF EXISTS (SELECT 1 FROM ReferralFees WHERE Id = @id)
                        UPDATE ReferralFees SET Category = @category, Tiers = @tiers WHERE Id = @id
                    ELSE
                        INSERT INTO ReferralFees (Id, Category, Tiers) VALUES (@id, @category, @tiers)
                `);
        } else if (type === 'closing') {
            await pool.request()
                .input('id', sql.VarChar, id)
                .input('category', sql.NVarChar, doc.Category || doc.category)
                .input('sellerType', sql.NVarChar, doc.SellerType || doc.sellerType || 'FC')
                .input('minPrice', sql.Decimal(18, 2), doc.MinPrice || doc.minPrice || 0)
                .input('maxPrice', sql.Decimal(18, 2), doc.MaxPrice || doc.maxPrice || 999999)
                .input('fee', sql.Decimal(18, 2), doc.Fee || doc.fee || 0)
                .query(`
                    IF EXISTS (SELECT 1 FROM ClosingFees WHERE Id = @id)
                        UPDATE ClosingFees SET Category = @category, SellerType = @sellerType, MinPrice = @minPrice, MaxPrice = @maxPrice, Fee = @fee WHERE Id = @id
                    ELSE
                        INSERT INTO ClosingFees (Id, Category, SellerType, MinPrice, MaxPrice, Fee) VALUES (@id, @category, @sellerType, @minPrice, @maxPrice, @fee)
                `);
        } else if (type === 'shipping') {
            await pool.request()
                .input('id', sql.VarChar, id)
                .input('sizeType', sql.NVarChar, doc.SizeType || doc.sizeType)
                .input('weightMin', sql.Decimal(18, 3), doc.WeightMin || doc.weightMin || 0)
                .input('weightMax', sql.Decimal(18, 3), doc.WeightMax || doc.weightMax || 0)
                .input('fee', sql.Decimal(18, 2), doc.Fee || doc.fee || 0)
                .input('pickPack', sql.Decimal(18, 2), doc.PickAndPackFee || doc.pickAndPackFee || 0)
                .query(`
                    IF EXISTS (SELECT 1 FROM ShippingFees WHERE Id = @id)
                        UPDATE ShippingFees SET SizeType = @sizeType, WeightMin = @weightMin, WeightMax = @weightMax, Fee = @fee, PickAndPackFee = @pickPack WHERE Id = @id
                    ELSE
                        INSERT INTO ShippingFees (Id, SizeType, WeightMin, WeightMax, Fee, PickAndPackFee) VALUES (@id, @sizeType, @weightMin, @weightMax, @fee, @pickPack)
                `);
        }
        // ... handled other types as needed or generalized

        res.json({ ok: true, id });
    } catch (error) {
        console.error('Save fee error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete fee
router.delete('/fees/:type/:id', authenticate, requirePermission('calculator_manage'), async (req, res) => {
    try {
        const { type, id } = req.params;
        const pool = await getPool();
        let tableName;

        switch (type) {
            case 'referral': tableName = 'ReferralFees'; break;
            case 'closing': tableName = 'ClosingFees'; break;
            case 'shipping': tableName = 'ShippingFees'; break;
            case 'storage': tableName = 'StorageFees'; break;
            case 'refund': tableName = 'RefundFees'; break;
            default: return res.status(400).json({ message: 'Invalid fee type' });
        }

        await pool.request().input('id', sql.VarChar, id).query(`DELETE FROM ${tableName} WHERE Id = @id`);
        res.json({ ok: true });
    } catch (error) {
        console.error('Delete fee error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Category Mapping Routes ---
router.get('/mappings', authenticate, requirePermission('calculator_view'), async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT * FROM CategoryMaps");
        res.json(result.recordset);
    } catch (error) {
        console.error('Get mappings error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/mappings', authenticate, requirePermission('calculator_manage'), async (req, res) => {
    try {
        const pool = await getPool();
        const doc = req.body;
        const id = doc.id || doc.Id || generateId();

        await pool.request()
            .input('id', sql.VarChar, id)
            .input('keepa', sql.NVarChar, doc.KeepaCategory || doc.keepaCategory)
            .input('fee', sql.NVarChar, doc.FeeCategory || doc.feeCategory)
            .query(`
                IF EXISTS (SELECT 1 FROM CategoryMaps WHERE Id = @id)
                    UPDATE CategoryMaps SET KeepaCategory = @keepa, FeeCategory = @fee WHERE Id = @id
                ELSE
                    INSERT INTO CategoryMaps (Id, KeepaCategory, FeeCategory) VALUES (@id, @keepa, @fee)
            `);

        res.json({ ok: true, id });
    } catch (error) {
        console.error('Save mapping error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Node Mapping Routes ---
router.get('/nodemaps', authenticate, requirePermission('calculator_view'), async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT * FROM NodeMaps");
        res.json(result.recordset);
    } catch (error) {
        console.error('Get node maps error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- ASIN Management Routes ---
router.get('/asins', authenticate, requirePermission('calculator_view'), async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT * FROM CalculatorAsins ORDER BY CreatedAt DESC");
        res.json(result.recordset);
    } catch (error) {
        console.error('Get ASINs error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/asins/bulk', authenticate, requirePermission('calculator_manage'), async (req, res) => {
    try {
        const items = req.body || [];
        const pool = await getPool();
        
        for (const item of items) {
            const id = item.id || item.Id || generateId();
            await pool.request()
                .input('id', sql.VarChar, id)
                .input('asin', sql.VarChar, item.AsinCode || item.asinCode || '')
                .input('title', sql.NVarChar, item.Title || item.title || '')
                .input('category', sql.NVarChar, item.Category || item.category || '')
                .input('price', sql.Decimal(18, 2), item.Price || item.price || 0)
                .input('weight', sql.Decimal(18, 3), item.Weight || item.weight || 0)
                .input('staple', sql.NVarChar, item.StapleLevel || item.stapleLevel || 'Standard')
                .input('status', sql.NVarChar, item.Status || item.status || 'pending')
                .query(`
                    IF EXISTS (SELECT 1 FROM CalculatorAsins WHERE Id = @id)
                        UPDATE CalculatorAsins SET AsinCode = @asin, Title = @title, Category = @category, Price = @price, Weight = @weight, StapleLevel = @staple, Status = @status, UpdatedAt = GETDATE() WHERE Id = @id
                    ELSE
                        INSERT INTO CalculatorAsins (Id, AsinCode, Title, Category, Price, Weight, StapleLevel, Status, CreatedAt, UpdatedAt)
                        VALUES (@id, @asin, @title, @category, @price, @weight, @staple, @status, GETDATE(), GETDATE())
                `);
        }
        
        res.json({ ok: true, inserted: items.length });
    } catch (error) {
        console.error('Bulk create ASINs error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/asins/:id', authenticate, requirePermission('calculator_manage'), async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        await pool.request().input('id', sql.VarChar, id).query("DELETE FROM CalculatorAsins WHERE Id = @id");
        res.json({ ok: true });
    } catch (error) {
        console.error('Delete ASIN error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Health Check ---
router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// --- Calculation Route ---
router.post('/calculate', authenticate, requirePermission('calculator_manage'), async (req, res) => {
    try {
        const { asinIds } = req.body; // Can be empty to calculate all
        await calculateProfits(asinIds);
        res.json({ ok: true, message: 'Calculation completed' });
    } catch (error) {
        console.error('Calculation error:', error);
        res.status(500).json({ message: 'Server error during calculation' });
    }
});

module.exports = router;
