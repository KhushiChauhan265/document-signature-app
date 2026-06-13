const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const Signature = require('../models/Signature');
const { protect } = require('../middleware/auth');
const { logAudit } = require('../middleware/auditLogger');

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

    // Business Rule: Block owner finalize for many-people documents
    if (document.signerType === 'many-people') {
      return res.status(400).json({ message: 'Documents with "many-people" signing flow must be signed by the invited signers via their public links.' });
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

    await logAudit({
      fileId: document._id,
      action: 'document_signed',
      userId: req.user._id,
      signerName: req.user.name,
      signerEmail: req.user.email,
      req,
      metadata: { type: 'owner_finalize' }
    });

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

/**
 * @route   POST /api/docs/:id/share
 * @desc    Generate a secure public signing link for a document (Owner only, supports multiple emails)
 * @access  Protected (Requires Token)
 */
router.post('/:id/share', protect, async (req, res) => {
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid document ID format' });
  }

  try {
    const { emails } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: 'Please provide a non-empty array of signer email addresses' });
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Business Rule: only-you documents cannot show Invite Signer / call share route successfully
    if (document.signerType !== 'many-people') {
      return res.status(400).json({ message: 'Sharing is only allowed for documents with signerType "many-people"' });
    }

    // Business Rule: already signed documents cannot accept new invites
    if (document.status === 'signed') {
      return res.status(400).json({ message: 'This document has already been signed and finalized' });
    }

    // Validate emails and filter out duplicates
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const rawEmails = emails.map(e => e.trim().toLowerCase());
    const uniqueEmails = [];
    const skipped = [];
    
    for (const email of rawEmails) {
      if (uniqueEmails.includes(email)) {
        skipped.push(email);
      } else {
        uniqueEmails.push(email);
      }
    }

    const invalidEmails = uniqueEmails.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      return res.status(400).json({ message: `Invalid email address format: ${invalidEmails.join(', ')}` });
    }

    // Fetch placed signature coordinates
    const signatures = await Signature.find({ documentId: document._id });
    
    // Business Rule: Prevent pure index-based mapping.
    // Pair each placed signature box with an invited signer email explicitly.
    if (signatures.length < uniqueEmails.length) {
      return res.status(400).json({
        message: `You have placed ${signatures.length} signature box(es), but you are inviting ${uniqueEmails.length} signer(s). Please place at least one signature box per signer in the editor.`
      });
    }

    // Assign signer emails to signature coordinates explicitly (round-robin / one-to-one)
    for (let i = 0; i < signatures.length; i++) {
      const assignedEmail = uniqueEmails[i % uniqueEmails.length];
      signatures[i].signerEmail = assignedEmail;
      await signatures[i].save();
    }

    // Overwrite the document signers array with the new list
    const crypto = require('crypto');
    document.signers = [];

    const sent = [];
    const failed = [];

    // Verify whether email credentials and frontend url are configured in .env
    const isEnvConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_FROM && process.env.CLIENT_PUBLIC_SIGN_URL);

    // Setup Nodemailer transporter if config is present
    const nodemailer = require('nodemailer');
    let transporter;
    if (isEnvConfigured) {
      try {
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
      } catch (err) {
        console.error('Nodemailer transporter initialization failed:', err.message);
      }
    }

    for (const email of uniqueEmails) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      document.signers.push({
        email,
        signingToken: token,
        signingTokenExpires: expiry,
        status: 'pending'
      });

      // Construct signing link
      const link = `${process.env.CLIENT_PUBLIC_SIGN_URL || 'http://localhost:5173'}/?token=${token}`;

      if (isEnvConfigured && transporter) {
        const mailOptions = {
          from: process.env.EMAIL_FROM,
          to: email,
          subject: `Signature Invitation for document: ${document.fileName}`,
          text: `Hello,\n\nYou have been invited to sign the document "${document.fileName}" as an external signer.\n\nPlease open the following link to review and sign the document:\n\n${link}\n\nThis link will expire in 24 hours.\n\nThank you!`
        };

        try {
          await transporter.sendMail(mailOptions);
          sent.push({ email, link, status: 'sent' });
        } catch (mailErr) {
          console.error(`SMTP delivery failed to ${email}:`, mailErr.message);
          failed.push({ email, error: `SMTP delivery failed: ${mailErr.message}`, link });
        }
      } else {
        // Collect missing environment variables
        const missingVars = [];
        if (!process.env.EMAIL_USER) missingVars.push('EMAIL_USER');
        if (!process.env.EMAIL_PASS) missingVars.push('EMAIL_PASS');
        if (!process.env.EMAIL_FROM) missingVars.push('EMAIL_FROM');
        if (!process.env.CLIENT_PUBLIC_SIGN_URL) missingVars.push('CLIENT_PUBLIC_SIGN_URL');

        const errorMsg = missingVars.length > 0
          ? `Email not sent. Missing env variables: ${missingVars.join(', ')}`
          : 'Email not sent. SMTP initialization failed.';

        failed.push({ email, error: errorMsg, link });
      }

      // Log audit event for this invitation
      const wasEmailed = sent.some(s => s.email === email);
      await logAudit({
        fileId: document._id,
        action: 'invite_email_sent',
        userId: req.user._id,
        signerEmail: email,
        req,
        metadata: { link, emailed: wasEmailed }
      });
    }

    await document.save();

    let message = 'Signing links generated successfully';
    if (!isEnvConfigured) {
      message = 'Signing links generated, but emails were not sent because SMTP credentials are missing in the backend .env';
    } else if (failed.length > 0) {
      message = sent.length > 0
        ? 'Signing links generated; some invitation emails failed to send.'
        : 'Signing links generated, but all invitation emails failed to send.';
    } else {
      message = 'Signing links generated and invitation emails sent successfully!';
    }

    return res.json({
      message,
      sent,
      failed,
      skipped,
      signersCount: uniqueEmails.length,
      emailServiceConfigured: isEnvConfigured
    });

  } catch (error) {
    console.error('Error sharing document:', error.message);
    return res.status(500).json({ message: 'Server error sharing document' });
  }
});

/**
 * @route   GET /api/docs/public/verify/:token
 * @desc    Verify public signing token and return document details
 * @access  Public
 */
router.get('/public/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const document = await Document.findOne({ 'signers.signingToken': token });

    if (!document) {
      return res.status(404).json({ message: 'Invalid or expired signing link' });
    }

    const signer = document.signers.find(s => s.signingToken === token);
    if (!signer) {
      return res.status(404).json({ message: 'Invalid or expired signing link' });
    }

    // Check expiry
    if (signer.signingTokenExpires && signer.signingTokenExpires < Date.now()) {
      return res.status(400).json({ message: 'Signing link has expired' });
    }

    // Check if document or signer is already rejected
    if (document.status === 'rejected') {
      return res.status(400).json({ message: 'This document has been rejected' });
    }

    // Check if this signer already signed or rejected
    if (signer.status === 'signed') {
      return res.status(400).json({ message: 'You have already completed signing for this document' });
    }
    if (signer.status === 'rejected') {
      return res.status(400).json({ message: 'You have rejected this document' });
    }

    // Fetch coordinates
    const signatures = await Signature.find({ documentId: document._id });

    await logAudit({
      fileId: document._id,
      action: 'signature_link_opened',
      signerEmail: signer.email,
      req
    });

    return res.json({
      document: {
        _id: document._id,
        fileName: document.fileName,
        signerEmail: signer.email,
        status: document.status
      },
      signatures
    });

  } catch (error) {
    console.error('Error verifying public token:', error.message);
    return res.status(500).json({ message: 'Server error verifying public link' });
  }
});

/**
 * @route   GET /api/docs/public/view/:token
 * @desc    Stream original PDF for public signer preview
 * @access  Public
 */
router.get('/public/view/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const document = await Document.findOne({ 'signers.signingToken': token });

    if (!document) {
      return res.status(404).json({ message: 'Invalid or expired signing link' });
    }

    const signer = document.signers.find(s => s.signingToken === token);
    if (!signer) {
      return res.status(404).json({ message: 'Invalid or expired signing link' });
    }

    if (signer.signingTokenExpires && signer.signingTokenExpires < Date.now()) {
      return res.status(400).json({ message: 'Signing link has expired' });
    }

    const filePath = path.join(UPLOAD_DIR, document.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Original PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');

    await logAudit({
      fileId: document._id,
      action: 'document_viewed',
      signerEmail: signer.email,
      req
    });

    return res.sendFile(filePath);

  } catch (error) {
    console.error('Error serving public PDF:', error.message);
    return res.status(500).json({ message: 'Server error loading PDF preview' });
  }
});

/**
 * @route   POST /api/docs/public/reject/:token
 * @desc    Reject a document signature request with a reason
 * @access  Public
 */
router.post('/public/reject/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { rejectReason } = req.body;

    if (!rejectReason || !rejectReason.trim()) {
      return res.status(400).json({ message: 'Please provide a reason to reject the document' });
    }

    const document = await Document.findOne({ 'signers.signingToken': token });
    if (!document) {
      return res.status(404).json({ message: 'Invalid or expired signing link' });
    }

    const signer = document.signers.find(s => s.signingToken === token);
    if (!signer) {
      return res.status(404).json({ message: 'Invalid or expired signing link' });
    }

    if (signer.signingTokenExpires && signer.signingTokenExpires < Date.now()) {
      return res.status(400).json({ message: 'Signing link has expired' });
    }

    if (document.status === 'rejected') {
      return res.status(400).json({ message: 'This document has already been rejected' });
    }

    if (signer.status === 'signed') {
      return res.status(400).json({ message: 'You have already signed this document and cannot reject it' });
    }

    if (signer.status === 'rejected') {
      return res.status(400).json({ message: 'You have already rejected this document' });
    }

    // Update signer status and invalidate token
    signer.status = 'rejected';
    signer.rejectReason = rejectReason.trim();
    signer.signingToken = null;
    signer.signingTokenExpires = null;

    // Update overall document status to rejected
    document.status = 'rejected';
    document.rejectReason = rejectReason.trim();

    await document.save();

    // Log audit event for this rejection
    await logAudit({
      fileId: document._id,
      action: 'document_rejected',
      signerEmail: signer.email,
      req,
      metadata: { rejectReason: rejectReason.trim() }
    });

    return res.json({
      message: 'Document rejected successfully',
      document
    });

  } catch (error) {
    console.error('Error rejecting document:', error.message);
    return res.status(500).json({ message: 'Server error processing document rejection' });
  }
});

/**
 * @route   POST /api/docs/public/sign/:token
 * @desc    Submit signature publicly. Compiles final PDF only when all signers complete.
 * @access  Public
 */
router.post('/public/sign/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { signerName } = req.body;

    if (!signerName || !signerName.trim()) {
      return res.status(400).json({ message: 'Please provide your name to sign the document' });
    }

    const document = await Document.findOne({ 'signers.signingToken': token });
    if (!document) {
      return res.status(404).json({ message: 'Invalid or expired signing link' });
    }

    const signer = document.signers.find(s => s.signingToken === token);
    if (!signer) {
      return res.status(404).json({ message: 'Invalid or expired signing link' });
    }

    if (signer.signingTokenExpires && signer.signingTokenExpires < Date.now()) {
      return res.status(400).json({ message: 'Signing link has expired' });
    }

    if (document.status === 'rejected') {
      return res.status(400).json({ message: 'This document has been rejected and cannot be signed' });
    }

    if (signer.status === 'signed') {
      return res.status(400).json({ message: 'You have already signed this document' });
    }

    if (signer.status === 'rejected') {
      return res.status(400).json({ message: 'You have rejected this document' });
    }

    // Save signature info for this signer and invalidate token
    signer.status = 'signed';
    signer.name = signerName.trim();
    signer.signedAt = new Date();
    signer.signingToken = null;
    signer.signingTokenExpires = null;

    // Check if all signers are done
    const allSigned = document.signers.every(s => s.status === 'signed');

    if (allSigned) {
      const signatures = await Signature.find({ documentId: document._id });
      if (signatures.length === 0) {
        return res.status(400).json({ message: 'Please place at least one signature box before finalizing.' });
      }

      const originalPath = path.join(UPLOAD_DIR, document.filePath);
      if (!fs.existsSync(originalPath)) {
        return res.status(404).json({ message: 'Original PDF file not found' });
      }

      // Read original PDF into buffer
      const existingPdfBytes = fs.readFileSync(originalPath);

      // Load PDF using pdf-lib
      const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      // Embed HelveticaBold font
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Embed signatures in PDF using explicit mapping (paired by email)
      for (const signature of signatures) {
        const pageIndex = signature.page - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) {
          continue;
        }

        const page = pages[pageIndex];
        const { width, height } = page.getSize();

        // Translate coordinates
        const x_center = (signature.x / 100) * width;
        const y_center = ((100 - signature.y) / 100) * height;

        // Retrieve signer's name
        const signerInfo = document.signers.find(s => s.email === signature.signerEmail);
        const nameToStamp = signerInfo ? signerInfo.name : 'Signed';
        
        const text = `Signed by: ${nameToStamp}`;
        const fontSize = 10;
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const paddingX = 8;
        const paddingY = 6;
        const boxWidth = textWidth + paddingX * 2;
        const boxHeight = fontSize + paddingY * 2;

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
          y: drawY + paddingY + 1.5,
          size: fontSize,
          font: font,
          color: rgb(0.08, 0.55, 0.49), // Teal-600
        });
      }

      // Save finalized PDF
      const signedPdfBytes = await pdfDoc.save();
      
      const uniqueSuffix = Date.now();
      const ext = path.extname(document.fileName);
      const baseName = path.basename(document.fileName, ext).replace(/\s+/g, '_');
      const signedFileName = `${baseName}-signed-${uniqueSuffix}${ext}`;
      const signedFilePath = path.join(SIGNED_DIR, signedFileName);

      fs.writeFileSync(signedFilePath, signedPdfBytes);

      document.status = 'signed';
      document.signedFilePath = signedFileName;

      // Update all coordinates status to 'signed'
      await Signature.updateMany({ documentId: document._id }, { status: 'signed' });
    }

    await document.save();

    await logAudit({
      fileId: document._id,
      action: 'document_signed',
      signerEmail: signer.email,
      signerName: signerName.trim(),
      req,
      metadata: { finalized: allSigned }
    });

    return res.json({
      message: allSigned ? 'Document signed and finalized successfully' : 'Your signature has been saved successfully. Waiting for other signers.',
      document
    });

  } catch (error) {
    console.error('Error signing PDF publicly:', error.message);
    return res.status(500).json({ message: 'Server error generating signed PDF document' });
  }
});

module.exports = router;
