import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import {
  createAccessToken,
  generateSalt,
  hashPassword,
  verifyAccessToken,
  verifyPassword,
} from './security.js';

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
  console.error('MONGO_URI environment variable is not set');
  // Don't throw in module scope - let it fail at runtime with better error message
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

if (!uri) {
  console.error('MONGO_URI is not configured');
} else if (process.env.NODE_ENV === 'development') {
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
  if (!clientPromise) {
    throw new Error('Database connection not initialized - MONGO_URI may be missing');
  }
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
  return { db, client };
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
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    const identity = verifyAccessToken(token, tokenSecret);
    if (
      !identity ||
      Boolean(identity.guestId) === Boolean(identity.staffId) ||
      !['Guest', 'Admin', 'Front Desk'].includes(identity.role)
    ) {
      return res.status(401).json({ error: 'Please sign in to continue.' });
    }

    const { db: database } = await connectToDatabase();
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
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed', message: error.message });
  }
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
  try {
    const { db: database } = await connectToDatabase();
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
  } catch (error) {
    console.error('Error in loadAvailableRooms:', error);
    return { error: error.message || 'Failed to load available rooms' };
  }
}

async function checkStayAvailability(room, checkIn, checkOut, session, excludedId) {
  const { db: database } = await connectToDatabase();
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
  const { db: database, client } = await connectToDatabase();
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
  const { db: database, client } = await connectToDatabase();
  const collection = req.auth.guestId ? 'guests' : 'staff';
  const filter = req.auth.guestId ? { id: req.auth.guestId } : { id: req.auth.staffId };
  const profile = await database
    .collection(collection)
    .findOne(filter, { projection: { _id: 0, salt: 0, digest: 0, password: 0 } });
  if (!profile) return res.status(404).json({ error: 'Profile not found.' });
  res.json(profile);
});

app.get('/api/auth/check-email', async (req, res) => {
  try {
    const { db: database } = await connectToDatabase();
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : null;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Provide a valid email address.' });
    }
    const guestFilter = excludeId ? { email, id: { $ne: excludeId } } : { email };
    const staffFilter = excludeId ? { email, id: { $ne: excludeId } } : { email };
    const [guest, staff] = await Promise.all([
      database.collection('guests').findOne(guestFilter, { projection: { _id: 1 } }),
      database.collection('staff').findOne(staffFilter, { projection: { _id: 1 } }),
    ]);
    res.json({ available: !guest && !staff });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ error: 'Failed to check email availability' });
  }
});

app.get('/api/auth/check-phone', async (req, res) => {
  try {
    const { db: database } = await connectToDatabase();
    const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
    const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : null;
    if (!phone || !/^\+63\s9\d{9}$/.test(phone)) {
      return res.status(400).json({ error: 'Provide a valid phone number.' });
    }
    const guestFilter = excludeId ? { phone, id: { $ne: excludeId } } : { phone };
    const staffFilter = excludeId ? { phone, id: { $ne: excludeId } } : { phone };
    const [guest, staff] = await Promise.all([
      database.collection('guests').findOne(guestFilter, { projection: { _id: 1 } }),
      database.collection('staff').findOne(staffFilter, { projection: { _id: 1 } }),
    ]);
    res.json({ available: !guest && !staff });
  } catch (error) {
    console.error('Error checking phone:', error);
    res.status(500).json({ error: 'Failed to check phone availability' });
  }
});

app.get('/api/auth/check-passport', async (req, res) => {
  try {
    const { db: database } = await connectToDatabase();
    const passport = typeof req.query.passport === 'string' ? req.query.passport.trim() : '';
    const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : null;
    if (!passport || !/^[a-zA-Z0-9\-]{5,20}$/.test(passport)) {
      return res.status(400).json({ error: 'Provide a valid ID/passport number.' });
    }
    const filter = excludeId ? { passport, id: { $ne: excludeId } } : { passport };
    const guest = await database.collection('guests').findOne(filter, { projection: { _id: 1 } });
    res.json({ available: !guest });
  } catch (error) {
    console.error('Error checking passport:', error);
    res.status(500).json({ error: 'Failed to check passport availability' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { db: database, client } = await connectToDatabase();
    const profile = req.body.profile;
    const password = req.body.password;
    const ticket = await verifyRegistrationTicket(database, req.body.verificationToken);
    if (!ticket) {
      return res.status(401).json({ error: 'Verify your email before creating an account.' });
    }
    if (
      !profile ||
      typeof profile !== 'object' ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      return res
        .status(400)
        .json({ error: 'Provide valid guest details and a password of at least 8 characters.' });
    }
    const firstName = typeof profile.firstName === 'string' ? profile.firstName.trim() : '';
    const lastName = typeof profile.lastName === 'string' ? profile.lastName.trim() : '';
    const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
    if (
      !/^[a-zA-Z\s\-']{2,50}$/.test(firstName) ||
      !/^[a-zA-Z\s\-']{2,50}$/.test(lastName) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      ticket.email !== email ||
      typeof profile.phone !== 'string' ||
      !/^\+63\s9\d{9}$/.test(profile.phone) ||
      typeof profile.address !== 'string' ||
      profile.address.length < 10 ||
      profile.address.length > 200 ||
      !/^[a-zA-Z0-9\s#\-']+$/.test(profile.address) ||
      typeof profile.passport !== 'string' ||
      !/^[a-zA-Z0-9\-]{5,20}$/.test(profile.passport)
    ) {
      return res.status(400).json({ error: 'Please provide valid guest profile details.' });
    }

    await deleteRegistrationTicket(database, req.body.verificationToken);
    if (await database.collection('staff').findOne({ email })) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    if (await database.collection('guests').findOne({ email })) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    if (await database.collection('staff').findOne({ phone: profile.phone })) {
      return res.status(409).json({ error: 'Phone number already registered.' });
    }
    if (await database.collection('guests').findOne({ phone: profile.phone })) {
      return res.status(409).json({ error: 'Phone number already registered.' });
    }
    const guestId = `G-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const salt = generateSalt();
    const digest = await hashPassword(password, salt);
    const guest = {
      id: guestId,
      firstName,
      lastName,
      email,
      phone: profile.phone,
      address: profile.address,
      passport: profile.passport,
      twoFactorEnabled: false,
    };
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await database.collection('guests').insertOne(guest, { session });
        await database.collection('accounts').insertOne({ guestId, salt, digest }, { session });
      });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: 'Email already registered.' });
      throw error;
    } finally {
      await session.endSession();
    }
    const user = cleanPerson({ ...guest, role: 'Guest' });
    res.status(201).json({
      token: createAccessToken({ role: 'Guest', guestId }, tokenSecret),
      user,
      guest,
    });
  } catch (error) {
    console.error('Error in registration:', error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
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
    const { db: database, client } = await connectToDatabase();
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
    const { db: database, client } = await connectToDatabase();
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
    const { db: database, client } = await connectToDatabase();
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
    const { db: database, client } = await connectToDatabase();
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
  try {
    const result = await loadAvailableRooms({
      type: req.query.type,
      guests: req.query.guests,
      checkIn: req.query.checkIn,
      checkOut: req.query.checkOut,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result.rooms);
  } catch (error) {
    console.error('Error loading rooms:', error);
    res.status(500).json({ error: 'Failed to load rooms', message: error.message });
  }
});

app.get('/api/rooms/:id', async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const room = await database.collection('rooms').findOne({ id: req.params.id });
  if (!room || room.status === 'Inactive')
    return res.status(404).json({ error: 'Room not found.' });
  res.json(safeRoom(room));
});

app.post('/api/rooms', authenticate, allowRoles('Admin'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const invalid = validateRoom(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const room = {
    ...req.body,
    id: `R-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
    number: req.body.number.trim(),
    price: Number(req.body.price),
    capacity: Number(req.body.capacity),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    await database.collection('rooms').insertOne(room);
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ error: 'That room number already exists.' });
    throw error;
  }
  res.status(201).json(safeRoom(room));
});

app.put('/api/rooms/:id', authenticate, allowRoles('Admin'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const invalid = validateRoom(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const room = await database.collection('rooms').findOne({ id: req.params.id });
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  const activeFilter = {
    roomId: room.id,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
    checkOut: { $gt: hotelToday() },
  };
  const active =
    req.body.status === 'Maintenance' || req.body.status === 'Inactive'
      ? await database.collection('reservations').findOne(activeFilter)
      : await database.collection('reservations').findOne({
          ...activeFilter,
          guests: { $gt: Number(req.body.capacity) },
        });
  if ((req.body.status === 'Maintenance' || req.body.status === 'Inactive') && active) {
    return res.status(409).json({ error: 'Reassign or cancel active reservations first.' });
  }
  if (req.body.status !== 'Maintenance' && req.body.status !== 'Inactive' && active) {
    return res
      .status(409)
      .json({ error: 'Room capacity cannot be lower than an active reservation.' });
  }
  const updated = {
    ...req.body,
    id: room.id,
    number: req.body.number.trim(),
    price: Number(req.body.price),
    capacity: Number(req.body.capacity),
    createdAt: room.createdAt,
    updatedAt: new Date().toISOString(),
  };
  try {
    await database.collection('rooms').replaceOne({ id: room.id }, updated);
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ error: 'That room number already exists.' });
    throw error;
  }
  res.json(safeRoom(updated));
});

app.patch('/api/rooms/:id/status', authenticate, allowRoles('Admin'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const { status } = req.body;
  if (!['Available', 'Maintenance', 'Inactive'].includes(status)) {
    return res.status(400).json({ error: 'Choose a valid room status.' });
  }
  const room = await database.collection('rooms').findOne({ id: req.params.id });
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (status === 'Maintenance' || status === 'Inactive') {
    const active = await database.collection('reservations').findOne({
      roomId: room.id,
      status: { $in: ACTIVE_RESERVATION_STATUSES },
      checkOut: { $gt: hotelToday() },
    });
    if (active)
      return res.status(409).json({ error: 'Reassign or cancel active reservations first.' });
  }
  const updated = { ...room, status, updatedAt: new Date().toISOString() };
  await database
    .collection('rooms')
    .updateOne({ id: room.id }, { $set: { status, updatedAt: updated.updatedAt } });
  res.json(safeRoom(updated));
});

app.delete('/api/rooms/:id', authenticate, allowRoles('Admin'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const room = await database.collection('rooms').findOne({ id: req.params.id });
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  const reservationCount = await database.collection('reservations').countDocuments({
    roomId: room.id,
  });
  if (reservationCount > 0) {
    return res.status(409).json({
      error: 'Rooms with reservation history cannot be deleted. Set the room to Inactive instead.',
    });
  }
  await database.collection('rooms').deleteOne({ id: room.id });
  res.json({ message: 'Room deleted successfully.' });
});

app.get('/api/reservations', authenticate, async (req, res) => {
  try {
    const { db: database, client } = await connectToDatabase();
    const filter = req.auth.guestId ? { guestId: req.auth.guestId } : {};
    const reservations = await database
      .collection('reservations')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    res.json(reservations.map(safeReservation));
  } catch (error) {
    console.error('Error loading reservations:', error);
    res.status(500).json({ error: 'Failed to load reservations', message: error.message });
  }
});

app.post('/api/reservations', authenticate, async (req, res) => {
  const { db: database, client } = await connectToDatabase();
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
  const session = client.startSession();
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
  const { db: database, client } = await connectToDatabase();
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
  const { db: database, client } = await connectToDatabase();
  const collection = req.auth.guestId ? 'guests' : 'staff';
  const filter = req.auth.guestId ? { id: req.auth.guestId } : { id: req.auth.staffId };
  const profile = await database
    .collection(collection)
    .findOne(filter, { projection: { _id: 0, salt: 0, digest: 0, password: 0 } });
  if (!profile) return res.status(404).json({ error: 'Profile not found.' });
  res.json(profile);
});

app.patch('/api/profile', authenticate, async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const updates = {};
  if (req.auth.guestId) {
    const { firstName, lastName, address, passport } = req.body;
    if (firstName !== undefined) {
      if (typeof firstName !== 'string' || !/^[a-zA-Z\s\-']{2,50}$/.test(firstName.trim())) {
        return res.status(400).json({ error: 'Enter a valid first name.' });
      }
      updates.firstName = firstName.trim();
    }
    if (lastName !== undefined) {
      if (typeof lastName !== 'string' || !/^[a-zA-Z\s\-']{2,50}$/.test(lastName.trim())) {
        return res.status(400).json({ error: 'Enter a valid last name.' });
      }
      updates.lastName = lastName.trim();
    }
    if (address !== undefined) {
      if (
        typeof address !== 'string' ||
        address.length < 10 ||
        address.length > 200 ||
        !/^[a-zA-Z0-9\s#\-']+$/.test(address)
      ) {
        return res.status(400).json({ error: 'Enter a valid address.' });
      }
      updates.address = address;
    }
    if (passport !== undefined) {
      if (typeof passport !== 'string' || !/^[a-zA-Z0-9\-]{5,20}$/.test(passport)) {
        return res.status(400).json({ error: 'Enter a valid ID or passport number.' });
      }
      // Check if passport is already taken by another guest
      const existingPassport = await database.collection('guests').findOne({
        passport,
        id: { $ne: req.auth.guestId },
      });
      if (existingPassport) {
        return res.status(409).json({ error: 'This passport number is already registered.' });
      }
      updates.passport = passport;
    }
    if (req.body.email !== undefined) {
      return res.status(400).json({ error: 'Email changes require verified account recovery.' });
    }
  }
  if (typeof req.body.phone === 'string') {
    const digits = req.body.phone.replace(/\D/g, '');
    const phoneDigits = digits.startsWith('639') ? digits.slice(3) : digits;
    if (phoneDigits.length !== 9) {
      return res.status(400).json({ error: 'Phone number must contain exactly 9 digits.' });
    }
    const newPhone = `+63 9${phoneDigits}`;
    // Check if phone is already taken by another user (check both guests and staff)
    const currentId = req.auth.guestId || req.auth.staffId;
    const [existingGuestPhone, existingStaffPhone] = await Promise.all([
      database.collection('guests').findOne({ phone: newPhone, id: { $ne: currentId } }),
      database.collection('staff').findOne({ phone: newPhone, id: { $ne: currentId } }),
    ]);
    if (existingGuestPhone || existingStaffPhone) {
      return res.status(409).json({ error: 'Phone number already registered.' });
    }
    updates.phone = newPhone;
  }
  if (typeof req.body.twoFactorEnabled === 'boolean') {
    updates.twoFactorEnabled = req.body.twoFactorEnabled;
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid profile changes were provided.' });
  }
  const collection = req.auth.guestId ? 'guests' : 'staff';
  const filter = req.auth.guestId ? { id: req.auth.guestId } : { id: req.auth.staffId };
  await database.collection(collection).updateOne(filter, { $set: updates });
  if (req.auth.guestId) {
    const guest = await database.collection('guests').findOne(filter, { projection: { _id: 0 } });
    return res.json({
      message: 'Profile updated successfully.',
      ...cleanPerson({ ...guest, role: 'Guest' }).profile,
      twoFactorEnabled: guest.twoFactorEnabled === true,
    });
  }
  res.json({ message: 'Profile updated successfully.', ...updates });
});

// Payments endpoints
app.get('/api/payments', authenticate, async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  let filter = {};
  if (req.auth.guestId) {
    const ownedReservations = await database
      .collection('reservations')
      .find({ guestId: req.auth.guestId }, { projection: { id: 1 } })
      .toArray();
    filter = { bookingId: { $in: ownedReservations.map((booking) => booking.id) } };
  }
  const payments = await database
    .collection('payments')
    .find(filter)
    .project({ _id: 0 })
    .sort({ date: -1 })
    .toArray();
  res.json(payments);
});

app.post('/api/payments', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const bookingId = req.body.bookingId;
  const amount = Number(req.body.amount);
  const method = typeof req.body.method === 'string' ? req.body.method.trim() : '';
  if (
    typeof bookingId !== 'string' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.round(amount * 100) !== amount * 100 ||
    !method ||
    method.length > 50 ||
    method === 'Other'
  ) {
    return res
      .status(400)
      .json({ error: 'Provide a valid reservation, payment amount, and method.' });
  }
  const session = client.startSession();
  const payment = {
    id: `PAY-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
    bookingId,
    amount: Math.round(amount * 100) / 100,
    method,
    date: hotelToday(),
  };
  try {
    await session.withTransaction(async () => {
      const booking = await database.collection('reservations').findOne({ id: bookingId }, { session });
      if (!booking) throw requestError(404, 'Reservation not found.');
      if (['Cancelled', 'Checked-out'].includes(booking.status)) {
        throw requestError(409, 'Payments cannot be recorded for this reservation.');
      }
      await database
        .collection('reservations')
        .updateOne({ id: bookingId }, { $inc: { paymentVersion: 1 } }, { session });
      const existing = await database.collection('payments').find({ bookingId }, { session }).toArray();
      const paid = existing.reduce((sum, record) => sum + Number(record.amount), 0);
      const balance = Math.round((stayTotal(booking) - paid) * 100) / 100;
      if (amount > balance) throw requestError(409, 'Payment exceeds the remaining balance.');
      await database.collection('payments').insertOne(payment, { session });
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  } finally {
    await session.endSession();
  }
  res.status(201).json(payment);
});

// Guests endpoints
function validateGuestProfile(guest) {
  if (
    !guest ||
    typeof guest.firstName !== 'string' ||
    !/^[a-zA-Z\s\-']{2,50}$/.test(guest.firstName.trim()) ||
    typeof guest.lastName !== 'string' ||
    !/^[a-zA-Z\s\-']{2,50}$/.test(guest.lastName.trim()) ||
    typeof guest.email !== 'string' ||
    guest.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim()) ||
    typeof guest.phone !== 'string' ||
    !/^\+63\s9\d{9}$/.test(guest.phone) ||
    typeof guest.address !== 'string' ||
    guest.address.length < 10 ||
    guest.address.length > 200 ||
    !/^[a-zA-Z0-9\s#\-']+$/.test(guest.address) ||
    typeof guest.passport !== 'string' ||
    !/^[a-zA-Z0-9\-]{5,20}$/.test(guest.passport)
  ) {
    return 'Please provide valid guest details.';
  }
  return null;
}

app.get('/api/guests', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const guests = await database.collection('guests').find({}).project({ _id: 0 }).toArray();
  res.json(guests);
});

app.get('/api/guests/:id', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const guest = await database
    .collection('guests')
    .findOne({ id: req.params.id }, { projection: { _id: 0 } });
  if (!guest) return res.status(404).json({ error: 'Guest not found.' });
  res.json(guest);
});

app.post('/api/guests', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const guest = req.body;
  const error = validateGuestProfile(guest);
  if (error) return res.status(400).json({ error });
  const email = guest.email.trim().toLowerCase();
  const [existingGuest, existingStaff] = await Promise.all([
    database.collection('guests').findOne({ email }),
    database.collection('staff').findOne({ email }),
  ]);
  if (existingGuest || existingStaff) {
    return res.status(409).json({ error: 'Email already registered.' });
  }
  const saved = {
    id: `G-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
    firstName: guest.firstName.trim(),
    lastName: guest.lastName.trim(),
    email,
    phone: guest.phone,
    address: guest.address,
    passport: guest.passport,
    twoFactorEnabled: false,
  };
  await database.collection('guests').insertOne(saved);
  res.status(201).json(saved);
});

app.put('/api/guests/:id', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const error = validateGuestProfile(req.body);
  if (error) return res.status(400).json({ error });
  const { id } = req.params;
  const email = req.body.email.trim().toLowerCase();
  const [duplicateGuest, duplicateStaff] = await Promise.all([
    database.collection('guests').findOne({ id: { $ne: id }, email }),
    database.collection('staff').findOne({ email }),
  ]);
  if (duplicateGuest || duplicateStaff) {
    return res.status(409).json({ error: 'Email already registered.' });
  }
  const updates = {
    firstName: req.body.firstName.trim(),
    lastName: req.body.lastName.trim(),
    email,
    phone: req.body.phone,
    address: req.body.address,
    passport: req.body.passport,
  };
  const result = await database.collection('guests').updateOne({ id }, { $set: updates });
  if (result.matchedCount === 0) return res.status(404).json({ error: 'Guest not found.' });
  res.json({ id, ...updates });
});

app.delete('/api/guests/:id', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const { id } = req.params;
  const reservationCount = await database.collection('reservations').countDocuments({ guestId: id });
  if (reservationCount > 0) {
    return res.status(409).json({ error: 'Guests with reservation history cannot be deleted.' });
  }
  const result = await database.collection('guests').deleteOne({ id });
  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Guest not found.' });
  }
  await database.collection('accounts').deleteOne({ guestId: id });
  res.json({ message: 'Guest deleted successfully' });
});

// Staff endpoints
function generateTempPassword() {
  return crypto.randomBytes(18).toString('base64url');
}

app.get('/api/staff', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const staff = await database
    .collection('staff')
    .find({})
    .project({ _id: 0, salt: 0, digest: 0, password: 0 })
    .toArray();
  res.json(staff);
});

app.post('/api/staff', authenticate, allowRoles('Admin'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const staff = req.body;
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
  const phoneDigits = digits.startsWith('639') ? digits.slice(3) : digits;
  if (phoneDigits.length < 9) {
    return res.status(400).json({ error: 'Phone number must be at least 9 digits' });
  }
  if (phoneDigits.length > 9) {
    return res.status(400).json({ error: 'Phone number must be at most 9 digits' });
  }

  const email = staff.email.trim().toLowerCase();
  const [existingGuest, existingStaff] = await Promise.all([
    database.collection('guests').findOne({ email }),
    database.collection('staff').findOne({ email }),
  ]);
  if (existingGuest || existingStaff) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const tempPassword = generateTempPassword();
  const salt = generateSalt();
  const digest = await hashPassword(tempPassword, salt);

  staff.salt = salt;
  staff.digest = digest;
  if (staff.twoFactorEnabled === undefined) {
    staff.twoFactorEnabled = false;
  }

  await database.collection('staff').insertOne(staff);

  try {
    await sendStaffCredentialsEmail(staff, tempPassword);
  } catch (emailError) {
    console.error('Failed to send email, but staff was created:', emailError);
  }

  res.status(201).json({
    message: 'Staff account created successfully',
    staffId: staff.id,
  });
});

app.put('/api/staff/:id', authenticate, allowRoles('Admin'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const { id } = req.params;
  const staff = req.body;

  const existingStaff = await database.collection('staff').findOne({
    email: staff.email.trim().toLowerCase(),
    id: { $ne: id },
  });
  const existingGuest = await database.collection('guests').findOne({
    email: staff.email.trim().toLowerCase(),
  });

  if (existingStaff || existingGuest) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const { _id, salt, digest, password, ...updateFields } = staff;

  if (staff.password) {
    const newSalt = generateSalt();
    const newDigest = await hashPassword(staff.password, newSalt);
    updateFields.salt = newSalt;
    updateFields.digest = newDigest;
  }

  const result = await database.collection('staff').updateOne({ id }, { $set: updateFields });

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  res.json({ message: 'Staff account updated successfully' });
});

app.delete('/api/staff/:id', authenticate, allowRoles('Admin'), async (req, res) => {
  const { db: database, client } = await connectToDatabase();
  const { id } = req.params;

  const staff = await database.collection('staff').findOne({ id });
  if (staff && staff.role === 'Admin') {
    return res.status(403).json({ error: 'Cannot delete admin accounts' });
  }

  const result = await database.collection('staff').deleteOne({ id });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Staff member not found' });
  }

  res.json({ message: 'Staff account deleted successfully' });
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
