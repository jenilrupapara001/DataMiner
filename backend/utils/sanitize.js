/**
 * Input Sanitization Utility
 * Strips HTML tags, script tags, and dangerous special characters
 */

// Strip HTML tags (including encoded variants)
const stripHtml = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/<[^>]*>/gi, '')                    // HTML tags
    .replace(/&lt;|&gt;|&amp;|&quot;|&#x27;/gi, '') // Encoded tags
    .replace(/javascript:/gi, '')                 // javascript: URIs
    .replace(/on\w+\s*=/gi, '')                  // Event handlers
    .replace(/data:/gi, '')                       // data: URIs
    .trim();
};

// Sanitize a string: strip HTML + dangerous chars, trim
const sanitizeString = (input) => {
  if (typeof input !== 'string') return input;
  return stripHtml(input)
    .replace(/[<>]/g, '')         // residual angle brackets
    .replace(/\{/g, '(')          // prevent JSON injection
    .replace(/\}/g, ')')
    .replace(/`/g, "'")           // prevent template literal injection
    .trim();
};

// Deep sanitize an object (all string values)
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(v => typeof v === 'string' ? sanitizeString(v) : v);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

module.exports = { sanitizeString, sanitizeObject, stripHtml };
