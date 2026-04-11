const Ruleset = require('../models/Ruleset');
const RulesetExecutionLog = require('../models/RulesetExecutionLog');
const rulesetEngineService = require('../services/rulesetEngineService');

exports.getAllRulesets = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const filter = {};

    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    if (!isAdmin && req.user.assignedSellers) {
      filter.seller = { $in: req.user.assignedSellers.map(s => s._id) };
    }

    if (type) filter.type = type;
    if (status === 'active') filter.isActive = true;
    if (status === 'archived') filter.isArchived = true;

    const rulesets = await Ruleset.find(filter)
      .populate('seller', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Ruleset.countDocuments(filter);

    res.json({
      rulesets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching rulesets:', error);
    res.status(500).json({ error: 'Failed to fetch rulesets' });
  }
};

exports.getRulesetById = async (req, res) => {
  try {
    const ruleset = await Ruleset.findById(req.params.id)
      .populate('seller', 'name')
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    if (!ruleset) {
      return res.status(404).json({ error: 'Ruleset not found' });
    }

    res.json(ruleset);
  } catch (error) {
    console.error('Error fetching ruleset:', error);
    res.status(500).json({ error: 'Failed to fetch ruleset' });
  }
};

exports.createRuleset = async (req, res) => {
  try {
    const ruleset = new Ruleset({
      ...req.body,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    });
    await ruleset.save();
    res.status(201).json(ruleset);
  } catch (error) {
    console.error('Error creating ruleset:', error);
    res.status(400).json({ error: error.message || 'Failed to create ruleset' });
  }
};

exports.updateRuleset = async (req, res) => {
  try {
    const ruleset = await Ruleset.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastModifiedBy: req.user._id },
      { new: true, runValidators: true }
    );

    if (!ruleset) {
      return res.status(404).json({ error: 'Ruleset not found' });
    }

    res.json(ruleset);
  } catch (error) {
    console.error('Error updating ruleset:', error);
    res.status(400).json({ error: error.message || 'Failed to update ruleset' });
  }
};

exports.deleteRuleset = async (req, res) => {
  try {
    const ruleset = await Ruleset.findByIdAndDelete(req.params.id);
    if (!ruleset) {
      return res.status(404).json({ error: 'Ruleset not found' });
    }
    res.json({ message: 'Ruleset deleted successfully' });
  } catch (error) {
    console.error('Error deleting ruleset:', error);
    res.status(500).json({ error: 'Failed to delete ruleset' });
  }
};

exports.toggleRuleset = async (req, res) => {
  try {
    const ruleset = await Ruleset.findById(req.params.id);
    if (!ruleset) {
      return res.status(404).json({ error: 'Ruleset not found' });
    }

    ruleset.isActive = !ruleset.isActive;
    await ruleset.save();
    res.json(ruleset);
  } catch (error) {
    console.error('Error toggling ruleset:', error);
    res.status(500).json({ error: 'Failed to toggle ruleset' });
  }
};

exports.executeRuleset = async (req, res) => {
  try {
    const result = await rulesetEngineService.evaluateRuleset(req.params.id, {
      triggeredBy: req.user._id.toString()
    });
    res.json(result);
  } catch (error) {
    console.error('Error executing ruleset:', error);
    res.status(500).json({ error: error.message || 'Failed to execute ruleset' });
  }
};

exports.previewRuleset = async (req, res) => {
  try {
    const result = await rulesetEngineService.evaluateRuleset(req.params.id, {
      dryRun: true,
      triggeredBy: req.user._id.toString()
    });
    res.json(result);
  } catch (error) {
    console.error('Error previewing ruleset:', error);
    res.status(500).json({ error: error.message || 'Failed to preview ruleset' });
  }
};

exports.getRulesetHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const logs = await RulesetExecutionLog.find({ ruleset: req.params.id })
      .populate('createdBy', 'name email')
      .sort({ executedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await RulesetExecutionLog.countDocuments({ ruleset: req.params.id });

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching ruleset history:', error);
    res.status(500).json({ error: 'Failed to fetch ruleset history' });
  }
};

exports.getExecutionDetails = async (req, res) => {
  try {
    const log = await RulesetExecutionLog.findById(req.params.logId)
      .populate('ruleset', 'name type')
      .populate('createdBy', 'name email');

    if (!log) {
      return res.status(404).json({ error: 'Execution log not found' });
    }

    res.json(log);
  } catch (error) {
    console.error('Error fetching execution details:', error);
    res.status(500).json({ error: 'Failed to fetch execution details' });
  }
};

exports.duplicateRuleset = async (req, res) => {
  try {
    const original = await Ruleset.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ error: 'Ruleset not found' });
    }

    const duplicate = new Ruleset({
      ...original.toObject(),
      _id: undefined,
      name: `${original.name} (Copy)`,
      isActive: false,
      lastRunAt: null,
      nextRunAt: null,
      totalRunCount: 0,
      lastRunSummary: null,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id,
      createdAt: undefined,
      updatedAt: undefined
    });

    await duplicate.save();
    res.status(201).json(duplicate);
  } catch (error) {
    console.error('Error duplicating ruleset:', error);
    res.status(500).json({ error: 'Failed to duplicate ruleset' });
  }
};