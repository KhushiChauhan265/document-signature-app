const AuditLog = require('../models/AuditLog');

/**
 * Log audit events for document tracking.
 * Captures action details, user/signer references, and client IP securely.
 */
const logAudit = async ({ fileId, action, userId, signerEmail, signerName, req, metadata }) => {
  try {
    let ipAddress = 'unknown';

    if (req) {
      // 1. Prefer req.ip as the primary IP source
      if (req.ip) {
        ipAddress = req.ip;
      } else {
        // 2. Fall back to x-forwarded-for only if req.ip is not set, taking the first client IP address
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
          ipAddress = forwarded.split(',')[0].trim();
        } else {
          ipAddress = req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
        }
      }
    }

    await AuditLog.create({
      fileId,
      action,
      userId,
      signerEmail,
      signerName,
      ipAddress,
      metadata
    });
  } catch (err) {
    console.error('Audit logging failed:', err.message);
  }
};

module.exports = { logAudit };
