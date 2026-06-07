const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper: Signs a JSON Web Token containing the User ID.
 * Token expires in 30 days.
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

/**
 * @route   POST /api/auth/register
 * @desc    Registers a new user and returns user info + JWT token
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Basic Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // 2. Check if user already exists in database
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'A user with this email address already exists' });
    }

    // 3. Create user (password will be automatically hashed by pre-save hook in User model)
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      // 4. Return user data and signed token
      return res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      return res.status(400).json({ message: 'Invalid user registration data provided' });
    }
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({ message: 'Server error during user registration' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticates credentials and returns user info + JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Basic Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // 2. Find user in database
    const user = await User.findOne({ email });

    // 3. Compare passwords using our matchPassword model method
    if (user && (await user.matchPassword(password))) {
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Server error during user login' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user details (Protected Route)
 */
router.get('/me', protect, async (req, res) => {
  try {
    // req.user was set by our protect middleware
    return res.json(req.user);
  } catch (error) {
    console.error('Profile fetch error:', error.message);
    return res.status(500).json({ message: 'Server error fetching user profile' });
  }
});

module.exports = router;
