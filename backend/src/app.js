const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');

const app = express();

// Global Middleware
// CORS allows our React frontend (running on a different port) to fetch data from this server
app.use(cors());

// express.json() reads JSON data from incoming requests so we can access it using `req.body`
app.use(express.json());

// Mount authentication routes under the namespace /api/auth
app.use('/api/auth', authRoutes);

// Basic health check route to verify the server is running properly
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    message: 'Backend server is running and healthy!',
    timestamp: new Date()
  });
});

module.exports = app;
