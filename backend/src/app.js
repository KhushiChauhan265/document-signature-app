const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const docRoutes = require('./routes/docs');
const signatureRoutes = require('./routes/signatures');
const auditRoutes = require('./routes/audit');

const app = express();
//completed project
// Global Middleware
// CORS allows our React frontend (running on a different port) to fetch data from this server
app.use(cors());

// express.json() reads JSON data from incoming requests so we can access it using `req.body`
app.use(express.json());

// Serve the uploads folder via Supabase Storage with local static fallback
const supabase = require('./config/supabase');
app.get('/uploads/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    if (supabase) {
      const { data, error } = await supabase.storage.from('documents').download('uploads/' + filename);
      if (!error && data) {
        const buffer = Buffer.from(await data.arrayBuffer());
        res.setHeader('Content-Type', 'application/pdf');
        return res.send(buffer);
      }
    }
    const localPath = path.join(__dirname, '../uploads', filename);
    if (require('fs').existsSync(localPath)) {
      return res.sendFile(localPath);
    }
    return res.status(404).json({ message: 'File not found' });
  } catch (err) {
    console.error('Error serving upload:', err.message);
    return res.status(500).json({ message: 'Error serving file' });
  }
});

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/audit', auditRoutes);

// Basic health check route to verify the server is running properly
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    message: 'Backend server is running and healthy!',
    timestamp: new Date()
  });
});

module.exports = app;
