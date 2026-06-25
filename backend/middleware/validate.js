const schemas = require('../validation/schemas');

const validate = (schemaName, source = 'body') => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();

    const data = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
    if (schemaName === 'createSeller') console.log(`[VALIDATE] ${schemaName} incoming:`, JSON.stringify(data));
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true, convert: true });

    if (error) {
      console.log(`[VALIDATE] ${schemaName} FAILED:`, JSON.stringify(error.details.map(d => ({ field: d.path.join('.'), message: d.message }))));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
      });
    }

    if (source === 'query') req.query = value;
    else if (source === 'params') req.params = value;
    else req.body = value;
    next();
  };
};

module.exports = validate;
