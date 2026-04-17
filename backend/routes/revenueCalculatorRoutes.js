const express = require('express');
const router = express.Router();
const {
  ReferralFee,
  ClosingFee,
  ShippingFee,
  StorageFee,
  CategoryMap,
  NodeMap,
  RefundFee,
  AsinItem,
  RevenueUser
} = require('../models/RevenueCalculatorModel');
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
    let model;

    switch (type) {
      case 'referral':
        model = ReferralFee;
        break;
      case 'closing':
        model = ClosingFee;
        break;
      case 'shipping':
        model = ShippingFee;
        break;
      case 'storage':
        model = StorageFee;
        break;
      case 'refund':
        model = RefundFee;
        break;
      default:
        return res.status(400).json({ message: 'Invalid fee type' });
    }

    const fees = await model.find();
    res.json(fees);
  } catch (error) {
    console.error('Get fees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create or update fee
router.post('/fees/:type', authenticate, requirePermission('calculator_config'), async (req, res) => {
  try {
    const type = req.params.type;
    let model;

    switch (type) {
      case 'referral':
        model = ReferralFee;
        break;
      case 'closing':
        model = ClosingFee;
        break;
      case 'shipping':
        model = ShippingFee;
        break;
      case 'storage':
        model = StorageFee;
        break;
      case 'refund':
        model = RefundFee;
        break;
      default:
        return res.status(400).json({ message: 'Invalid fee type' });
    }

    const doc = req.body;
    if (!doc.id) {
      doc.id = Date.now().toString();
    }

    const updatedDoc = await model.findOneAndUpdate(
      { id: doc.id },
      doc,
      { upsert: true, new: true }
    );

    res.json({ ok: true, id: updatedDoc.id });
  } catch (error) {
    console.error('Save fee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete fee
router.delete('/fees/:type/:id', authenticate, requirePermission('calculator_config'), async (req, res) => {
  try {
    const type = req.params.type;
    const { id } = req.params;
    let model;

    switch (type) {
      case 'referral':
        model = ReferralFee;
        break;
      case 'closing':
        model = ClosingFee;
        break;
      case 'shipping':
        model = ShippingFee;
        break;
      case 'storage':
        model = StorageFee;
        break;
      case 'refund':
        model = RefundFee;
        break;
      default:
        return res.status(400).json({ message: 'Invalid fee type' });
    }

    await model.deleteOne({ id });
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete fee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete all fees for type
router.delete('/fees/:type/all', authenticate, requirePermission('calculator_config'), async (req, res) => {
  try {
    const type = req.params.type;
    let model;

    switch (type) {
      case 'referral':
        model = ReferralFee;
        break;
      case 'closing':
        model = ClosingFee;
        break;
      case 'shipping':
        model = ShippingFee;
        break;
      case 'storage':
        model = StorageFee;
        break;
      case 'refund':
        model = RefundFee;
        break;
      default:
        return res.status(400).json({ message: 'Invalid fee type' });
    }

    await model.deleteMany({});
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete all fees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Category Mapping Routes ---
router.get('/mappings', authenticate, requirePermission('calculator_view'), async (req, res) => {
  try {
    const mappings = await CategoryMap.find();
    res.json(mappings);
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/mappings', authenticate, requirePermission('calculator_config'), async (req, res) => {
  try {
    const doc = req.body;
    if (!doc.id) {
      doc.id = Date.now().toString();
    }

    const updatedDoc = await CategoryMap.findOneAndUpdate(
      { id: doc.id },
      doc,
      { upsert: true, new: true }
    );

    res.json({ ok: true, id: updatedDoc.id });
  } catch (error) {
    console.error('Save mapping error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/mappings/:id', authenticate, requirePermission('calculator_config'), async (req, res) => {
  try {
    const { id } = req.params;
    await CategoryMap.deleteOne({ id });
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete mapping error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/mappings/all', authenticate, requirePermission('calculator_config'), async (req, res) => {
  try {
    await CategoryMap.deleteMany({});
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete all mappings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Node Mapping Routes ---
router.get('/nodemaps', authenticate, requirePermission('calculator_view'), async (req, res) => {
  try {
    const nodeMaps = await NodeMap.find();
    res.json(nodeMaps);
  } catch (error) {
    console.error('Get node maps error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/nodemaps', authenticate, requirePermission('calculator_config'), async (req, res) => {
  try {
    const doc = req.body;
    if (!doc.id) {
      doc.id = Date.now().toString();
    }

    const updatedDoc = await NodeMap.findOneAndUpdate(
      { id: doc.id },
      doc,
      { upsert: true, new: true }
    );

    res.json({ ok: true, id: updatedDoc.id });
  } catch (error) {
    console.error('Save node map error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/nodemaps/:id', authenticate, requirePermission('calculator_config'), async (req, res) => {
  try {
    const { id } = req.params;
    await NodeMap.deleteOne({ id });
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete node map error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/nodemaps/all', authenticate, requirePermission('calculator_config'), async (req, res) => {
  try {
    await NodeMap.deleteMany({});
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete all node maps error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- ASIN Management Routes ---
router.get('/asins', authenticate, requirePermission('calculator_view'), async (req, res) => {
  try {
    const asins = await AsinItem.find();
    res.json(asins);
  } catch (error) {
    console.error('Get ASINs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/asins/bulk', authenticate, requirePermission('calculator_bulk'), async (req, res) => {
  try {
    const items = req.body || [];
    const processedItems = items.map(item => ({
      ...item,
      id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
      status: item.status || 'pending',
      stapleLevel: item.stapleLevel || 'Standard',
      createdAt: item.createdAt || new Date()
    }));

    if (processedItems.length === 0) {
      return res.json({ ok: true, inserted: 0 });
    }

    const operations = processedItems.map(item => ({
      updateOne: {
        filter: { id: item.id },
        update: item,
        upsert: true
      }
    }));

    await AsinItem.bulkWrite(operations);
    res.json({ ok: true, inserted: processedItems.length });
  } catch (error) {
    console.error('Bulk create ASINs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/asins/:id', authenticate, requirePermission('calculator_bulk'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    await AsinItem.findOneAndUpdate({ id }, { $set: updates });
    res.json({ ok: true });
  } catch (error) {
    console.error('Update ASIN error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/asins/:id', authenticate, requirePermission('calculator_bulk'), async (req, res) => {
  try {
    const { id } = req.params;
    await AsinItem.deleteOne({ id });
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete ASIN error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/asins', authenticate, requirePermission('calculator_bulk'), async (req, res) => {
  try {
    await AsinItem.deleteMany({});
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete all ASINs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Storage Fee Convenience Route ---
router.get('/fees/storage', authenticate, requirePermission('calculator_view'), async (req, res) => {
  try {
    const fees = await StorageFee.find();
    res.json(fees);
  } catch (error) {
    console.error('Get storage fees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Health Check ---
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// --- Calculation Route ---
router.post('/calculate', authenticate, requirePermission('calculator_bulk'), async (req, res) => {
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
