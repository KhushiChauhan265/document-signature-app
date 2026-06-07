// Load environment variables from the .env file
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Database
connectDB();

// Start listening for network requests
app.listen(PORT, () => {
  console.log(`Backend server is successfully running on http://localhost:${PORT}`);
});
