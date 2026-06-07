const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect middleware blocks unauthorized users from calling protected API routes.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Read Bearer token from the Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Header format is: "Bearer <token>"
      // Split the string by space to separate "Bearer" from the actual token string
      token = req.headers.authorization.split(' ')[1];

      // 2. Verify token signature using our secret key from environment configurations
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Find user matching the token ID and attach to request object
      // We exclude the password from the retrieved user object for safety
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Authorization failed: User no longer exists' });
      }

      // Proceed to the next middleware function or route controller
      return next();
    } catch (error) {
      console.error('Token validation failed:', error.message);
      return res.status(401).json({ message: 'Authorization failed: Invalid or expired token' });
    }
  }

  // 4. Return error if no token is found in the headers
  if (!token) {
    return res.status(401).json({ message: 'Authorization failed: No secure access token provided' });
  }
};

module.exports = { protect };
