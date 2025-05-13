// services/moodService.js

const { pool } = require('../db');
const helpers = require('../utils/helpers');

const moodService = {
  // Save a new mood entry
  saveMoodEntry: async (userId, mood, message = null) => {
    try {
      const query = `
        INSERT INTO moodentries (user_id, mood, message, timestamp)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;
      const result = await pool.query(query, [userId, mood, message]);
      return {
        ...result.rows[0],
        timestamp: helpers.toIsoString(result.rows[0]?.timestamp)
      };
    } catch (error) {
      throw new Error(helpers.extractDbErrorMessage(error));
    }
  },
  
  // Get all mood entries for a user within a date range
  getMoodEntries: async (userId, startDate, endDate) => {
    try {
      const query = `
        SELECT * FROM moodentries
        WHERE user_id = $1
        AND timestamp BETWEEN $2 AND $3
        ORDER BY timestamp DESC
      `;
      const result = await pool.query(query, [
        userId,
        startDate,
        endDate
      ]);
      return result.rows.map(row => ({
        ...row,
        timestamp: helpers.toIsoString(row.timestamp)
      }));
    } catch (error) {
      throw new Error(helpers.extractDbErrorMessage(error));
    }
  },
  
  // Get daily mood summary (first and last moods of each day)
  getDailyMoodSummary: async (userId, startDate, endDate) => {
    try {
      const query = `
        WITH daily_moods AS (
          SELECT 
            DATE(timestamp) as date,
            mood,
            timestamp,
            ROW_NUMBER() OVER (PARTITION BY DATE(timestamp) ORDER BY timestamp ASC) as first_rank,
            ROW_NUMBER() OVER (PARTITION BY DATE(timestamp) ORDER BY timestamp DESC) as last_rank
          FROM moodentries
          WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
        )
        SELECT 
          date,
          (SELECT mood FROM daily_moods dm WHERE dm.date = d.date AND first_rank = 1) as initial_mood,
          (SELECT mood FROM daily_moods dm WHERE dm.date = d.date AND last_rank = 1) as final_mood,
          (SELECT COUNT(*) FROM moodentries 
           WHERE user_id = $1 
           AND DATE(timestamp) = d.date) as total_entries
        FROM (
          SELECT DISTINCT date FROM daily_moods
        ) d
        ORDER BY date DESC
      `;
      
      const result = await pool.query(query, [
        userId,
        startDate,
        endDate
      ]);
      return result.rows.map(row => ({
        ...row,
        timestamp: helpers.toIsoString(row.timestamp)
      }));
    } catch (error) {
      throw new Error(helpers.extractDbErrorMessage(error));
    }
  },
  
  // Get all moods for a specific day
  getDayMoods: async (userId, date) => {
    try {
      const query = `
        SELECT 
          mood, 
          timestamp, 
          message
        FROM moodentries
        WHERE user_id = $1 
        AND DATE(timestamp) = $2
        ORDER BY timestamp
      `;
      
      const result = await pool.query(query, [userId, date]);
      return result.rows.map(row => ({
        ...row,
        timestamp: helpers.toIsoString(row.timestamp)
      }));
    } catch (error) {
      throw new Error(helpers.extractDbErrorMessage(error));
    }
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
      frequencies: frequencies.rows.map(row => ({
        ...row,
        timestamp: helpers.toIsoString(row.timestamp)
      })),
      transitions: transitions.rows.map(row => ({
        ...row,
        timestamp: helpers.toIsoString(row.timestamp)
      })),
      volatility: {
        ...volatility.rows[0],
        timestamp: helpers.toIsoString(volatility.rows[0]?.timestamp)
      }
    };
  },

  // Get the oldest mood entry for a user
  getOldestMoodEntry: async (userId) => {
    try {
      const query = `SELECT * FROM moodentries WHERE user_id = $1 ORDER BY timestamp ASC LIMIT 1`;
      const result = await pool.query(query, [userId]);
      if (result.rows.length === 0) return null;
      return {
        ...result.rows[0],
        timestamp: helpers.toIsoString(result.rows[0].timestamp)
      };
    } catch (error) {
      throw new Error(helpers.extractDbErrorMessage(error));
    }
  }
};

module.exports = moodService;