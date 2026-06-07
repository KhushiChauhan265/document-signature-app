const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const docRoutes = require('./routes/docs');
const signatureRoutes = require('./routes/signatures');

const app = express();

// Global Middleware
// CORS allows our React frontend (running on a different port) to fetch data from this server
app.use(cors());

// express.json() reads JSON data from incoming requests so we can access it using `req.body`
app.use(express.json());

// Serve the uploads folder as static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/signatures', signatureRoutes);

// Basic health check route to verify the server is running properly
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    message: 'Backend server is running and healthy!',
    timestamp: new Date()
  });
});

module.exports = app;
