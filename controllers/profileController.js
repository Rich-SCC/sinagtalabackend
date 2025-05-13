// controllers/profileController.js

const bcrypt = require('bcrypt');
const { pool } = require('../db');
const helpers = require('../utils/helpers');

const profileController = {
  // Get user profile
  getProfile: async (req, res) => {
    try {
      // User data is already available from verifyUser middleware
      const user = req.dbUser;
      
      // Remove sensitive information
      const { password, ...userProfile } = user;
      
      res.json({
        success: true,
        data: {
          ...userProfile,
          created_at: userProfile.created_at ? helpers.toIsoString(userProfile.created_at) : undefined
        }
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch profile' 
      });
    }
  },
  
  // Update user profile
  updateProfile: async (req, res) => {
    try {
      const userId = req.user.id;
      const { username, email } = req.body;
      
      // Prepare update fields
      const updateFields = [];
      const queryParams = [];
      let paramCounter = 1;
      
      if (username !== undefined) {
        updateFields.push(`username = $${paramCounter++}`);
        queryParams.push(username);
      }
      
      if (email !== undefined) {
        // Check if email already exists for a different user
        if (email !== req.dbUser.email) {
          const emailCheckQuery = 'SELECT * FROM users WHERE email = $1 AND id != $2';
          const emailCheck = await pool.query(emailCheckQuery, [email, userId]);
          
          if (emailCheck.rows.length > 0) {
            return res.status(409).json({ 
              success: false,
              error: 'Email already in use' 
            });
          }
        }
        
        updateFields.push(`email = $${paramCounter++}`);
        queryParams.push(email);
      }
      
      // If no fields to update
      if (updateFields.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'No valid fields to update' 
        });
      }
      
      // Add userId to params
      queryParams.push(userId);
      
      // Update user
      const updateQuery = `
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCounter}
        RETURNING id, email, username, created_at
      `;
      
      const updatedUser = await pool.query(updateQuery, queryParams);
      
      res.json({
        success: true,
        data: {
          message: 'Profile updated successfully',
          user: {
            ...updatedUser.rows[0],
            created_at: updatedUser.rows[0].created_at ? helpers.toIsoString(updatedUser.rows[0].created_at) : undefined
          }
        }
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to update profile' 
      });
    }
  },
  
  // Change password
  changePassword: async (req, res) => {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          success: false,
          error: 'Current password and new password are required' 
        });
      }
      
      // Verify current password
      const userQuery = 'SELECT * FROM users WHERE id = $1';
      const userResult = await pool.query(userQuery, [userId]);
      const user = userResult.rows[0];
      
      const passwordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!passwordValid) {
        return res.status(401).json({ 
          success: false,
          error: 'Current password is incorrect' 
        });
      }
      
      // Hash new password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      // Update password
      const updateQuery = `
        UPDATE users
        SET password = $1
        WHERE id = $2
        RETURNING id, email, username, created_at
      `;
      
      const updatedUser = await pool.query(updateQuery, [hashedPassword, userId]);
      
      res.json({
        success: true,
        data: {
          message: 'Password changed successfully',
          user: {
            ...updatedUser.rows[0],
            created_at: updatedUser.rows[0].created_at ? helpers.toIsoString(updatedUser.rows[0].created_at) : undefined
          }
        }
      });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to change password' 
      });
    }
  },
  
  // Delete account
  deleteAccount: async (req, res) => {
    try {
      const userId = req.user.id;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ 
          success: false,
          error: 'Password is required to delete account' 
        });
      }
      
      // Verify password
      const userQuery = 'SELECT * FROM users WHERE id = $1';
      const userResult = await pool.query(userQuery, [userId]);
      const user = userResult.rows[0];
      
      const passwordValid = await bcrypt.compare(password, user.password);
      
      if (!passwordValid) {
        return res.status(401).json({ 
          success: false,
          error: 'Password is incorrect' 
        });
      }
      
      // Delete user (cascade will handle related records)
      const deleteQuery = 'DELETE FROM users WHERE id = $1';
      await pool.query(deleteQuery, [userId]);
      
      res.json({ 
        success: true,
        data: { 
          message: 'Account deleted successfully' 
        }
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to delete account' 
      });
    }
  }
};

module.exports = profileController;