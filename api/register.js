import pool from './db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await pool.execute(
      `INSERT INTO tbluser (username, password, created_by) VALUES (?, ?, ?)`,
      [username, hashedPassword, 'SYSTEM_REG']
    );
    res.status(201).json({ success: true, message: 'User created' });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
}