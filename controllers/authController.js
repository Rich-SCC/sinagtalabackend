// controllers/authController.js

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');
const { generateTokens } = require('../middleware/auth');
const { sendResponse } = require('../utils/responseHelper');
const helpers = require('../utils/helpers');
 
const authController = {
// User signup
signup: async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return sendResponse({
        res,
        statusCode: 400,
        error: 'Email and password are required'
      });
    }
    
    // Check if user already exists
    const existingUserQuery = 'SELECT * FROM users WHERE email = $1';
    const existingUser = await pool.query(existingUserQuery, [email]);
    
    if (existingUser.rows.length > 0) {
      return sendResponse({
        res,
        statusCode: 409,
        error: 'User with this email already exists'
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const createUserQuery = `
      INSERT INTO users (email, username, password)
      VALUES ($1, $2, $3)
      RETURNING id, email, username, created_at
    `;
    
    const newUser = await pool.query(
      createUserQuery,
      [email, username || null, hashedPassword]
    );
    
    // Generate JWT tokens
    const tokens = generateTokens(newUser.rows[0].id);
    
    sendResponse({
      res,
      statusCode: 201,
      message: 'User created successfully',
      data: {
        user: {
          ...newUser.rows[0],
          created_at: helpers.toIsoString(newUser.rows[0].created_at)
        },
        ...tokens
      }
    });
  } catch (error) {
    console.error('Error during signup:', error.message);
    sendResponse({
      res,
      statusCode: 500,
      error: 'Failed to create user'
    });
  }
},
  
// User login
login: async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return sendResponse({
        res,
        statusCode: 400,
        error: 'Email and password are required'
      });
    }
    
    // Find user
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);
    
    if (userResult.rows.length === 0) {
      return sendResponse({
        res,
        statusCode: 401,
        error: 'Invalid email or password'
      });
    }
    
    const user = userResult.rows[0];
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return sendResponse({
        res,
        statusCode: 401,
        error: 'Invalid email or password'
      });
    }
    
    // Generate JWT tokens
    const tokens = generateTokens(user.id);
    
    // Send response without password
    const { password: _, ...userWithoutPassword } = user;
    
    sendResponse({
      res,
      message: 'Login successful',
      data: {
        user: {
          ...userWithoutPassword,
          created_at: userWithoutPassword.created_at ? helpers.toIsoString(userWithoutPassword.created_at) : undefined
        },
        ...tokens
      }
    });
  } catch (error) {
    console.error('Error during login:', error.message);
    sendResponse({
      res,
      statusCode: 500,
      error: 'Failed to login'
    });
  }
},
  
// Refresh access token
refreshToken: async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      console.error('Error verifying refresh token:', error.message);
      return res.status(403).json({ error: 'Invalid refresh token' });
    }
    
    // Check if user exists
    const userQuery = 'SELECT * FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate new access token
    const accessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({ accessToken });
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
},
  
// Request password reset
requestPasswordReset: async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendResponse({
        res,
        statusCode: 400,
        error: 'Email is required'
      });
    }
    // Check if user exists
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);
    if (userResult.rows.length === 0) {
      // For security reasons, still return success even if user doesn't exist
      return sendResponse({
        res,
        message: 'If your email is registered, you will receive a password reset code'
      });
    }
    const user = userResult.rows[0];
    // Generate reset code (use token column for demo)
    const resetCode = crypto.randomBytes(6).toString('hex').slice(0, 6).toUpperCase();
    const resetCodeExpiry = new Date(Date.now() + 3600000); // 1 hour
    // Delete any existing reset codes for this user
    const deleteExistingQuery = 'DELETE FROM password_resets WHERE user_id = $1';
    await pool.query(deleteExistingQuery, [user.id]);
    // Insert new reset code
    const insertCodeQuery = `
      INSERT INTO password_resets (user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `;
    await pool.query(insertCodeQuery, [user.id, resetCode, resetCodeExpiry]);
    // In a real application, you would send an email here
    console.log(`Password reset code for ${email}: ${resetCode}`);
    // For demo, return the code in the response
    sendResponse({
      res,
      message: 'If your email is registered, you will receive a password reset code',
      data: { code: resetCode }
    });
  } catch (error) {
    console.error('Error requesting password reset:', error.message);
    sendResponse({
      res,
      statusCode: 500,
      error: 'Failed to request password reset'
    });
  }
},
  
// Verify reset code
verifyResetToken: async (req, res) => {
  try {
    const { code } = req.params;
    // Check if code exists and is valid
    const codeQuery = `
      SELECT * FROM password_resets 
      WHERE token = $1 AND expires_at > NOW()
    `;
    const codeResult = await pool.query(codeQuery, [code]);
    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    res.json({ message: 'Code is valid' });
  } catch (error) {
    console.error('Error verifying reset code:', error.message);
    res.status(500).json({ error: 'Failed to verify code' });
  }
},
  
// Reset password
resetPassword: async (req, res) => {
  try {
    const { code, newPassword } = req.body;
    if (!code || !newPassword) {
      return sendResponse({
        res,
        statusCode: 400,
        error: 'Code and new password are required'
      });
    }
    // Find valid reset code
    const codeQuery = `
      SELECT pr.*, u.email 
      FROM password_resets pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.token = $1 AND pr.expires_at > NOW()
    `;
    const codeResult = await pool.query(codeQuery, [code]);
    if (codeResult.rows.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        error: 'Invalid or expired reset code'
      });
    }
    const resetRequest = codeResult.rows[0];
    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    // Update user's password
    const updatePasswordQuery = `
      UPDATE users 
      SET password = $1 
      WHERE id = $2
      RETURNING id, email, username
    `;
    const updatedUser = await pool.query(updatePasswordQuery, [
      hashedPassword,
      resetRequest.user_id
    ]);
    // Delete used reset code
    const deleteCodeQuery = 'DELETE FROM password_resets WHERE token = $1';
    await pool.query(deleteCodeQuery, [code]);
    sendResponse({
      res,
      message: 'Password reset successful',
      data: {
        user: {
          ...updatedUser.rows[0],
          created_at: updatedUser.rows[0].created_at ? helpers.toIsoString(updatedUser.rows[0].created_at) : undefined
        }
      }
    });
  } catch (error) {
    console.error('Error resetting password:', error.message);
    sendResponse({
      res,
      statusCode: 500,
      error: 'Failed to reset password'
    });
  }
},
  
  // Logout
  logout: async (req, res) => {
    // In a stateless JWT authentication system, the client simply discards the tokens
    // There's no need to invalidate them on the server unless you're using a blacklist
    sendResponse({
      res,
      message: 'Logout successful'
    });
  }
};

module.exports = authController;
