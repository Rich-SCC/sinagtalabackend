// controllers/chatController.js

const aiService = require('../services/aiService');
const { pool } = require('../db');
const { sendResponse } = require('../utils/responseHelper');
const helpers = require('../utils/helpers');

const chatController = {
  // Get chat history
  getChatLogs: async (req, res) => {
    try {
      const { userId } = req.params;
      const { date } = req.query;
      
      let query = `
        SELECT 
          id,
          user_id as "userId",
          message as content,
          sender as "from",
          timestamp
        FROM chatlogs
        WHERE user_id = $1
      `;
      
      const queryParams = [userId];
      
      if (date) {
        query += ` AND DATE(timestamp) = $2`;
        queryParams.push(date);
      }
      
      query += ` ORDER BY timestamp DESC LIMIT 50`;
      
      const result = await pool.query(query, queryParams);
      sendResponse({
        res,
        data: result.rows.map(row => ({
          ...row,
          timestamp: helpers.toIsoString(row.timestamp)
        }))
      });
    } catch (error) {
      console.error('Error fetching chat logs:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to fetch chat history'
      });
    }
  },
  
  // Send message to AI and get response and save the user message to the db
  sendMessage: async (req, res) => {
    try {
      const { userId, message, currentMood } = req.body;
      
      // Create context object for the AI
      const context = {
        currentMood: currentMood || null
      };
      
      // Check if streaming is requested
      const streamResponse = req.query.stream === 'true';
      
      if (streamResponse) {
        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        let fullResponse = '';
        try {
          // Save user message to DB immediately (no mood column)
          const userMessageQuery = `
            INSERT INTO chatlogs (user_id, message, sender, timestamp)
            VALUES ($1, $2, 'user', NOW())
            RETURNING id, user_id as "userId", message as content, sender as "from", timestamp
          `;
          const userMessageResult = await pool.query(userMessageQuery, [userId, message]);
          const savedUserMessage = userMessageResult.rows[0];

          if (savedUserMessage && savedUserMessage.timestamp) {
            savedUserMessage.timestamp = helpers.toIsoString(savedUserMessage.timestamp);
          }

          // Save mood to moodentries with note as the user's message
          if (currentMood) {
            const moodQuery = `
              INSERT INTO moodentries (user_id, mood, timestamp, message)
              VALUES ($1, $2, NOW(), $3)
            `;
            await pool.query(moodQuery, [userId, currentMood, message]);
          }

          // Start the streaming process with a callback for chunks
          await aiService.generateChatResponse(userId, message, context, (chunk) => {
            fullResponse += chunk;
            // Only send valid JSON lines
            if (chunk && typeof chunk === 'string') {
              try {
                res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
              } catch (e) {
                // skip invalid chunk
              }
            }
          });

          // Save the AI reply to the database
          const aiMessageQuery = `
            INSERT INTO chatlogs (user_id, message, sender, timestamp)
            VALUES ($1, $2, 'tala', NOW())
            RETURNING id, user_id as "userId", message as content, sender as "from", timestamp
          `;
          const aiMessageResult = await pool.query(aiMessageQuery, [userId, fullResponse]);
          const savedAIMessage = aiMessageResult.rows[0];

          if (savedAIMessage && savedAIMessage.timestamp) {
            savedAIMessage.timestamp = helpers.toIsoString(savedAIMessage.timestamp);
          }

          // Send the final done chunk with the saved AI message
          res.write(`data: ${JSON.stringify({ done: true, aiMessage: savedAIMessage })}\n\n`);
          res.end();
        } catch (error) {
          console.error('Error during streaming:', error);
          res.write(`data: ${JSON.stringify({ error: 'An error occurred during response generation' })}\n\n`);
          res.end();
        }
      } else {
        // Regular non-streaming response
        const response = await aiService.generateChatResponse(userId, message, context);
        
        // If mood was provided, store it in the database
        if (currentMood) {
          try {
            const { pool } = require('../db');
            const moodQuery = `
              INSERT INTO moodentries (user_id, mood, timestamp)
              VALUES ($1, $2, NOW())
            `;
            
            await pool.query(moodQuery, [userId, currentMood]);
          } catch (moodError) {
            console.error('Error storing mood:', moodError);
            // Continue with the response even if mood storage fails
          }
        }

        sendResponse({
          res,
          data: { response }
        });
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to generate AI response',
        data: { details: error.message }
      });
    }
  },

  // Get day summary
  getDaySummary: async (req, res) => {
    try {
      const { userId, date } = req.params;
      const summary = await aiService.generateDaySummary(userId, date);
      
      if (!summary) {
        return sendResponse({
          res,
          statusCode: 404,
          error: 'No data found for this day'
        });
      }

      // Upsert the summary into day_summaries
      const upsertQuery = `
        INSERT INTO day_summaries (user_id, date, summary)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, date)
        DO UPDATE SET summary = EXCLUDED.summary, created_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const upsertResult = await pool.query(upsertQuery, [userId, date, summary.summary || summary]);
      const savedSummary = upsertResult.rows[0];

      sendResponse({
        res,
        data: savedSummary
      });
    } catch (error) {
      console.error('Error fetching day summary:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to generate day summary'
      });
    }
  },

  // Check AI service status
  checkAIStatus: async (req, res) => {
    try {
      const status = await aiService.checkAIStatus();
      
      if (status.status === 'online') {
        sendResponse({
          res,
          data: status
        });
      } else {
        sendResponse({
          res,
          statusCode: 503,
          error: status.message,
          data: status.details
        });
      }
    } catch (error) {
      console.error('Error checking AI status:', error);
      sendResponse({
        res,
        statusCode: 500,
        error: 'Failed to check AI service status',
        data: { details: error.message }
      });
    }
  }
};

module.exports = chatController;