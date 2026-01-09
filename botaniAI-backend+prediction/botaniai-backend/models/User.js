const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  UserID: {
    type: String,
    required: [true, 'UserID is required'],
    unique: true,
    trim: true
  },
  Email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  Name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  Username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  HashedPassword: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  CreatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('HashedPassword')) return next();
  this.HashedPassword = await bcrypt.hash(this.HashedPassword, 12);
  next();
});

// Compare password method
userSchema.methods.authenticate = async function(password) {
  return await bcrypt.compare(password, this.HashedPassword);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.HashedPassword;
  return user;
};

module.exports = mongoose.model('User', userSchema);