const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: [true, 'Audit log entry must refer to a document file'],
  },
  action: {
    type: String,
    required: [true, 'Audit log entry must specify an action'],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  signerEmail: {
    type: String,
  },
  signerName: {
    type: String,
  },
  ipAddress: {
    type: String,
    required: true,
    default: 'unknown'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  }
}, {
  timestamps: true // Automatically adds 'createdAt' and 'updatedAt' timestamps
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
