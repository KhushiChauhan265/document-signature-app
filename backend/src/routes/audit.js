const express = require('express');
const AuditLog = require('../models/AuditLog');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * @route   GET /api/audit/:fileId
 * @desc    Get all audit log entries for a specific document (Owner only)
 * @access  Protected (Requires Token)
 */
router.get('/:fileId', protect, async (req, res) => {
  const { fileId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return res.status(400).json({ message: 'Invalid document ID format' });
  }

  try {
    const document = await Document.findById(fileId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Verify ownership: only the owner/uploader can fetch audit log
    if (document.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: You do not own this document' });
    }

    // Fetch audit logs sorted newest-first
    const logs = await AuditLog.find({ fileId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email');

    return res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error.message);
    return res.status(500).json({ message: 'Server error retrieving audit logs' });
  }
});

module.exports = router;
