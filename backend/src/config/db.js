const mongoose = require('mongoose');

/**
 * Connects the Express application to MongoDB using the connection string from environmental variables.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // If the database fails to connect, we shut down the application (exit code 1)
    process.exit(1);
  }
};

module.exports = connectDB;
