import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import {
  createAccessToken,
  generateSalt,
  hashPassword,
  verifyAccessToken,
  verifyPassword,
} from './security.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const tokenSecret = process.env.JWT_SECRET || crypto.randomBytes(32);

if (process.env.JWT_SECRET && Buffer.byteLength(process.env.JWT_SECRET) < 32) {
  throw new Error('JWT_SECRET must contain at least 32 bytes.');
}
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production.');
  }
  console.warn('JWT_SECRET is unset; sign-in tokens will be invalidated when the server restarts.');
}

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection with pooling for serverless
let db;
let clientPromise;

if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI must be configured');
}

const uri = process.env.MONGO_URI;
const options = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 10000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
};

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  const client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

async function connectToDatabase() {
  const client = await clientPromise;
  if (!db) {
    db = client.db(process.env.MONGODB_DB_NAME || 'hotel-management');
    console.log('Connected to MongoDB Atlas');
    // Create indexes in the background — don't block requests waiting for them
    Promise.all([
      db.collection('rooms').createIndex({ id: 1 }, { unique: true }),
      db.collection('rooms').createIndex({ number: 1 }, { unique: true }),
      db.collection('rooms').createIndex({ status: 1, type: 1, capacity: 1 }),
      db.collection('reservations').createIndex({ id: 1 }, { unique: true }),
      db.collection('reservations').createIndex({ roomId: 1, status: 1, checkIn: 1 }),
      db.collection('reservations').createIndex({ guestId: 1, createdAt: -1 }),
      db.collection('payments').createIndex({ id: 1 }, { unique: true }),
      db.collection('payments').createIndex({ bookingId: 1 }),
      db.collection('guests').createIndex({ id: 1 }, { unique: true }),
      db.collection('guests').createIndex({ email: 1 }, { unique: true }),
      db.collection('staff').createIndex({ id: 1 }, { unique: true }),
      db.collection('staff').createIndex({ email: 1 }, { unique: true }),
      db.collection('accounts').createIndex({ guestId: 1 }, { unique: true }),
      db.collection('otps').createIndex({ email: 1 }, { unique: true }),
      db.collection('otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection('loginChallenges').createIndex({ email: 1 }, { unique: true }),
      db.collection('loginChallenges').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection('registrationTickets').createIndex({ token: 1 }, { unique: true }),
      db.collection('registrationTickets').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection('resetTokens').createIndex({ token: 1 }, { unique: true }),
      db.collection('resetTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((err) => console.error('Index creation error (non-fatal):', err.message));
  }
  return db;
}

const ACTIVE_RESERVATION_STATUSES = ['Pending', 'Confirmed', 'Checked-in'];

function validStayDates(checkIn, checkOut) {
  const validDate = (value) =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  return validDate(checkIn) && validDate(checkOut) && checkOut > checkIn;
}

function hotelToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

function stayNights(checkIn, checkOut) {
  return Math.round(
    (Date.parse(`${checkOut}T00:00:00.000Z`) - Date.parse(`${checkIn}T00:00:00.000Z`)) / 86400000,
  );
}

function stayTotal(booking) {
  return Math.round(booking.rate * stayNights(booking.checkIn, booking.checkOut) * 100) / 100;
}

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  const identity = verifyAccessToken(token, tokenSecret);
  if (
    !identity ||
    Boolean(identity.guestId) === Boolean(identity.staffId) ||
    !['Guest', 'Admin', 'Front Desk'].includes(identity.role)
  ) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }

  const database = await connectToDatabase();
  const person = identity.guestId
    ? await database.collection('guests').findOne({ id: identity.guestId }, { projection: { _id: 0 } })
    : await database
        .collection('staff')
        .findOne(
          { id: identity.staffId, status: 'Active' },
          { projection: { _id: 0, salt: 0, digest: 0, password: 0 } },
        );
  if (
    !person ||
    (identity.guestId && identity.role !== 'Guest') ||
    (identity.staffId && identity.role !== person.role)
  ) {
    return res.status(401).json({ error: 'Your session is no longer valid.' });
  }

  req.auth = {
    ...identity,
    name: identity.guestId ? `${person.firstName} ${person.lastName}` : person.name,
  };
  next();
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'You are not allowed to perform this action.' });
    }
    next();
  };
}

function safeRoom(room) {
  const { _id, reservationVersion, ...publicRoom } = room;
  return publicRoom;
}

function safeReservation(reservation) {
  const { _id, paymentVersion, ...publicReservation } = reservation;
  return publicReservation;
}

function validateRoom(room) {
  if (
    !room ||
    typeof room.number !== 'string' ||
    !room.number.trim() ||
    room.number.length > 20 ||
    !['Single', 'Double', 'Deluxe', 'Suite'].includes(room.type) ||
    !Number.isInteger(Number(room.capacity)) ||
    Number(room.capacity) < 1 ||
    Number(room.capacity) > 20 ||
    !Number.isFinite(Number(room.price)) ||
    Number(room.price) <= 0 ||
    !['Available', 'Maintenance', 'Inactive'].includes(room.status) ||
    typeof room.description !== 'string' ||
    !room.description.trim() ||
    typeof room.image !== 'string'
  ) {
    return 'Provide a valid room number, type, capacity, price, status, description, and image.';
  }
  try {
    const imageUrl = new URL(room.image);
    if (!['http:', 'https:'].includes(imageUrl.protocol))
      return 'Image URL must use HTTP or HTTPS.';
  } catch {
    return 'Enter a valid image URL.';
  }
  return null;
}

async function loadAvailableRooms(query = {}) {
  const database = await connectToDatabase();
  const filter = { status: { $ne: 'Inactive' } };
  if (query.type && ['Single', 'Double', 'Deluxe', 'Suite'].includes(query.type)) {
    filter.type = query.type;
  }
  const capacity = Number(query.guests);
  if (Number.isInteger(capacity) && capacity > 0) filter.capacity = { $gte: capacity };
  let rooms = await database.collection('rooms').find(filter).toArray();
  if (query.checkIn || query.checkOut) {
    if (!validStayDates(query.checkIn, query.checkOut) || query.checkIn < hotelToday()) {
      return { error: 'Choose valid future dates with check-out after check-in.' };
    }
    const roomIds = rooms.map((room) => room.id);
    const conflicts = await database
      .collection('reservations')
      .find({
        roomId: { $in: roomIds },
        status: { $in: ACTIVE_RESERVATION_STATUSES },
        checkIn: { $lt: query.checkOut },
        checkOut: { $gt: query.checkIn },
      })
      .project({ roomId: 1 })
      .toArray();
    const unavailableIds = new Set(conflicts.map((booking) => booking.roomId));
    rooms = rooms.filter((room) => room.status === 'Available' && !unavailableIds.has(room.id));
  }
  return { rooms: rooms.map(safeRoom) };
}

async function checkStayAvailability(room, checkIn, checkOut, session, excludedId) {
  const database = await connectToDatabase();
  if (room.status !== 'Available') return false;
  return !(await database.collection('reservations').findOne(
    {
      roomId: room.id,
      ...(excludedId ? { id: { $ne: excludedId } } : {}),
      status: { $in: ACTIVE_RESERVATION_STATUSES },
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
    },
    { session },
  ));
}

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

// Verify email configuration on startup (non-blocking, never throws)
transporter.verify((error) => {
  if (error) {
    console.error('Email configuration error:', error.message);
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
          <p>Please log in and change your password after your first login.</p>
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

function requestError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanPerson(person) {
  if (person.role === 'Guest') {
    return {
      name: `${person.firstName} ${person.lastName}`,
      role: 'Guest',
      guestId: person.id,
      twoFactorEnabled: person.twoFactorEnabled === true,
    };
  }
  return {
    name: person.name,
    role: person.role,
    staffId: person.id,
    twoFactorEnabled: person.twoFactorEnabled === true,
  };
}

app.post('/api/auth/login', async (req, res) => {
  const database = await connectToDatabase();
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body.password;
  if (!email || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const [guest, staff] = await Promise.all([
    database.collection('guests').findOne({ email }),
    database.collection('staff').findOne({ email }),
  ]);
  const person = guest || staff;
  if (
    !person ||
    typeof person.id !== 'string' ||
    (staff && (staff.status !== 'Active' || !['Admin', 'Front Desk'].includes(staff.role)))
  ) {
    return res.status(401).json({ error: 'The email or password is incorrect.' });
  }

  let passwordValid = false;
  if (guest) {
    const credential = await database.collection('accounts').findOne({ guestId: guest.id });
    passwordValid = verifyPassword(password, credential?.salt, credential?.digest);
  } else if (staff.salt && staff.digest) {
    passwordValid = verifyPassword(password, staff.salt, staff.digest);
  } else if (typeof staff.password === 'string') {
    const storedPassword = Buffer.from(staff.password);
    const suppliedPassword = Buffer.from(password);
    passwordValid =
      storedPassword.length === suppliedPassword.length &&
      crypto.timingSafeEqual(storedPassword, suppliedPassword);
    if (passwordValid) {
      const salt = generateSalt();
      const digest = await hashPassword(password, salt);
      await database
        .collection('staff')
        .updateOne({ _id: staff._id }, { $set: { salt, digest }, $unset: { password: '' } });
    }
  }
  if (!passwordValid) return res.status(401).json({ error: 'The email or password is incorrect.' });

  const user = cleanPerson({ ...person, role: guest ? 'Guest' : staff.role });
  const identity = {
    role: user.role,
    ...(guest ? { guestId: guest.id } : { staffId: staff.id }),
  };
  if (user.twoFactorEnabled) {
    await storeLoginChallenge(database, email, identity, user);
    return res.json({ requiresOtp: true, user });
  }
  res.json({
    token: createAccessToken(identity, tokenSecret),
    user,
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({
    user: {
      name: req.auth.name,
      role: req.auth.role,
      ...(req.auth.guestId ? { guestId: req.auth.guestId } : { staffId: req.auth.staffId }),
    },
  });
});

app.get('/api/profile', authenticate, async (req, res) => {
  const database = await connectToDatabase();
  const collection = req.auth.guestId ? 'guests' : 'staff';
  const filter = req.auth.guestId ? { id: req.auth.guestId } : { id: req.auth.staffId };
  const profile = await database
    .collection(collection)
    .findOne(filter, { projection: { _id: 0, salt: 0, digest: 0, password: 0 } });
  if (!profile) return res.status(404).json({ error: 'Profile not found.' });
  res.json(profile);
});

// OTP storage (MongoDB-based for serverless persistence)
async function storeOTP(db, email, otp, purpose) {
  const expiresAt = Date.now() + 1 * 60 * 1000; // 1 minute (60 seconds)
  await db.collection('otps').updateOne(
    { email: email.toLowerCase() },
    { $set: { otp, purpose, expiresAt } },
    { upsert: true }
  );
}

async function verifyOTP(db, email, otp) {
  const stored = await db.collection('otps').findOne({ email: email.toLowerCase() });
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    await db.collection('otps').deleteOne({ email: email.toLowerCase() });
    return false;
  }
  if (stored.otp === otp) {
    await db.collection('otps').deleteOne({ email: email.toLowerCase() });
    return { otp: stored.otp, purpose: stored.purpose };
  }
  return false;
}

async function storeLoginChallenge(db, email, identity, user) {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  await db.collection('loginChallenges').updateOne(
    { email: email.toLowerCase() },
    { $set: { identity, user, expiresAt } },
    { upsert: true }
  );
}

async function getLoginChallenge(db, email) {
  const challenge = await db.collection('loginChallenges').findOne({ email: email.toLowerCase() });
  if (!challenge) return null;
  if (Date.now() > challenge.expiresAt) {
    await db.collection('loginChallenges').deleteOne({ email: email.toLowerCase() });
    return null;
  }
  return challenge;
}

async function deleteLoginChallenge(db, email) {
  await db.collection('loginChallenges').deleteOne({ email: email.toLowerCase() });
}

async function storeRegistrationTicket(db, email, registrationToken) {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  await db.collection('registrationTickets').updateOne(
    { token: registrationToken },
    { $set: { email: email.toLowerCase(), expiresAt } },
    { upsert: true }
  );
}

async function verifyRegistrationTicket(db, token) {
  const ticket = await db.collection('registrationTickets').findOne({ token });
  if (!ticket) return null;
  if (Date.now() > ticket.expiresAt) {
    await db.collection('registrationTickets').deleteOne({ token });
    return null;
  }
  return ticket;
}

async function deleteRegistrationTicket(db, token) {
  await db.collection('registrationTickets').deleteOne({ token });
}

async function storeResetToken(db, email, token) {
  const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
  await db.collection('resetTokens').updateOne(
    { token },
    { $set: { email: email.toLowerCase(), expiresAt } },
    { upsert: true }
  );
}

async function verifyResetToken(db, token) {
  const stored = await db.collection('resetTokens').findOne({ token });
  if (!stored) return null;
  if (Date.now() > stored.expiresAt) {
    await db.collection('resetTokens').deleteOne({ token });
    return null;
  }
  return stored.email;
}

async function deleteResetToken(db, token) {
  await db.collection('resetTokens').deleteOne({ token });
}

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
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

// OTP endpoints
app.post('/api/otp/send', async (req, res) => {
  try {
    const database = await connectToDatabase();
    const { email, purpose } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const normalizedEmail = email.toLowerCase();
    if (
      purpose === 'Login Verification'
    ) {
      const challenge = await getLoginChallenge(database, normalizedEmail);
      if (!challenge || challenge.expiresAt <= Date.now()) {
        await deleteLoginChallenge(database, normalizedEmail);
        return res
          .status(400)
          .json({ error: 'Sign in again before requesting a verification code.' });
      }
    }

    const otp = generateOTP();
    await storeOTP(database, normalizedEmail, otp, purpose);

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

app.post('/api/otp/verify', async (req, res) => {
  try {
    const database = await connectToDatabase();
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const verified = await verifyOTP(database, email, otp);

    if (verified) {
      if (verified.purpose === 'Login Verification') {
        const challenge = await getLoginChallenge(database, email.toLowerCase());
        await deleteLoginChallenge(database, email.toLowerCase());
        if (!challenge || challenge.expiresAt <= Date.now()) {
          return res.status(400).json({ error: 'Sign in again to verify your account.' });
        }
        return res.json({
          message: 'OTP verified successfully',
          token: createAccessToken(challenge.identity, tokenSecret),
          user: challenge.user,
        });
      }
      if (verified.purpose === 'Account Creation') {
        const registrationToken = crypto.randomBytes(32).toString('base64url');
        await storeRegistrationTicket(database, email.toLowerCase(), registrationToken);
        return res.json({
          message: 'OTP verified successfully',
          registrationToken,
        });
      }
      res.json({ message: 'OTP verified successfully' });
    } else {
      res.status(400).json({ error: 'Invalid or expired OTP' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Password reset
function generateResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

async function sendResetEmail(email, token) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
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

app.post('/api/forgot-password', async (req, res) => {
  try {
    const database = await connectToDatabase();
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase();

    const guest = await database.collection('guests').findOne({ email: normalizedEmail });
    const staff = await database.collection('staff').findOne({ email: normalizedEmail });

    if (!guest && !staff) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    const token = generateResetToken();
    await storeResetToken(database, normalizedEmail, token);

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

app.post('/api/reset-password', async (req, res) => {
  try {
    const database = await connectToDatabase();
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const email = await verifyResetToken(database, token);
    if (!email) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const salt = generateSalt();
    const digest = await hashPassword(password, salt);

    const guest = await database.collection('guests').findOne({ email });
    if (guest) {
      await database.collection('accounts').updateOne({ guestId: guest.id }, { $set: { salt, digest } });
    }

    const staff = await database.collection('staff').findOne({ email });
    if (staff) {
      await database.collection('staff').updateOne({ email }, { $set: { salt, digest } });
    }

    await deleteResetToken(database, token);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.get('/api/rooms', async (req, res) => {
  const result = await loadAvailableRooms({
    type: req.query.type,
    guests: req.query.guests,
    checkIn: req.query.checkIn,
    checkOut: req.query.checkOut,
  });
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result.rooms);
});

app.get('/api/rooms/:id', async (req, res) => {
  const database = await connectToDatabase();
  const room = await database.collection('rooms').findOne({ id: req.params.id });
  if (!room || room.status === 'Inactive')
    return res.status(404).json({ error: 'Room not found.' });
  res.json(safeRoom(room));
});

app.get('/api/reservations', authenticate, async (req, res) => {
  const database = await connectToDatabase();
  const filter = req.auth.guestId ? { guestId: req.auth.guestId } : {};
  const reservations = await database
    .collection('reservations')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  res.json(reservations.map(safeReservation));
});

app.post('/api/reservations', authenticate, async (req, res) => {
  const database = await connectToDatabase();
  const { roomId, checkIn, checkOut } = req.body;
  const guestId = req.auth.guestId || req.body.guestId;
  const guests = Number(req.body.guests);
  if (!roomId || !validStayDates(checkIn, checkOut) || checkIn < hotelToday()) {
    return res
      .status(400)
      .json({ error: 'Choose a valid room and future check-in/check-out dates.' });
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
    return res.status(400).json({ error: 'Guest count must be between 1 and 20.' });
  }
  const guest = await database.collection('guests').findOne({ id: guestId }, { projection: { _id: 0 } });
  if (!guest) return res.status(400).json({ error: 'Select a valid guest profile.' });

  const reservation = {
    id: `AH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
    guestId,
    roomId,
    checkIn,
    checkOut,
    guests,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  const session = database.startSession();
  try {
    await session.withTransaction(async () => {
      const room = await database.collection('rooms').findOne({ id: roomId }, { session });
      if (!room || room.status === 'Inactive') throw requestError(404, 'Room not found.');
      if (room.status !== 'Available') throw requestError(409, 'This room is not available.');
      if (room.capacity < guests)
        throw requestError(400, 'This room does not have enough capacity.');
      const claim = await database
        .collection('rooms')
        .updateOne(
          { id: roomId, status: 'Available' },
          { $inc: { reservationVersion: 1 } },
          { session },
        );
      if (claim.modifiedCount !== 1) throw requestError(409, 'This room is no longer available.');
      if (!(await checkStayAvailability(room, checkIn, checkOut, session))) {
        throw requestError(409, 'This room is no longer available for those dates.');
      }
      reservation.rate = room.price;
      await database.collection('reservations').insertOne(reservation, { session });
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  } finally {
    await session.endSession();
  }
  res.status(201).json(safeReservation(reservation));
});

app.patch('/api/reservations/:id/status', authenticate, async (req, res) => {
  const database = await connectToDatabase();
  const { status } = req.body;
  const booking = await database.collection('reservations').findOne({ id: req.params.id });
  if (!booking) return res.status(404).json({ error: 'Reservation not found.' });
  if (req.auth.role === 'Guest') {
    if (booking.guestId !== req.auth.guestId || status !== 'Cancelled') {
      return res.status(403).json({ error: 'You are not allowed to change this reservation.' });
    }
  } else if (!['Admin', 'Front Desk'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'You are not allowed to change this reservation.' });
  }
  if (!['Pending', 'Confirmed', 'Checked-in', 'Checked-out', 'Cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid reservation status.' });
  }
  const transitions = {
    Pending: ['Confirmed', 'Cancelled'],
    Confirmed: ['Checked-in', 'Cancelled'],
    'Checked-in': ['Checked-out'],
    'Checked-out': [],
    Cancelled: [],
  };
  if (!transitions[booking.status]?.includes(status)) {
    return res.status(409).json({ error: 'That reservation status change is not allowed.' });
  }
  if (
    status === 'Checked-in' &&
    (booking.checkIn > hotelToday() || booking.checkOut <= hotelToday())
  ) {
    return res.status(409).json({ error: 'Check-in is only available during the stay dates.' });
  }
  if (status === 'Checked-in') {
    const otherStay = await database.collection('reservations').findOne({
      id: { $ne: booking.id },
      roomId: booking.roomId,
      status: 'Checked-in',
    });
    if (otherStay) return res.status(409).json({ error: 'This room is already occupied.' });
  }
  if (status === 'Checked-out') {
    const payments = await database.collection('payments').find({ bookingId: booking.id }).toArray();
    const paid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (paid < stayTotal(booking)) {
      return res.status(409).json({ error: 'Settle the reservation balance before checkout.' });
    }
  }
  const updatedAt = new Date().toISOString();
  const update = await database
    .collection('reservations')
    .updateOne(
      { id: booking.id, status: booking.status },
      { $set: { status, updatedAt }, $inc: { paymentVersion: 1 } },
    );
  if (update.modifiedCount !== 1) {
    return res
      .status(409)
      .json({ error: 'Reservation changed before this update could be applied.' });
  }
  res.json({ ...safeReservation(booking), status, updatedAt });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled API error:', error);
  if (res.headersSent) return next(error);
  res.status(error.status || 500).json({
    error: error.status ? error.message : 'An unexpected server error occurred.',
  });
});

// Export for Vercel serverless
export default app;
