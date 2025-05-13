// middleware/auth.js
const jwt = require('jsonwebtoken');
const authService = require('../services/authService');
const { sendResponse } = require('../utils/responseHelper');

const auth = {
  // Middleware to verify JWT token
  authenticateToken: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN format
    
    if (!token) {
      return sendResponse({
        res,
        statusCode: 401,
        error: 'Access denied. No token provided.'
      });
    }
    
    try {
      const decoded = authService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return sendResponse({
        res,
        statusCode: 403,
        error: 'Invalid token.'
      });
    }
  },
  
  // Helper function to generate JWT tokens
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
  
  // Middleware to verify user exists
  verifyUser: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const user = await authService.getUserById(userId);
      req.dbUser = user;
      next();
    } catch (error) {
      console.error('Error verifying user:', error);
      return sendResponse({
        res,
        statusCode: 404,
        error: 'User not found.'
      });
    }
  }
};

module.exports = auth;
