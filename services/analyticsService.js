const { pool } = require('../db');
const aiService = require('./aiService');
const authService = require('./authService');
const moodService = require('./moodService');
let chatService;
try {
  chatService = require('./chatService');
} catch (e) {
  chatService = null;
}

const analyticsService = {
  // Generate or retrieve day summary
  getDaySummary: async (userId, date) => {
    // Check if summary exists for this day
    const checkQuery = `
      SELECT * FROM day_summaries
      WHERE user_id = $1 AND date = $2
    `;
    
    const existingSummary = await pool.query(checkQuery, [userId, date]);
    
    if (existingSummary.rows.length > 0) {
      return existingSummary.rows[0];
    }
    
    // If not exists, generate a new summary
    // Get all mood entries for the day
    const moodQuery = `
      SELECT mood, timestamp, message
      FROM moodentries
      WHERE user_id = $1 AND DATE(timestamp) = $2
      ORDER BY timestamp
    `;
    
    // Get chat logs for the day
    const chatQuery = `
      SELECT message, sender, timestamp
      FROM chatlogs
      WHERE user_id = $1 AND DATE(timestamp) = $2
      ORDER BY timestamp
    `;
    
    const moodEntries = await pool.query(moodQuery, [userId, date]);
    const chatLogs = await pool.query(chatQuery, [userId, date]);
    
    // If no data for this day, return null
    if (moodEntries.rows.length === 0 && chatLogs.rows.length === 0) {
      return null;
    }
    
    // Prepare data for AI summary generation
    const dayData = {
      moods: moodEntries.rows,
      messages: chatLogs.rows
    };
    
    // Generate summary using AI service
    const summary = await aiService.generateDaySummary(dayData);
    
    // Save the summary
    const insertQuery = `
      INSERT INTO day_summaries (user_id, date, summary, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    
    const result = await pool.query(insertQuery, [userId, date, summary]);
    return result.rows[0];
  },

  // Generate or update a user summary based on mood entries and chat logs
  updateUserSummary: async (userId) => {
    // First, check if a summary exists
    const checkQuery = `
      SELECT * FROM user_summaries 
      WHERE user_id = $1
    `;
    
    const summaryResult = await pool.query(checkQuery, [userId]);
    
    // Get mood distribution data
    const moodDistributionQuery = `
      SELECT 
        mood, 
        COUNT(*) as count,
        COUNT(*) * 100.0 / (
          SELECT COUNT(*) FROM moodentries 
          WHERE user_id = $1 AND mood != 'Uncertain'
        ) as percentage
      FROM moodentries
      WHERE user_id = $1 AND mood != 'Uncertain'
      GROUP BY mood
      ORDER BY count DESC
    `;
    
    const moodDistribution = await pool.query(moodDistributionQuery, [userId]);
    
    // Get most common time periods for mood entries
    const timePeriodsQuery = `
      SELECT 
        CASE
          WHEN EXTRACT(HOUR FROM timestamp) BETWEEN 5 AND 11 THEN 'morning'
          WHEN EXTRACT(HOUR FROM timestamp) BETWEEN 12 AND 17 THEN 'afternoon'
          WHEN EXTRACT(HOUR FROM timestamp) BETWEEN 18 AND 21 THEN 'evening'
          ELSE 'night'
        END as time_period,
        COUNT(*) as count
      FROM moodentries
      WHERE user_id = $1
      GROUP BY time_period
      ORDER BY count DESC
    `;
    
    const timePeriods = await pool.query(timePeriodsQuery, [userId]);
    
    // Prepare the summary data
    const summaryData = {
      mood_distribution: moodDistribution.rows,
      active_time_periods: timePeriods.rows,
      last_updated: new Date()
    };
    
    // Insert or update the summary
    if (summaryResult.rows.length === 0) {
      // Create new summary
      const insertQuery = `
        INSERT INTO user_summaries (user_id, summary_data, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        RETURNING *
      `;
      await pool.query(insertQuery, [userId, JSON.stringify(summaryData)]);
    } else {
      // Update existing summary
      const updateQuery = `
        UPDATE user_summaries
        SET summary_data = $2, updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `;
      await pool.query(updateQuery, [userId, JSON.stringify(summaryData)]);
    }
    
    return summaryData;
  },

  // Get the latest user summary
  getUserSummary: async (userId) => {
    const query = `
      SELECT * FROM user_summaries
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  },

  // Calculate mood trends (frequencies, transitions, volatility)
  getMoodTrends: async (userId, startDate, endDate) => {
    // Get mood frequencies
    const frequencyQuery = `
      SELECT 
        mood, 
        COUNT(*) as count
      FROM moodentries
      WHERE user_id = $1 
      AND timestamp BETWEEN $2 AND $3
      AND mood != 'Uncertain'
      GROUP BY mood
      ORDER BY count DESC
    `;
    
    // Get mood transitions (how moods change)
    const transitionQuery = `
      WITH ordered_moods AS (
        SELECT 
          mood,
          timestamp,
          LAG(mood) OVER (ORDER BY timestamp) as prev_mood
        FROM moodentries
        WHERE user_id = $1 
        AND timestamp BETWEEN $2 AND $3
        AND mood != 'Uncertain'
      )
      SELECT 
        prev_mood,
        mood as next_mood,
        COUNT(*) as transition_count
      FROM ordered_moods
      WHERE prev_mood IS NOT NULL
      GROUP BY prev_mood, next_mood
      ORDER BY transition_count DESC
      LIMIT 10
    `;
    
    // Calculate volatility (frequency of mood changes)
    const volatilityQuery = `
      WITH mood_changes AS (
        SELECT 
          DATE(timestamp) as date,
          COUNT(DISTINCT mood) as different_moods,
          COUNT(*) as total_entries
        FROM moodentries
        WHERE user_id = $1 
        AND timestamp BETWEEN $2 AND $3
        AND mood != 'Uncertain'
        GROUP BY DATE(timestamp)
      )
      SELECT 
        AVG(different_moods) as avg_daily_mood_variety,
        AVG(total_entries) as avg_daily_entries,
        AVG(different_moods) / AVG(total_entries) as volatility_index
      FROM mood_changes
    `;
    
    const frequencies = await pool.query(frequencyQuery, [userId, startDate, endDate]);
    const transitions = await pool.query(transitionQuery, [userId, startDate, endDate]);
    const volatility = await pool.query(volatilityQuery, [userId, startDate, endDate]);
    
    return {
      frequencies: frequencies.rows,
      transitions: transitions.rows,
      volatility: volatility.rows[0] || { volatility_index: 0 }
    };
  },

  // Get the earliest available date for a user's data (user creation, oldest mood, or chat entry)
  getEarliestUserDataDate: async (userId) => {
    const user = await authService.getUserById(userId);
    const userCreatedAt = user?.created_at;
    let moodDate = null;
    let chatDate = null;
    try {
      const oldestMood = await moodService.getOldestMoodEntry(userId);
      moodDate = oldestMood ? oldestMood.timestamp : null;
    } catch {}
    if (chatService && chatService.getOldestChatEntry) {
      try {
        const oldestChat = await chatService.getOldestChatEntry(userId);
        chatDate = oldestChat ? oldestChat.timestamp : null;
      } catch {}
    }
    return require('../utils/helpers').getEarliestDate([
      userCreatedAt,
      moodDate,
      chatDate
    ]);
  }
};

module.exports = analyticsService; 