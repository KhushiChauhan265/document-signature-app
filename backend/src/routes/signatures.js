const express = require('express');
const Signature = require('../models/Signature');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/signatures/
 * @desc    Save a new signature placeholder position on a document
 * @access  Protected (Requires Token)
 */
router.post('/', protect, async (req, res) => {
  try {
    const { documentId, x, y, page } = req.body;

    // 1. Basic validation
    if (!documentId || x === undefined || y === undefined) {
      return res.status(400).json({ message: 'Please provide documentId, x, and y coordinates' });
    }

    // 2. Fetch document to check if it exists
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // 3. Security check: Only the document owner/uploader can place signature boxes
    if (document.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: You do not own this document' });
    }

    // 4. Create signature placement record
    const signature = await Signature.create({
      documentId,
      userId: req.user._id, // Assign to the current user
      x,
      y,
      page: page || 1,
    });

    return res.status(201).json({
      message: 'Signature position saved successfully',
      signature
    });
  } catch (error) {
    console.error('Error saving signature position:', error.message);
    return res.status(500).json({ message: 'Server error saving signature position' });
  }
});

/**
 * @route   GET /api/signatures/:documentId
 * @desc    Retrieve all saved signature positions for a document
 * @access  Protected (Requires Token)
 */
router.get('/:documentId', protect, async (req, res) => {
  try {
    const { documentId } = req.params;

    // 1. Check if document exists
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // 2. Security check: Only the document owner can access the signature list
    if (document.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: You do not own this document' });
    }

    // 3. Retrieve signature coordinates
    const signatures = await Signature.find({ documentId });
    return res.json(signatures);
  } catch (error) {
    console.error('Error retrieving signatures:', error.message);
    return res.status(500).json({ message: 'Server error retrieving signatures' });
  }
});

/**
 * @route   PUT /api/signatures/:id
 * @desc    Update signature position coordinates (e.g. when dragged and repositioned)
 * @access  Protected (Requires Token)
 */
router.put('/:id', protect, async (req, res) => {
  try {
    const { x, y, page } = req.body;

    // 1. Find the signature position entry
    const signature = await Signature.findById(req.params.id);
    if (!signature) {
      return res.status(404).json({ message: 'Signature position entry not found' });
    }

    // 2. Fetch parent document to check access rights
    const document = await Document.findById(signature.documentId);
    if (!document) {
      return res.status(404).json({ message: 'Parent document not found' });
    }

    // 3. Security check: Only the owner who uploaded the document can change signature boxes
    if (document.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: You do not own this document' });
    }

    // 4. Update coordinate values
    signature.x = x !== undefined ? x : signature.x;
    signature.y = y !== undefined ? y : signature.y;
    signature.page = page !== undefined ? page : signature.page;

    await signature.save();

    return res.json({
      message: 'Signature position updated successfully',
      signature
    });
  } catch (error) {
    console.error('Error updating signature position:', error.message);
    return res.status(500).json({ message: 'Server error updating signature position' });
  }
});

module.exports = router;
