const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the shape of our User records in the database
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true, // Prevents duplicate email signups
    lowercase: true, // Stores email in lowercase
    trim: true, // Removes spaces from the start/end
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters long'],
  },
}, {
  // Automatically adds 'createdAt' and 'updatedAt' timestamps to our user records
  timestamps: true
});

// PRE-SAVE HOOK: Automatically hashes password before saving to the database
// We use a regular function (not an arrow function) so we can access `this` representing the user
UserSchema.pre('save', async function (next) {
  // Only hash the password if it is new or has been modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate a secure salt (random key) to mix with the password
    const salt = await bcrypt.genSalt(10);
    // Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// METHOD: Compares an entered password with the hashed password in the database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
