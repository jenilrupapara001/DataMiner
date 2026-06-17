const SystemLogService = require('../services/SystemLogService');
const asyncLocalStorage = require('../utils/asyncStorage');

// Mask sensitive keys (passwords, access tokens, API keys) in metadata
function maskSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveKeys = ['password', 'token', 'accessToken', 'refreshToken', 'secret', 'key', 'apiKey'];
  const masked = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      masked[key] = '********';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}

// Map endpoints and methods to clean types and titles
function parseRequest(req) {
  const method = req.method;
  const path = req.originalUrl.split('?')[0];
  
  let entityType = 'SYSTEM';
  let type = 'API_CALL';
  let entityTitle = 'System Event';
  let description = `${method} ${path}`;
  let entityId = null;

  const segments = path.split('/').filter(Boolean);
  
  for (const segment of segments) {
    if (/^[a-f0-9]{24}$/i.test(segment) || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segment)) {
      entityId = segment;
      break;
    }
  }

  if (path.includes('/api/sellers') || path.includes('/api/seller-tracker')) {
    entityType = 'SELLER';
  } else if (path.includes('/api/asins') || path.includes('/api/asins-table') || path.includes('/api/listing-quality')) {
    entityType = 'ASIN';
  } else if (path.includes('/api/targets')) {
    entityType = 'MONTHLY_DATA';
  } else if (path.includes('/api/objectives')) {
    entityType = 'OBJECTIVE';
  } else if (path.includes('/api/actions')) {
    entityType = 'ACTION';
  } else if (path.includes('/api/users') || path.includes('/api/auth')) {
    entityType = 'USER';
  } else if (path.includes('/api/roles') || path.includes('/api/teams') || path.includes('/api/settings') || path.includes('/api/keys') || path.includes('/api/rulesets') || path.includes('/api/tasks') || path.includes('/api/scheduled-runs') || path.includes('/api/bulk')) {
    entityType = 'SYSTEM';
  }

  if (method === 'GET') {
    type = 'READ';
  } else if (method === 'POST') {
    if (path.includes('/import') || path.includes('/bulk') || path.includes('/upload')) {
      type = 'IMPORT';
    } else {
      type = 'CREATE';
    }
  } else if (method === 'PUT' || method === 'PATCH') {
    type = 'UPDATE';
  } else if (method === 'DELETE') {
    type = 'DELETE';
  }

  const apiIndex = segments.indexOf('api');
  const resourceSegment = apiIndex !== -1 && segments[apiIndex + 1] ? segments[apiIndex + 1] : 'system';
  
  const formatResourceName = (segment) => {
    return segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  const resourceName = formatResourceName(resourceSegment);
  
  switch (type) {
    case 'READ':
      entityTitle = `${resourceName} Fetch`;
      description = `Fetched ${resourceSegment.replace(/-/g, ' ')}`;
      if (entityId) {
        description += ` details (ID: ${entityId})`;
      } else {
        description += ` list`;
      }
      break;
    case 'CREATE':
      entityTitle = `Create ${resourceName}`;
      description = `Created new ${resourceSegment.replace(/-/g, ' ').replace(/s$/, '')}`;
      if (req.body && (req.body.name || req.body.Name || req.body.title || req.body.Title || req.body.email || req.body.Email)) {
        const val = req.body.name || req.body.Name || req.body.title || req.body.Title || req.body.email || req.body.Email;
        description += `: "${val}"`;
      }
      break;
    case 'IMPORT':
      entityTitle = `Import ${resourceName}`;
      description = `Imported bulk data for ${resourceSegment.replace(/-/g, ' ')}`;
      break;
    case 'UPDATE':
      entityTitle = `Update ${resourceName}`;
      description = `Updated ${resourceSegment.replace(/-/g, ' ').replace(/s$/, '')}`;
      if (entityId) {
        description += ` (ID: ${entityId})`;
      }
      if (req.body && (req.body.name || req.body.Name || req.body.title || req.body.Title || req.body.email || req.body.Email)) {
        const val = req.body.name || req.body.Name || req.body.title || req.body.Title || req.body.email || req.body.Email;
        description += ` ("${val}")`;
      }
      break;
    case 'DELETE':
      entityTitle = `Delete ${resourceName}`;
      description = `Deleted ${resourceSegment.replace(/-/g, ' ').replace(/s$/, '')}`;
      if (entityId) {
        description += ` (ID: ${entityId})`;
      }
      break;
    default:
      entityTitle = `${method} Request`;
      description = `${method} ${path}`;
  }

  return { type, entityType, entityTitle, description, entityId };
}

const ignoredPaths = [
  /^\/api\/health/i,
  /^\/api\/notifications/i,
  /^\/api\/export\/downloads/i
];

module.exports = async (req, res, next) => {
  // Only intercept API paths
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }

  // Check if URL is in ignored paths list
  const isIgnored = ignoredPaths.some(regex => regex.test(req.originalUrl));
  if (isIgnored) {
    return next();
  }

  const start = Date.now();

  res.on('finish', async () => {
    // Only log successful responses (status 2xx)
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return;
    }

    // Check if request was already manually logged (via AsyncLocalStorage context)
    const store = asyncLocalStorage.getStore();
    if (store && store.logged) {
      return;
    }

    const user = req.user || req.userId || null;

    try {
      const { type, entityType, entityTitle, description, entityId } = parseRequest(req);
      const duration = Date.now() - start;

      const metadata = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress,
        durationMs: duration,
        statusCode: res.statusCode,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        body: req.method !== 'GET' && req.body && Object.keys(req.body).length > 0 ? maskSensitiveData(req.body) : undefined
      };

      await SystemLogService.log({
        type,
        entityType,
        entityId,
        entityTitle,
        user,
        description,
        metadata
      });
    } catch (err) {
      console.error('[apiCallLogger] Failed to write log:', err);
    }
  });

  next();
};
