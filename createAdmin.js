import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

async function passwordDigest(password, salt) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

async function createDefaultAdmin() {
  const uri = process.env.MONGO_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    const db = client.db('hotel-management');

    // Hash the password
    const password = 'Aureline2026!';
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const digest = await passwordDigest(password, salt);

    // Create admin staff account
    const admin = {
      id: 'ST-ADMIN',
      name: 'Aureline Admin',
      email: 'connect.aureline.admin@gmail.com',
      phone: '+63 900 000 0000',
      role: 'Admin',
      status: 'Active',
      twoFactorEnabled: false,
      salt,
      digest
    };

    // Check if admin already exists
    const existingAdmin = await db.collection('staff').findOne({
      email: admin.email.toLowerCase()
    });

    if (existingAdmin) {
      console.log('Admin account already exists. Updating...');
      await db.collection('staff').updateOne(
        { email: admin.email.toLowerCase() },
        { $set: admin, $unset: { password: '' } }
      );
      console.log('Admin account updated successfully');
    } else {
      const result = await db.collection('staff').insertOne(admin);
      console.log('Default admin account created successfully');
      console.log('Admin ID:', result.insertedId);
    }

    console.log('\nAdmin credentials:');
    console.log('Email:', admin.email);
    console.log('Password:', password);
    console.log('Role:', admin.role);

  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

createDefaultAdmin();
