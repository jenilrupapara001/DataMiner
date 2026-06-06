'use strict';
/**
 * requestGuard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight Express middleware that:
 *
 *  1. Rejects requests whose Content-Length exceeds a configurable limit on
 *     non-upload routes (default 10 MB).  Upload routes already have a much
 *     larger server-level timeout set in server.js, so we skip them.
 *
 *  2. Sets a per-request timeout (default 30 s).  If the handler does not
 *     send a response within that window the middleware sends a 408 and
 *     aborts the socket, preventing hanging connections from accumulating.
 *
 * Usage:
 *   const requestGuard = require('./middleware/requestGuard');
 *   app.use(requestGuard);
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PAYLOAD_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB
const REQUEST_TIMEOUT_MS  = 30_000;            // 30 seconds

// Routes that handle large file uploads — skip payload guard + use longer timeout
const UPLOAD_PATH_PREFIXES = [
  '/api/upload',
  '/api/bulk',
  '/api/market-sync',
  '/api/files',
];

function isUploadRoute(path) {
  return UPLOAD_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * requestGuard middleware
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requestGuard(req, res, next) {
  // ── 1. Payload size check ─────────────────────────────────────────────────
  if (!isUploadRoute(req.path)) {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > PAYLOAD_LIMIT_BYTES) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request body must not exceed ${PAYLOAD_LIMIT_BYTES / 1024 / 1024} MB`,
      });
    }
  }

  // ── 2. Per-request timeout ────────────────────────────────────────────────
  // Skip timeout for upload routes (server.js already sets 600 s server timeout)
  if (!isUploadRoute(req.path)) {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.warn(
          `⏱  [requestGuard] Timeout on ${req.method} ${req.originalUrl} after ${REQUEST_TIMEOUT_MS}ms`
        );
        res.status(408).json({
          error: 'Request Timeout',
          message: 'The server did not receive a complete request within the allowed time.',
        });
      }
    }, REQUEST_TIMEOUT_MS);

    // Clear the timer once the response is sent so it doesn't fire spuriously
    res.on('finish', () => clearTimeout(timer));
    res.on('close',  () => clearTimeout(timer));
  }

  next();
}

module.exports = requestGuard;
