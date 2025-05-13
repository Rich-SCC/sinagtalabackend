// routes/moodRoutes.js

const express = require('express');
const router = express.Router();
const moodController = require('../controllers/moodController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Save mood entry
router.post('/', moodController.saveMood);

// Get mood entry
router.get('/:userId', moodController.getMoodEntries)

// Get mood calendar data
router.get('/calendar/:userId', moodController.getMoodCalendar);

// Get mood details for a specific day
router.get('/day/:userId/:date', moodController.getDayMoods);

// Get mood trends
router.get('/trends/:userId', moodController.getMoodTrends);

module.exports = router;