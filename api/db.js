import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  // Railway provides a single connection string (URI)
  uri: process.env.DATABASE_URL, 
  waitForConnections: true,
  connectionLimit: 10, // Good for Vercel's serverless nature
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export default pool;