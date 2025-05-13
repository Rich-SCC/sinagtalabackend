// db.js
const { Pool } = require('pg');
const winston = require('winston');
require('dotenv').config();

// Create a connection pool to PostgreSQL with optimized settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 5000, // How long to wait for a connection
  maxUses: 7500, // Close a connection after it has been used this many times
  statement_timeout: 10000, // 10 seconds timeout for queries
  query_timeout: 10000, // 10 seconds timeout for queries
});

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Handle pool errors
pool.on('error', (err, client) => {
  winston.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test the database connection
const testConnection = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
    winston.info('Successfully connected to the database');
  } catch (err) {
    winston.error('Error connecting to the database:', err);
    process.exit(-1);
  } finally {
    client.release();
  }
};

testConnection();

module.exports = { pool };
