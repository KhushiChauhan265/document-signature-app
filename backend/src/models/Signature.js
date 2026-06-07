const mongoose = require('mongoose');

// Define the shape of our Signature placements in the database
const SignatureSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: [true, 'Signature placement must refer to a document'],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Signature placement must refer to a user uploader/signer'],
  },
  x: {
    type: Number, // Stored as percentage (0 to 100) relative to page width
    required: [true, 'Please provide the horizontal x-coordinate (0-100)'],
  },
  y: {
    type: Number, // Stored as percentage (0 to 100) relative to page height
    required: [true, 'Please provide the vertical y-coordinate (0-100)'],
  },
  page: {
    type: Number,
    required: [true, 'Please specify the document page number'],
    default: 1,
  },
  status: {
    type: String,
    enum: ['pending', 'signed'],
    default: 'pending', // Keeps track of signature box state
  },
}, {
  // Automatically adds 'createdAt' and 'updatedAt' timestamps
  timestamps: true
});

module.exports = mongoose.model('Signature', SignatureSchema);
