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

module.exports = router;
