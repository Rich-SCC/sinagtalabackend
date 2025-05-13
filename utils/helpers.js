// utils/helpers.js

const crypto = require('crypto');

const helpers = {
  // Generate a random string
  generateRandomString: (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
  },
  
  // Format date for consistent usage
  formatDate: (date) => {
    return new Date(date).toISOString();
  },
  
  // Convert a value to ISO8601 UTC string with Z
  toIsoString: (value) => {
    if (!value) return null;
    if (value instanceof Date) {
      return value.toISOString();
    }
    let str = value.toString();
    // If the string does not end with 'Z' or contain a timezone, treat as UTC and append 'Z'
    if (!str.endsWith('Z') && !str.match(/[+-][0-9]{2}:[0-9]{2}$/)) {
      str += 'Z';
    }
    const date = new Date(str);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  },
  
  // Extract error message from PostgreSQL errors
  extractDbErrorMessage: (error) => {
    if (error.code === '23505') {
      return 'Duplicate entry. This record already exists.';
    }
    if (error.code === '23503') {
      return 'This operation affects related records that cannot be modified.';
    }
    return error.message || 'A database error occurred';
  },
  
  // Validate email format
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Get the earliest valid date from an array of date values (strings or Date objects)
  getEarliestDate: (dates) => {
    const validDates = dates
      .filter(Boolean)
      .map(d => new Date(d))
      .filter(date => !isNaN(date.getTime()));
    if (validDates.length === 0) return null;
    const earliest = new Date(Math.min(...validDates.map(d => d.getTime())));
    return earliest.toISOString();
  }
};

module.exports = helpers;