const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Define uploads directory path
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists on server startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 1. Configure Multer Disk Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// 2. Configure File Filter (Verify it is a PDF)
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF documents are allowed!'), false);
  }
};

// Initialize Multer upload middleware
// Limit file size to 10MB
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('pdf'); // Expecting the file field key to be named 'pdf'

/**
 * @route   POST /api/docs/upload
 * @desc    Upload a PDF document and save metadata to MongoDB
 * @access  Protected (Requires Token)
 */
router.post('/upload', protect, (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF file' });
    }

    try {
      const { signerType } = req.body;

      // Save document details to MongoDB
      const document = await Document.create({
        fileName: req.file.originalname,
        filePath: req.file.filename,
        fileSize: req.file.size, // Save size in bytes
        uploadedBy: req.user._id, // Save uploader reference
        signerType: signerType || 'only-you'
      });

      return res.status(201).json({
        message: 'File uploaded successfully',
        document
      });
    } catch (dbError) {
      console.error('Database write error:', dbError.message);
      
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({ message: 'Server database write failure during upload' });
    }
  });
});

/**
 * @route   GET /api/docs/
 * @desc    Fetch all documents uploaded by the logged-in user
 * @access  Protected (Requires Token)
 */
router.get('/', protect, async (req, res) => {
  try {
    // Retrieve all documents owned by the logged-in user, sorted by newest first
    const documents = await Document.find({ uploadedBy: req.user._id }).sort({ createdAt: -1 });
    return res.json(documents);
  } catch (error) {
    console.error('Error fetching documents list:', error.message);
    return res.status(500).json({ message: 'Server error fetching documents' });
  }
});

/**
 * @route   GET /api/docs/:id
 * @desc    Fetch a specific document's metadata (with ownership validation)
 * @access  Protected (Requires Token)
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Validate ownership: only the uploader can view this document
    if (document.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: You do not own this document' });
    }

    return res.json(document);
  } catch (error) {
    console.error('Error fetching document details:', error.message);
    return res.status(500).json({ message: 'Server error retrieving document metadata' });
  }
});

module.exports = router;
