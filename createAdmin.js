import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { generateSalt, hashPassword } from './server/security.js';

dotenv.config();

const { MONGO_URI, MONGODB_DB_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!MONGO_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('Set MONGO_URI, ADMIN_EMAIL, and ADMIN_PASSWORD in the local environment.');
}
if (ADMIN_PASSWORD.length < 12 || ADMIN_PASSWORD.length > 128) {
  throw new Error('ADMIN_PASSWORD must be between 12 and 128 characters.');
}

const client = new MongoClient(MONGO_URI);

try {
  await client.connect();
  const db = client.db(MONGODB_DB_NAME || 'hotel-management');
  const staff = db.collection('staff');
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await staff.findOne({ email });
  if (existing) {
    throw new Error('An account with ADMIN_EMAIL already exists. No account was changed.');
  }

  const salt = generateSalt();
  const digest = hashPassword(ADMIN_PASSWORD, salt);
  await staff.insertOne({
    id: `ST-${crypto.randomUUID()}`,
    name: 'Aureline Admin',
    email,
    phone: '',
    role: 'Admin',
    status: 'Active',
    twoFactorEnabled: false,
    salt,
    digest,
  });
  console.log(`Administrator account created for ${email}.`);
} catch (error) {
  console.error('Administrator setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
