/**
 * Standard API response helper
 * @param {Object} options - Response options
 * @param {Object} options.res - Express response object
 * @param {number} options.statusCode - HTTP status code
 * @param {string} options.message - Response message
 * @param {Object} options.data - Response data
 * @param {Object} options.error - Error details
 * @returns {Object} Standardized response object
 */
const sendResponse = (options) => {
  const { res, statusCode = 200, message = null, data = null, error = null } = options;

  const response = {
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
    error
  };

  // Remove null/undefined fields
  Object.keys(response).forEach(key => {
    if (response[key] === null || response[key] === undefined) {
      delete response[key];
    }
  });

  return res.status(statusCode).json(response);
};

module.exports = {
  sendResponse
}; 