// routes/profileRoutes.js

const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticateToken, verifyUser } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);
router.use(verifyUser);

// Get user profile
router.get('/', profileController.getProfile);

// Update user profile
router.put('/', profileController.updateProfile);

// Change password
router.put('/password', profileController.changePassword);

// Delete account
router.delete('/', profileController.deleteAccount);

module.exports = router;
