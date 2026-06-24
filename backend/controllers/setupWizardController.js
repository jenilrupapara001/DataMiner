const setupWizardService = require('../services/setupWizardService');

exports.getStatus = async (req, res) => {
  try {
    const status = await setupWizardService.getStatus(req.userId || req.user?.Id || req.user?.id);
    res.json({ success: true, data: status });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.completeStep = async (req, res) => {
  try {
    const { stepName } = req.params;
    const result = await setupWizardService.completeStep(req.userId || req.user?.Id || req.user?.id, stepName);
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await setupWizardService.changePassword(req.userId || req.user?.Id || req.user?.id, currentPassword, newPassword);
    res.json({ success: true, message: 'Password updated' });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

exports.completeWizard = async (req, res) => {
  try {
    const result = await setupWizardService.completeWizard(req.userId || req.user?.Id || req.user?.id);
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
