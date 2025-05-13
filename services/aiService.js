// services/aiService.js

const axios = require('axios');
const dotenv = require('dotenv');
const helpers = require('../utils/helpers');

dotenv.config();

// Ollama API endpoint (adjust based on your setup)
const OLLAMA_URL = process.env.OLLAMA_URL;

const aiService = {
  // Check AI service status
  checkAIStatus: async () => {
    try {
      // Try to make a simple request to the Ollama API
      const response = await axios.get(`${OLLAMA_URL}/tags`);
      
      // Check if the response is successful
      if (response.status === 200) {
        return {
          status: 'online',
          message: 'AI service is available',
          details: {
            models: response.data.models || [],
            version: response.data.version || 'unknown'
          }
        };
      }
      
      return {
        status: 'error',
        message: 'AI service returned unexpected response',
        details: {
          statusCode: response.status
        }
      };
    } catch (error) {
      return {
        status: 'offline',
        message: 'AI service is not available',
        details: {
          error: error.message
        }
      };
    }
  },

  // Generate chat response
  generateChatResponse: async (userId, message, context, onChunk) => {
    try {
      // Get user summary for context
      const { pool } = require('../db');
      const userSummaryQuery = `
        SELECT summary_data FROM user_summaries
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `;
      
      const userSummaryResult = await pool.query(userSummaryQuery, [userId]);
      const userSummary = userSummaryResult.rows[0]?.summary_data || {};
      
      // Get recent moods
      const recentMoodsQuery = `
        SELECT mood, timestamp FROM moodentries
        WHERE user_id = $1
        ORDER BY timestamp DESC
        LIMIT 5
      `;
      
      const recentMoodsResult = await pool.query(recentMoodsQuery, [userId]);
      const recentMoods = recentMoodsResult.rows.map(row => ({
        ...row,
        timestamp: helpers.toIsoString(row.timestamp)
      }));
      
      // Get today's chat logs
      const today = new Date().toISOString().split('T')[0];
      const chatLogsQuery = `
        SELECT message, sender, timestamp FROM chatlogs
        WHERE user_id = $1 AND DATE(timestamp) = $2
        ORDER BY timestamp
      `;
      
      const chatLogsResult = await pool.query(chatLogsQuery, [userId, today]);
      const chatLogs = chatLogsResult.rows.map(row => ({
        ...row,
        timestamp: helpers.toIsoString(row.timestamp)
      }));

      const currentMoodContext = context && context.currentMood ? `The user's current reported mood is: ${context.currentMood}` : '';
      
      // Prepare system message with Tala's context
      const systemMessage = `
        About Tala:
        Tala is a compassionate, non-judgmental mental wellness support chatbot in the SinagTala app. She listens with care, reflects thoughtfully, and offers gentle insights based on users' emotional patterns — not medical diagnoses or clinical advice.
        
        Tala is designed solely to support emotional well-being. She does not provide information or opinions on politics, current events, news updates, or other unrelated or sensitive topics. If such topics arise, Tala will kindly guide the conversation back to feelings, self-care, or reflections — areas where she can truly help.
        
        Tala's purpose is to encourage, comfort, and help users process their thoughts with empathy and emotional clarity. However, she is not equipped to respond to crises. If a user is in distress or facing a mental health emergency, Tala will gently suggest visiting the app's Crisis Hotlines page and Mental Health Resources page for immediate and professional support.
        
        User Context:
        ${JSON.stringify({
          recentMoods: recentMoods,
          userSummary: userSummary,
          todaysChatHistory: chatLogs
        })}
      `;
      
      // Make streaming request to Ollama API using phi4-mini model
      const response = await axios.post(`${OLLAMA_URL}/generate`, {
        model: 'phi4-mini:latest',
        prompt: message,
        system: systemMessage,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.9
        }
      }, {
        responseType: 'stream'
      });
      
      let completeResponse = '';
      
      // Process the stream
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
              try {
                const parsedChunk = JSON.parse(line);
                if (parsedChunk.response) {
                  completeResponse += parsedChunk.response;
                  // Call the callback function with the new chunk
                  if (onChunk && typeof onChunk === 'function') {
                    onChunk(parsedChunk.response);
                  }
                }
                // If this is the last chunk
                if (parsedChunk.done) {
                  resolve(completeResponse);
                }
              } catch (e) {
                // Not valid JSON, skip this line
                continue;
              }
            }
          } catch (error) {
            console.error('Error processing stream chunk:', error);
            // Continue processing despite errors in individual chunks
          }
        });
        // Ensure the promise resolves if the stream ends without a { done: true } chunk
        response.data.on('end', () => {
          resolve(completeResponse);
        });
        response.data.on('close', () => {
          resolve(completeResponse);
        });
        response.data.on('finish', () => {
          resolve(completeResponse);
        });
        response.data.on('error', (error) => {
          console.error('Stream error:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }
  ,
  
  // Generate day summary
  generateDaySummary: async (dayData) => {
    try {
      const systemMessage = `
        You are Tala, a compassionate mental wellness support assistant.
        Your task is to create a brief, empathetic summary of the user's day based on their mood entries and chat logs.
        Focus on emotional patterns, potential triggers, and positive moments.
        Keep your summary supportive, non-judgmental, and focused on the user's well-being.
        Do not include any recommendations that could be interpreted as medical advice.
        
        Day Data:
        ${JSON.stringify(dayData)}
      `;
      
      const prompt = "Please generate a thoughtful summary of the user's day based on their mood entries and conversations.";
      
      const response = await axios.post(`${OLLAMA_URL}/generate`, {
        model: 'phi4-mini:latest',
        prompt: prompt,
        system: systemMessage,
        stream: false,
        options: {
          temperature: 0.7
        }
      });
      
      return response.data.response;
    } catch (error) {
      console.error('Error generating day summary:', error);
      return "Unable to generate a summary for this day.";
    }
  },
  
  // Function to handle function calling with phi4-mini
  executeFunction: async (userId, functionName, parameters) => {
    try {
      // Define available functions
      const functions = {
        getMoodTrend: async (params) => {
          const { pool } = require('../db');
          const { timeframe } = params;
          
          let startDate = new Date();
          
          // Calculate start date based on timeframe
          if (timeframe === 'week') {
            startDate.setDate(startDate.getDate() - 7);
          } else if (timeframe === 'month') {
            startDate.setMonth(startDate.getMonth() - 1);
          } else if (timeframe === 'year') {
            startDate.setFullYear(startDate.getFullYear() - 1);
          }
          
          const query = `
            SELECT DATE(timestamp) as date, mood, COUNT(*) as count
            FROM moodentries
            WHERE user_id = $1 AND timestamp >= $2
            GROUP BY DATE(timestamp), mood
            ORDER BY date
          `;
          
          const result = await pool.query(query, [userId, startDate]);
          return result.rows;
        },
        
        getFrequentMoods: async (params) => {
          const { pool } = require('../index');
          const { limit } = params;
          
          const query = `
            SELECT mood, COUNT(*) as count
            FROM moodentries
            WHERE user_id = $1 AND mood != 'Uncertain'
            GROUP BY mood
            ORDER BY count DESC
            LIMIT $2
          `;
          
          const result = await pool.query(query, [userId, limit || 3]);
          return result.rows;
        }
      };
      
      // Check if function exists
      if (!functions[functionName]) {
        throw new Error(`Function ${functionName} not found`);
      }
      
      // Execute the function
      return await functions[functionName](parameters);
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);
      throw new Error(`Failed to execute function ${functionName}`);
    }
  },

  // Generate mood insight summary and advice for dashboard
  getInsightSummary: async (userId) => {
    try {
      const { pool } = require('../db');
      // Fetch recent mood entries (last 30 days)
      const recentMoodsQuery = `
        SELECT mood, timestamp FROM moodentries
        WHERE user_id = $1
        AND timestamp >= NOW() - INTERVAL '30 days'
        ORDER BY timestamp DESC
      `;
      const recentMoodsResult = await pool.query(recentMoodsQuery, [userId]);
      const recentMoods = recentMoodsResult.rows.map(row => ({
        ...row,
        timestamp: helpers.toIsoString(row.timestamp)
      }));

      // Prepare the system prompt for the AI
      const systemMessage = `
        You are Tala, a compassionate mental wellness support assistant.
        Your task is to analyze the user's mood entries for the past 30 days and provide:
        1. A brief summary of their overall mood pattern.
        2. An empathetic insight about their emotional trends.
        3. Gentle, supportive advice for their well-being.
        Please return your response as a JSON object with keys: summary, insight, advice.
        Here are the user's recent mood entries:
        ${JSON.stringify(recentMoods)}
      `;

      // Call the AI model (Ollama, OpenAI, etc.)
      const axios = require('axios');
      const response = await axios.post(`${OLLAMA_URL}/generate`, {
        model: 'phi4-mini:latest',
        prompt: "Analyze the user's mood data and provide a summary, insight, and advice as described.",
        system: systemMessage,
        stream: false,
        options: {
          temperature: 0.7
        }
      });

      // Try to parse the AI's response as JSON
      let aiResult;
      try {
        let raw = response.data.response;
        // Remove code block markers if present
        if (typeof raw === 'string') {
          raw = raw.trim();
          if (raw.startsWith('```json')) {
            raw = raw.replace(/^```json/, '').replace(/```$/, '').trim();
          } else if (raw.startsWith('```')) {
            raw = raw.replace(/^```/, '').replace(/```$/, '').trim();
          }
          aiResult = JSON.parse(raw);
        } else {
          aiResult = raw;
        }
      } catch (e) {
        // If parsing fails, fallback to plain text
        return {
          summary: 'AI could not provide a structured summary.',
          insight: response.data.response,
          advice: ''
        };
      }

      // Return the AI's structured output
      return {
        summary: aiResult.summary || '',
        insight: aiResult.insight || '',
        advice: aiResult.advice || ''
      };
    } catch (error) {
      console.error('Error generating AI insight summary:', error);
      return { summary: '', insight: 'Unable to generate insight at this time.', advice: '' };
    }
  }
};

module.exports = aiService;