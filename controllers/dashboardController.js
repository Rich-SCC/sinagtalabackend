// controllers/dashboardController.js

const moodService = require('../services/moodService');
const analyticsService = require('../services/analyticsService');
const aiService = require('../services/aiService');
const { sendResponse } = require('../utils/responseHelper');
const helpers = require('../utils/helpers');

const dashboardController = {
  // Get dashboard data
  getDashboardData: async (req, res) => {
    try {
      const { userId } = req.params;
      const { timeframe } = req.query;
      
      // Calculate date range based on timeframe
      const endDate = new Date();
      let startDate = new Date();
      
      switch (timeframe) {
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30); // Default to 30 days
      }
      
      // Get calendar data
      const calendarData = await moodService.getDailyMoodSummary(userId, startDate, endDate);
      
      // Get mood trends
      const trendData = await analyticsService.getMoodTrends(userId, startDate, endDate);
      
      // Get user summary
      const userSummary = await analyticsService.getUserSummary(userId);
      
      // Combine all data for the dashboard
      const dashboardData = {
        calendarData: Array.isArray(calendarData) ? calendarData.map(row => ({
          ...row,
          date: helpers.toIsoString(row.date)
        })) : calendarData,
        trendData: trendData && typeof trendData === 'object' ? {
          ...trendData,
          frequencies: Array.isArray(trendData.frequencies) ? trendData.frequencies.map(row => ({
            ...row,
            timestamp: row.timestamp ? helpers.toIsoString(row.timestamp) : row.timestamp,
            date: row.date ? helpers.toIsoString(row.date) : row.date
          })) : trendData.frequencies,
          transitions: Array.isArray(trendData.transitions) ? trendData.transitions.map(row => ({
            ...row,
            timestamp: row.timestamp ? helpers.toIsoString(row.timestamp) : row.timestamp,
            date: row.date ? helpers.toIsoString(row.date) : row.date
          })) : trendData.transitions,
          volatility: trendData.volatility && trendData.volatility.timestamp ? {
            ...trendData.volatility,
            timestamp: helpers.toIsoString(trendData.volatility.timestamp)
          } : trendData.volatility
        } : trendData,
        userSummary: userSummary?.summary_data || {}
      };
      
      sendResponse({
        res,
        data: dashboardData
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to fetch dashboard data'
      });
    }
  },

  // Generate AI Insight for the user
  getAIInsight: async (req, res) => {
    try {
      const { userId } = req.params;
      // Use the new business logic for summarizing and giving advice
      const result = await aiService.getInsightSummary(userId);
      sendResponse({
        res,
        data: result
      });
    } catch (error) {
      console.error('Error generating AI insight:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to generate AI insight'
      });
    }
  }
};

module.exports = dashboardController;