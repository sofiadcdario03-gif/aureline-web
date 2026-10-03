import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db;

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    db = client.db('hotel-management');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

connectToDatabase();

// Email Configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
    console.log('Email sending will be disabled. Check your EMAIL_USER and EMAIL_PASS in .env file.');
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Send staff credentials email
async function sendStaffCredentialsEmail(staff, password) {
  try {
    const mailOptions = {
      from: `"Aureline Hotel No-Reply" <${process.env.EMAIL_USER}>`,
      to: staff.email,
      subject: 'Welcome to Aureline Hotel - Your Staff Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Welcome to Aureline Hotel</h2>
          <p>Dear ${staff.name},</p>
          <p>Your staff account has been created successfully. Here are your login credentials:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Email:</strong> ${staff.email}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p><strong>Role:</strong> ${staff.role}</p>
            <p><strong>Status:</strong> ${staff.status}</p>
          </div>
          <p>Please log in at <a href="http://localhost:5173/login">http://localhost:5173/login</a> and change your password after your first login.</p>
          <p>If you have any questions, please contact your administrator.</p>
          <p style="margin-top: 30px; color: #666;">Best regards,<br>Aureline Hotel Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${staff.email}`);
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error.message);
    console.error('Full error details:', error);
    throw error;
  }
}

// API Routes

// Create guest account
app.post('/api/guests', async (req, res) => {
  try {
    const guest = req.body;
    
    // Server-side validation
    if (!guest.firstName || guest.firstName.length < 2 || guest.firstName.length > 50 || !/^[a-zA-Z\s\-']+$/.test(guest.firstName)) {
      return res.status(400).json({ error: 'Invalid first name' });
    }
    if (!guest.lastName || guest.lastName.length < 2 || guest.lastName.length > 50 || !/^[a-zA-Z\s\-']+$/.test(guest.lastName)) {
      return res.status(400).json({ error: 'Invalid last name' });
    }
    if (!guest.email || guest.email.length < 5 || guest.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (!guest.phone || guest.phone.length < 9) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }
    if (!guest.address || guest.address.length < 10 || guest.address.length > 200 || !/^[a-zA-Z0-9\s#\-']+$/.test(guest.address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    if (!guest.passport || guest.passport.length < 5 || guest.passport.length > 20 || !/^[a-zA-Z0-9]+$/.test(guest.passport)) {
      return res.status(400).json({ error: 'Invalid ID/passport number' });
    }
    
    // Check if email already exists
    const existingGuest = await db.collection('guests').findOne({ 
      email: guest.email.toLowerCase() 
    });
    
    if (existingGuest) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Ensure twoFactorEnabled field exists
    if (guest.twoFactorEnabled === undefined) {
      guest.twoFactorEnabled = false;
    }
    
    // Insert new guest
    const result = await db.collection('guests').insertOne(guest);
    
    res.status(201).json({ 
      message: 'Guest account created successfully',
      guestId: result.insertedId 
    });
  } catch (error) {
    console.error('Error creating guest:', error);
    res.status(500).json({ error: 'Failed to create guest account' });
  }
});

// Get all guests
app.get('/api/guests', async (req, res) => {
  try {
    const guests = await db.collection('guests').find({}).toArray();
    res.json(guests);
  } catch (error) {
    console.error('Error fetching guests:', error);
    res.status(500).json({ error: 'Failed to fetch guests' });
  }
});

// Create account credential
app.post('/api/accounts', async (req, res) => {
  try {
    const credential = req.body;
    
    // Check if guestId already has an account
    const existingAccount = await db.collection('accounts').findOne({ 
      guestId: credential.guestId 
    });
    
    if (existingAccount) {
      return res.status(400).json({ error: 'Account already exists for this guest' });
    }
    
    // Insert new credential
    const result = await db.collection('accounts').insertOne(credential);
    
    res.status(201).json({ 
      message: 'Account credential created successfully',
      accountId: result.insertedId 
    });
  } catch (error) {
    console.error('Error creating account credential:', error);
    res.status(500).json({ error: 'Failed to create account credential' });
  }
});

// Get account by guestId
app.get('/api/accounts/:guestId', async (req, res) => {
  try {
    const { guestId } = req.params;
    const account = await db.collection('accounts').findOne({ guestId });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// Get all accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await db.collection('accounts').find({}).toArray();
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Create staff account
app.post('/api/staff', async (req, res) => {
  try {
    const staff = req.body;

    // Server-side validation
    if (!staff.name || staff.name.length < 2 || staff.name.length > 50) {
      return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
    }
    if (!/^[a-zA-Z\-'\s]+$/.test(staff.name)) {
      return res.status(400).json({ error: 'Name can only contain letters, hyphens, apostrophes, and spaces' });
    }
    if (!staff.email || staff.email.length < 5 || staff.email.length > 254) {
      return res.status(400).json({ error: 'Email must be between 5 and 254 characters' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(staff.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!staff.phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    const digits = staff.phone.replace(/\D/g, '');
    // Remove +63 9 prefix to count actual phone digits
    const phoneDigits = digits.startsWith('639') ? digits.slice(3) : digits;
    if (phoneDigits.length < 9) {
      return res.status(400).json({ error: 'Phone number must be at least 9 digits' });
    }
    if (phoneDigits.length > 9) {
      return res.status(400).json({ error: 'Phone number must be at most 9 digits' });
    }

    // Check if email already exists
    const existingStaff = await db.collection('staff').findOne({
      email: staff.email.toLowerCase()
    });

    if (existingStaff) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Hash the password
    const salt = generateSalt();
    const digest = await hashPassword(tempPassword, salt);

    // Add password hash to staff object (NOT the plain text password)
    staff.salt = salt;
    staff.digest = digest;

    // Ensure twoFactorEnabled field exists
    if (staff.twoFactorEnabled === undefined) {
      staff.twoFactorEnabled = false;
    }

    // Insert new staff
    const result = await db.collection('staff').insertOne(staff);

    // Send email with credentials
    try {
      await sendStaffCredentialsEmail(staff, tempPassword);
      console.log(`Email sent successfully to ${staff.email}`);
    } catch (emailError) {
      console.error('Failed to send email, but staff was created:', emailError);
      // Don't fail the request if email fails, staff is still created
    }

    res.status(201).json({
      message: 'Staff account created successfully',
      staffId: result.insertedId
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ error: 'Failed to create staff account' });
  }
});

// Helper functions for password generation and hashing
function generateTempPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

async function hashPassword(password, salt) {
  const iterations = 100000;
  const keyLength = 32;
  const digest = 'sha256';
  return crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest).toString('hex');
}

// OTP storage (in-memory, expires after 5 minutes)
const otpStore = new Map();

function generateOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  return otp;
}

function storeOTP(email, otp) {
  const expiresAt = Date.now() + 1 * 60 * 1000; // 1 minute (60 seconds)
  otpStore.set(email.toLowerCase(), { otp, expiresAt });
}

function verifyOTP(email, otp) {
  const stored = otpStore.get(email.toLowerCase());
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return false;
  }
  return stored.otp === otp;
}

async function sendOTPEmail(email, otp, purpose) {
  try {
    const mailOptions = {
      from: `"Aureline Hotel No-Reply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Aureline Hotel - ${purpose} Verification Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Your Verification Code</h2>
          <p>Your verification code is:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px;">
            ${otp}
          </div>
          <p>This code will expire in 1 minute.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p style="margin-top: 30px; color: #666;">Best regards,<br>Aureline Hotel Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
}

// Get all staff
app.get('/api/staff', async (req, res) => {
  try {
    const staff = await db.collection('staff').find({}).toArray();
    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Update staff account
app.put('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const staff = req.body;

    // Check if email already exists for another staff member
    const existingStaff = await db.collection('staff').findOne({
      email: staff.email.toLowerCase(),
      id: { $ne: id }
    });

    if (existingStaff) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Filter out MongoDB-specific fields and password hash (keep those as-is)
    const { _id, salt, digest, password, ...updateFields } = staff;

    // Hash password if provided
    if (staff.password) {
      const newSalt = generateSalt();
      const newDigest = await hashPassword(staff.password, newSalt);
      updateFields.salt = newSalt;
      updateFields.digest = newDigest;
    }

    // Update staff
    const result = await db.collection('staff').updateOne(
      { id },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({
      message: 'Staff account updated successfully'
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Failed to update staff account' });
  }
});

// Delete staff account
app.delete('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deletion of admin accounts
    const staff = await db.collection('staff').findOne({ id });
    if (staff && staff.role === 'Admin') {
      return res.status(403).json({ error: 'Cannot delete admin accounts' });
    }

    const result = await db.collection('staff').deleteOne({ id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({
      message: 'Staff account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: 'Failed to delete staff account' });
  }
});

// Update staff password
app.put('/api/staff/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Get current staff
    const staff = await db.collection('staff').findOne({ id });
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Verify current password
    const salt = staff.salt;
    const digest = await hashPassword(currentPassword, salt);
    if (digest !== staff.digest) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newSalt = generateSalt();
    const newDigest = await hashPassword(newPassword, newSalt);

    // Update password
    await db.collection('staff').updateOne(
      { id },
      { $set: { salt: newSalt, digest: newDigest } }
    );

    res.json({
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Generate reset token
function generateResetToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Store reset tokens with expiration
const resetTokenStore = new Map();

function storeResetToken(email, token) {
  const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
  resetTokenStore.set(token, { email, expiresAt });
}

function verifyResetToken(token) {
  const stored = resetTokenStore.get(token);
  if (!stored) return null;
  if (Date.now() > stored.expiresAt) {
    resetTokenStore.delete(token);
    return null;
  }
  return stored.email;
}

// Send reset password email
async function sendResetEmail(email, token) {
  try {
    const resetLink = `http://localhost:5173/reset-password?token=${token}`;
    const mailOptions = {
      from: `"Aureline Hotel No-Reply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Aureline Hotel - Password Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You requested a password reset for your Aureline Hotel account.</p>
          <p>Click the link below to reset your password:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <a href="${resetLink}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666; font-size: 12px;">${resetLink}</p>
          <p>This link will expire in 30 minutes.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <p style="margin-top: 30px; color: #666;">Best regards,<br>Aureline Hotel Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending reset email:', error);
    return false;
  }
}

// Reset password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Verify token
    const email = verifyResetToken(token);
    if (!email) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Hash new password
    const salt = generateSalt();
    const digest = await hashPassword(password, salt);
    
    // Update guest password if exists
    const guest = await db.collection('guests').findOne({ email });
    if (guest) {
      await db.collection('accounts').updateOne(
        { guestId: guest.id },
        { $set: { salt, digest } }
      );
    }
    
    // Update staff password if exists
    const staff = await db.collection('staff').findOne({ email });
    if (staff) {
      await db.collection('staff').updateOne(
        { email },
        { $set: { salt, digest } }
      );
    }
    
    // Delete used token
    resetTokenStore.delete(token);
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Forgot password - send reset email
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const normalizedEmail = email.toLowerCase();
    
    // Check in guests collection
    const guest = await db.collection('guests').findOne({ email: normalizedEmail });
    
    // Check in staff collection
    const staff = await db.collection('staff').findOne({ email: normalizedEmail });
    
    if (!guest && !staff) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }
    
    // Generate and store reset token
    const token = generateResetToken();
    storeResetToken(normalizedEmail, token);
    
    // Send reset email
    const emailSent = await sendResetEmail(normalizedEmail, token);
    
    if (emailSent) {
      res.json({ message: 'Password reset email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send reset email' });
    }
  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Send OTP
app.post('/api/otp/send', async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const otp = generateOTP();
    storeOTP(email, otp);

    const emailSent = await sendOTPEmail(email, otp, purpose);

    if (emailSent) {
      res.json({ message: 'OTP sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send OTP email' });
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP
app.post('/api/otp/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const isValid = verifyOTP(email, otp);

    if (isValid) {
      // Clear OTP after successful verification
      otpStore.delete(email.toLowerCase());
      res.json({ message: 'OTP verified successfully' });
    } else {
      res.status(400).json({ error: 'Invalid or expired OTP' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});
