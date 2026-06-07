const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const Signature = require('../models/Signature');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Define uploads and signed directories
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const SIGNED_DIR = path.join(__dirname, '../../signed-pdfs');

// Ensure uploads and signed directories exist on server startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(SIGNED_DIR)) {
  fs.mkdirSync(SIGNED_DIR, { recursive: true });
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
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid document ID format' });
  }

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

/**
 * @route   POST /api/docs/:id/finalize
 * @desc    Generate final signed PDF by embedding signature boxes using PDF-Lib
 * @access  Protected (Requires Token)
 */
router.post('/:id/finalize', protect, async (req, res) => {
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid document ID format' });
  }

  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Security check: Only the document owner/uploader can finalize
    if (document.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: You do not own this document' });
    }

    // Retrieve all signature placements for this document
    const signatures = await Signature.find({ documentId: document._id });
    if (signatures.length === 0) {
      return res.status(400).json({ message: 'Please place at least one signature box before finalizing.' });
    }

    // Get path of original uploaded PDF
    const originalPath = path.join(UPLOAD_DIR, document.filePath);
    if (!fs.existsSync(originalPath)) {
      return res.status(404).json({ message: 'Original PDF file not found on server.' });
    }

    // Read original PDF into buffer
    const existingPdfBytes = fs.readFileSync(originalPath);

    // Load PDF using pdf-lib
    const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();

    // Embed HelveticaBold font for signature rendering
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Embed each signature into the PDF
    for (const signature of signatures) {
      const pageIndex = signature.page - 1; // Translate 1-indexed page to 0-indexed page
      if (pageIndex < 0 || pageIndex >= pages.length) {
        continue; // Skip invalid page numbers safely
      }

      const page = pages[pageIndex];
      const { width, height } = page.getSize();

      // Translate coordinates from percentage (where x/y represents the center of the box)
      const x_center = (signature.x / 100) * width;
      const y_center = ((100 - signature.y) / 100) * height;

      // Render a styled signature text box
      const text = `Signed by: ${req.user.name}`;
      const fontSize = 10;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const paddingX = 8;
      const paddingY = 6;
      const boxWidth = textWidth + paddingX * 2;
      const boxHeight = fontSize + paddingY * 2;

      // Center the bounding box around (x_center, y_center)
      const drawX = x_center - (boxWidth / 2);
      const drawY = y_center - (boxHeight / 2);

      // Draw background box
      page.drawRectangle({
        x: drawX,
        y: drawY,
        width: boxWidth,
        height: boxHeight,
        color: rgb(0.9, 0.96, 0.95), // Teal-50
        borderColor: rgb(0.08, 0.55, 0.49), // Teal-600
        borderWidth: 1,
      });

      // Draw text
      page.drawText(text, {
        x: drawX + paddingX,
        y: drawY + paddingY + 1.5, // vertical offset for text baseline alignment
        size: fontSize,
        font: font,
        color: rgb(0.08, 0.55, 0.49), // Teal-600
      });
    }

    // Save finalized PDF
    const signedPdfBytes = await pdfDoc.save();
    
    // Create new signed filename
    const uniqueSuffix = Date.now();
    const ext = path.extname(document.fileName);
    const baseName = path.basename(document.fileName, ext).replace(/\s+/g, '_');
    const signedFileName = `${baseName}-signed-${uniqueSuffix}${ext}`;
    const signedFilePath = path.join(SIGNED_DIR, signedFileName);

    // Write file to signed-pdfs folder
    fs.writeFileSync(signedFilePath, signedPdfBytes);

    // Update Document model
    document.status = 'signed';
    document.signedFilePath = signedFileName;
    await document.save();

    // Update all signatures status to 'signed'
    await Signature.updateMany({ documentId: document._id }, { status: 'signed' });

    return res.json({
      message: 'Document finalized and signed successfully',
      document
    });

  } catch (error) {
    console.error('Error finalizing PDF:', error.message);
    return res.status(500).json({ message: 'Server error generating signed PDF document' });
  }
});

/**
 * @route   GET /api/docs/:id/download-signed
 * @desc    Download the finalized signed PDF document (with ownership validation)
 * @access  Protected (Requires Token)
 */
router.get('/:id/download-signed', protect, async (req, res) => {
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid document ID format' });
  }

  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Security check: Only the owner/uploader can download
    if (document.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied: You do not own this document' });
    }

    // Check if document has been finalized/signed
    if (document.status !== 'signed' || !document.signedFilePath) {
      return res.status(400).json({ message: 'Document has not been finalized yet' });
    }

    const filePath = path.join(SIGNED_DIR, document.signedFilePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Signed PDF file not found on server disk storage' });
    }

    // Set correct headers and send file
    res.setHeader('Content-Type', 'application/pdf');
    return res.sendFile(filePath);

  } catch (error) {
    console.error('Error downloading signed PDF:', error.message);
    return res.status(500).json({ message: 'Server error downloading signed PDF' });
  }
});

module.exports = router;
