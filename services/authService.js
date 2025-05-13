// services/authService.js

const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const helpers = require('../utils/helpers');

const authService = {
  // Generate JWT tokens for a user
  generateTokens: (userId) => {
    const accessToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const refreshToken = jwt.sign(
      { id: userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    
    return { accessToken, refreshToken };
  },

  // Verify a JWT token
  verifyToken: (token) => {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  },

  // Verify a refresh token
  verifyRefreshToken: (token) => {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  },

  // Get user by ID
  getUserById: async (userId) => {
    try {
      const userQuery = 'SELECT * FROM users WHERE id = $1';
      const userResult = await pool.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      return userResult.rows[0];
    } catch (error) {
      // Use helper to extract meaningful database error messages
      throw new Error(helpers.extractDbErrorMessage(error));
    }
  },

  // Register a new user
  registerUser: async (userData) => {
    try {
      // Validate email format
      if (!helpers.isValidEmail(userData.email)) {
        throw new Error('Invalid email format');
      }

      // Generate a random password salt
      const salt = helpers.generateRandomString(16);
      
      const query = `
        INSERT INTO users (email, password_hash, salt, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id, email, created_at
      `;
      
      const result = await pool.query(query, [
        userData.email,
        userData.passwordHash,
        salt
      ]);
      
      return result.rows[0];
    } catch (error) {
      throw new Error(helpers.extractDbErrorMessage(error));
    }
  }
};

module.exports = authService; 