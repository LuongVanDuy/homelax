import 'dotenv/config';
import crypto from 'node:crypto';
import pg from 'pg';
import argon2 from 'argon2';

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 16 || password === 'GENERATE_LOCALLY') {
  throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD (at least 16 characters) in .env.');
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
  const existing = await client.query('SELECT 1 FROM users LIMIT 1');
  if (existing.rowCount) throw new Error('Database already has users; refusing to create or replace an administrator.');
  await client.query(`INSERT INTO users (id, name, email, password_hash, role_code, role_name, status, email_verified_at)
    VALUES ($1, 'Administrator', $2, $3, 'admin', 'Admin', 'Hoạt động', NOW())`,
  [`user_${crypto.randomUUID()}`, email, await argon2.hash(password)]);
  await client.query('COMMIT');
  console.log('Administrator created. Sign in using the credentials in your local .env.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
