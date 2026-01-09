const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateID } = require('../utils/idGenerator');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

// Send token and user data
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.UserID);

  res.status(statusCode).json({
    success: true,
    token,
    data: {
      user: {
        UserID: user.UserID,
        Username: user.Username,
        Email: user.Email,
        Name: user.Name,
        CreatedAt: user.CreatedAt
      }
    }
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { Name, Username, Email, password, confirmPassword } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ Email }, { Username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or username'
      });
    }

    // Create new user with proper ID
    const newUser = await User.create({
      UserID: generateID('user'),
      Name,
      Username,
      Email,
      HashedPassword: password
    });

    createSendToken(newUser, 201, res);

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating user account'
    });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // 2) Check if user exists && password is correct
    const user = await User.findOne({ Email: email }).select('+HashedPassword');

    if (!user || !(await user.authenticate(password))) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect email or password'
      });
    }

    // 3) If everything ok, send token to client
    createSendToken(user, 200, res);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login'
    });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findOne({ UserID: req.user.UserID });
    
    res.json({
      success: true,
      data: {
        user: {
          UserID: user.UserID,
          Name: user.Name,
          Username: user.Username,
          Email: user.Email,
          CreatedAt: user.CreatedAt
        }
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data'
    });
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { Name, Email, newPassword } = req.body;
    const updateData = {};

    if (Name) updateData.Name = Name;
    if (Email) updateData.Email = Email;
    if (newPassword) updateData.HashedPassword = newPassword;

    const user = await User.findOneAndUpdate(
      { UserID: req.user.UserID },
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: {
        user: {
          UserID: user.UserID,
          Name: user.Name,
          Username: user.Username,
          Email: user.Email
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

module.exports = router;