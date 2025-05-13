// controllers/moodController.js

const moodService = require('../services/moodService');
const analyticsService = require('../services/analyticsService');
const { sendResponse } = require('../utils/responseHelper');
const helpers = require('../utils/helpers');

const moodController = {
  // Save a mood entry
  saveMood: async (req, res) => {
    try {
      const { userId, mood, message } = req.body;
      
      // Validate mood against allowed values
      const validMoods = [
        'Despairing', 'Irritated', 'Anxious', 'Drained', 
        'Restless', 'Indifferent', 'Calm', 'Hopeful', 
        'Content', 'Energized', 'Uncertain'
      ];
      
      if (!validMoods.includes(mood)) {
        return sendResponse({
          res,
          statusCode: 400,
          error: 'Invalid mood value'
        });
      }
      
      const result = await moodService.saveMoodEntry(userId, mood, message);
      
      // Update user summary after saving mood
      await analyticsService.updateUserSummary(userId);
      
      sendResponse({
        res,
        statusCode: 201,
        data: {
          ...result,
          timestamp: helpers.toIsoString(result.timestamp)
        }
      });
    } catch (error) {
      console.error('Error saving mood:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to save mood entry'
      });
    }
  },
  
  // Get mood calendar data
  getMoodCalendar: async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      
      // Default to last 30 days if no dates provided
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end);
      start.setDate(start.getDate() - 30);
      
      const result = await moodService.getDailyMoodSummary(userId, start, end);
      sendResponse({
        res,
        data: result.map(row => ({
          ...row,
          date: helpers.toIsoString(row.date)
        }))
      });
    } catch (error) {
      console.error('Error fetching mood calendar:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to fetch mood calendar data'
      });
    }
  },
  
  // Get mood details for a specific day
  getDayMoods: async (req, res) => {
    try {
      const { userId, date } = req.params;
      const result = await moodService.getDayMoods(userId, date);
      sendResponse({
        res,
        data: result.map(row => ({
          ...row,
          timestamp: helpers.toIsoString(row.timestamp)
        }))
      });
    } catch (error) {
      console.error('Error fetching day moods:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to fetch mood data for the specified day'
      });
    }
  },
  
  // Get mood trends
  getMoodTrends: async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      
      // Default to last 30 days if no dates provided
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end);
      start.setDate(start.getDate() - 30);
      
      const result = await analyticsService.getMoodTrends(userId, start, end);
      // If result contains arrays with timestamps, convert them
      const convertTimestamps = arr => arr.map(row => ({
        ...row,
        timestamp: row.timestamp ? helpers.toIsoString(row.timestamp) : row.timestamp,
        date: row.date ? helpers.toIsoString(row.date) : row.date
      }));
      sendResponse({
        res,
        data: {
          ...result,
          frequencies: result.frequencies ? convertTimestamps(result.frequencies) : result.frequencies,
          transitions: result.transitions ? convertTimestamps(result.transitions) : result.transitions,
          volatility: result.volatility ? convertTimestamps([result.volatility])[0] : result.volatility
        }
      });
    } catch (error) {
      console.error('Error fetching mood trends:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to fetch mood trends'
      });
    }
  },

  // Get mood entries
  getMoodEntries: async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      // Default to last 30 days if no dates provided
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end);
      start.setDate(start.getDate() - 30);
      const result = await moodService.getMoodEntries(userId, start, end);
      sendResponse({
        res,
        data: result.map(row => ({
          ...row,
        }))
      });
    } catch (error) {
      console.error('Error fetching mood entries:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to fetch mood entries'
      });
    }
  }
};

module.exports = moodController;