// routes/chatRoutes.js

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Check AI service status
router.get('/status', chatController.checkAIStatus);

// Get chat history
router.get('/logs/:userId', chatController.getChatLogs);

// Send message to AI and get response
router.post('/message', chatController.sendMessage);

// Get day summary
router.get('/summary/:userId/:date', chatController.getDaySummary);

module.exports = router;