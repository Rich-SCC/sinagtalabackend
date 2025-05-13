// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Signup
router.post('/signup', authController.signup);

// Login
router.post('/login', authController.login);

// Refresh token
router.post('/refresh-token', authController.refreshToken);

// Request password reset
router.post('/request-reset', authController.requestPasswordReset);

// Verify reset token
router.get('/verify-reset/:token', authController.verifyResetToken);

// Reset password
router.post('/reset-password', authController.resetPassword);

// Logout (requires authentication)
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
