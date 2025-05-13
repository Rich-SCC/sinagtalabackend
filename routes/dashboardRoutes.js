// routes/dashboardRoutes.js

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get dashboard data
router.get('/:userId', dashboardController.getDashboardData);

// Get AI insight for the user
router.get('/:userId/ai-insight', dashboardController.getAIInsight);

module.exports = router;