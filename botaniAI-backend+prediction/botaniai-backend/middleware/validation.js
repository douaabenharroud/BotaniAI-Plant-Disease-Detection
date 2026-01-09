const { generateID } = require('../utils/idGenerator');

exports.validateRegistration = (req, res, next) => {
  const { Name, Username, Email, password, confirmPassword } = req.body;

  console.log('Registration body:', req.body); // Add this for debugging

  // Check required fields
  if (!Name || !Username || !Email || !password || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required',
      received: { Name, Username, Email, password: password ? '***' : undefined, confirmPassword: confirmPassword ? '***' : undefined }
    });
  }

  // Check password length
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters'
    });
  }

  // Check if passwords match
  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match'
    });
  }

  // Basic email validation
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(Email)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid email address'
    });
  }

  next();
};

exports.validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password'
    });
  }

  next();
};