const mongoose = require('mongoose');

// Define the shape of our Document records in the database
const DocumentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: [true, 'Please provide the original file name'],
  },
  filePath: {
    type: String,
    required: [true, 'Please provide the saved file path on disk'],
  },
  fileSize: {
    type: Number,
    required: [true, 'Please provide the file size in bytes'],
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Links this document to a specific User
    required: [true, 'Document must belong to an uploader'],
  },
  signerType: {
    type: String,
    enum: ['only-you', 'many-people'],
    default: 'only-you', // 'only-you' (signing yourself) or 'many-people' (inviting others)
  },
  status: {
    type: String,
    enum: ['pending', 'signed', 'rejected'],
    default: 'pending', // Keeps track of document signature lifecycle
  },
  signedFilePath: {
    type: String, // Tracks the generated signed PDF filename on disk
  },
  signers: [{
    email: { type: String, required: true },
    name: { type: String }, // Filled when signing
    signingToken: { type: String },
    signingTokenExpires: { type: Date },
    status: { type: String, enum: ['pending', 'signed'], default: 'pending' },
    signedAt: { type: Date }
  }],
}, {
  // Automatically adds 'createdAt' and 'updatedAt' timestamps
  timestamps: true
});

module.exports = mongoose.model('Document', DocumentSchema);
