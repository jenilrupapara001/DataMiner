// Centralized email template registry
// Usage: const { brandAssigned } = require('../emails');
//        const html = brandAssigned({ userName, sellerName, ... });

const otpLogin        = require('./templates/auth/otpLogin');
const accountLockout  = require('./templates/auth/accountLockout');
const manualEmail     = require('./templates/admin/manualEmail');
const brandAssigned   = require('./templates/sellers/brandAssigned');
const brandRemoved    = require('./templates/sellers/brandRemoved');
const taskAssigned    = require('./templates/pems/taskAssigned');
const taskSubmitted   = require('./templates/pems/taskSubmitted');
const taskApproved    = require('./templates/pems/taskApproved');
const taskRejected    = require('./templates/pems/taskRejected');
const slaBreach       = require('./templates/pems/slaBreach');
const taskEscalated   = require('./templates/pems/taskEscalated');

module.exports = {
  otpLogin,
  accountLockout,
  manualEmail,
  brandAssigned,
  brandRemoved,
  taskAssigned,
  taskSubmitted,
  taskApproved,
  taskRejected,
  slaBreach,
  taskEscalated,
};
