const schemas = require('../validation/schemas');
const { sanitizeObject } = require('../utils/sanitize');

/**
 * Generic error message — never expose which field failed
 */
const GENERIC_AUTH_ERROR = 'Invalid input. Please check your form and try again.';

const validate = (schemaName, source = 'body') => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();

    const data = source === 'query' ? req.query : source === 'params' ? req.params : req.body;

    // Sanitize inputs before validation
    if (source === 'body' && data && typeof data === 'object') {
      req.body = sanitizeObject(data);
    }

    const { error, value } = schema.validate(req.body || data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      // Log validation failures server-side for monitoring
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
        type: d.type,
      }));
      console.warn(`[VALIDATION_FAILURE] schema=${schemaName} fields=${details.map(d => d.field).join(',')} ip=${req.ip} ua=${req.headers['user-agent']}`);

      // Auth-related schemas get generic error (don't expose field names)
      const isAuthSchema = ['login', 'register', 'changePassword', 'verifyOtp', 'resendOtp'].includes(schemaName);
      if (isAuthSchema) {
        return res.status(400).json({
          success: false,
          message: GENERIC_AUTH_ERROR
        });
      }

      // Other schemas return field-level errors
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        details
      });
    }

    // Apply sanitized values back to request
    if (source === 'query') req.query = value;
    else if (source === 'params') req.params = value;
    else req.body = value;

    next();
  };
};

module.exports = validate;
