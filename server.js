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
} from './server/security.js';

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

// MongoDB Connection
const uri = process.env.MONGO_URI;
if (!uri) throw new Error('MONGO_URI must be configured before starting the server.');
const client = new MongoClient(uri);
let db;

async function connectToDatabase() {
  await client.connect();
  db = client.db(process.env.MONGODB_DB_NAME || 'hotel-management');
  await Promise.all([
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
  ]);
  console.log('Connected to MongoDB Atlas');
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

  const person = identity.guestId
    ? await db.collection('guests').findOne({ id: identity.guestId }, { projection: { _id: 0 } })
    : await db
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
  const filter = { status: { $ne: 'Inactive' } };
  if (query.type && ['Single', 'Double', 'Deluxe', 'Suite'].includes(query.type)) {
    filter.type = query.type;
  }
  const capacity = Number(query.guests);
  if (Number.isInteger(capacity) && capacity > 0) filter.capacity = { $gte: capacity };
  let rooms = await db.collection('rooms').find(filter).toArray();
  if (query.checkIn || query.checkOut) {
    if (!validStayDates(query.checkIn, query.checkOut) || query.checkIn < hotelToday()) {
      return { error: 'Choose valid future dates with check-out after check-in.' };
    }
    const roomIds = rooms.map((room) => room.id);
    const conflicts = await db
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
  if (room.status !== 'Available') return false;
  return !(await db.collection('reservations').findOne(
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

// Verify email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
    console.log(
      'Email sending will be disabled. Check your EMAIL_USER and EMAIL_PASS in .env file.',
    );
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
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body.password;
  if (!email || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const [guest, staff] = await Promise.all([
    db.collection('guests').findOne({ email }),
    db.collection('staff').findOne({ email }),
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
    const credential = await db.collection('accounts').findOne({ guestId: guest.id });
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
      await db
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
    loginChallenges.set(email, { identity, user, expiresAt: Date.now() + 5 * 60 * 1000 });
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
  const collection = req.auth.guestId ? 'guests' : 'staff';
  const filter = req.auth.guestId ? { id: req.auth.guestId } : { id: req.auth.staffId };
  const profile = await db
    .collection(collection)
    .findOne(filter, { projection: { _id: 0, salt: 0, digest: 0, password: 0 } });
  if (!profile) return res.status(404).json({ error: 'Profile not found.' });
  res.json(profile);
});

app.post('/api/auth/register', async (req, res) => {
  const profile = req.body.profile;
  const password = req.body.password;
  const ticket = verifiedRegistrationTickets.get(req.body.verificationToken);
  if (!ticket || ticket.expiresAt <= Date.now()) {
    verifiedRegistrationTickets.delete(req.body.verificationToken);
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
    !/^[a-zA-Z0-9]{5,20}$/.test(profile.passport)
  ) {
    return res.status(400).json({ error: 'Please provide valid guest profile details.' });
  }

  verifiedRegistrationTickets.delete(req.body.verificationToken);
  if (await db.collection('staff').findOne({ email })) {
    return res.status(409).json({ error: 'Email already registered.' });
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
      await db.collection('guests').insertOne(guest, { session });
      await db.collection('accounts').insertOne({ guestId, salt, digest }, { session });
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
});

app.put('/api/auth/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
  }
  const collection = req.auth.guestId ? 'accounts' : 'staff';
  const filter = req.auth.guestId ? { guestId: req.auth.guestId } : { id: req.auth.staffId };
  const account = await db.collection(collection).findOne(filter);
  if (!account || !verifyPassword(currentPassword, account.salt, account.digest)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const salt = generateSalt();
  const digest = await hashPassword(newPassword, salt);
  await db.collection(collection).updateOne(filter, { $set: { salt, digest } });
  res.json({ message: 'Password updated successfully.' });
});

app.post('/api/auth/verify-password', authenticate, async (req, res) => {
  const currentPassword = req.body.currentPassword;
  const isGuest = Boolean(req.auth.guestId);
  const account = isGuest
    ? await db.collection('accounts').findOne({ guestId: req.auth.guestId })
    : await db.collection('staff').findOne({ id: req.auth.staffId });
  if (!account || !verifyPassword(currentPassword, account.salt, account.digest)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  res.json({ verified: true });
});

app.patch('/api/profile', authenticate, async (req, res) => {
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
      if (typeof passport !== 'string' || !/^[a-zA-Z0-9]{5,20}$/.test(passport)) {
        return res.status(400).json({ error: 'Enter a valid ID or passport number.' });
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
    updates.phone = `+63 9${phoneDigits}`;
  }
  if (typeof req.body.twoFactorEnabled === 'boolean') {
    updates.twoFactorEnabled = req.body.twoFactorEnabled;
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid profile changes were provided.' });
  }
  const collection = req.auth.guestId ? 'guests' : 'staff';
  const filter = req.auth.guestId ? { id: req.auth.guestId } : { id: req.auth.staffId };
  await db.collection(collection).updateOne(filter, { $set: updates });
  if (req.auth.guestId) {
    const guest = await db.collection('guests').findOne(filter, { projection: { _id: 0 } });
    return res.json({
      message: 'Profile updated successfully.',
      ...cleanPerson({ ...guest, role: 'Guest' }).profile,
      twoFactorEnabled: guest.twoFactorEnabled === true,
    });
  }
  res.json({ message: 'Profile updated successfully.', ...updates });
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
  const room = await db.collection('rooms').findOne({ id: req.params.id });
  if (!room || room.status === 'Inactive')
    return res.status(404).json({ error: 'Room not found.' });
  res.json(safeRoom(room));
});

app.post('/api/rooms', authenticate, allowRoles('Admin'), async (req, res) => {
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
    await db.collection('rooms').insertOne(room);
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ error: 'That room number already exists.' });
    throw error;
  }
  res.status(201).json(safeRoom(room));
});

app.put('/api/rooms/:id', authenticate, allowRoles('Admin'), async (req, res) => {
  const invalid = validateRoom(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const room = await db.collection('rooms').findOne({ id: req.params.id });
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  const activeFilter = {
    roomId: room.id,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
    checkOut: { $gt: hotelToday() },
  };
  const active =
    req.body.status === 'Maintenance' || req.body.status === 'Inactive'
      ? await db.collection('reservations').findOne(activeFilter)
      : await db.collection('reservations').findOne({
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
    await db.collection('rooms').replaceOne({ id: room.id }, updated);
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ error: 'That room number already exists.' });
    throw error;
  }
  res.json(safeRoom(updated));
});

app.patch('/api/rooms/:id/status', authenticate, allowRoles('Admin'), async (req, res) => {
  const { status } = req.body;
  if (!['Available', 'Maintenance', 'Inactive'].includes(status)) {
    return res.status(400).json({ error: 'Choose a valid room status.' });
  }
  const room = await db.collection('rooms').findOne({ id: req.params.id });
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (status === 'Maintenance' || status === 'Inactive') {
    const active = await db.collection('reservations').findOne({
      roomId: room.id,
      status: { $in: ACTIVE_RESERVATION_STATUSES },
      checkOut: { $gt: hotelToday() },
    });
    if (active)
      return res.status(409).json({ error: 'Reassign or cancel active reservations first.' });
  }
  const updated = { ...room, status, updatedAt: new Date().toISOString() };
  await db
    .collection('rooms')
    .updateOne({ id: room.id }, { $set: { status, updatedAt: updated.updatedAt } });
  res.json(safeRoom(updated));
});

app.delete('/api/rooms/:id', authenticate, allowRoles('Admin'), async (req, res) => {
  const room = await db.collection('rooms').findOne({ id: req.params.id });
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  const reservationCount = await db.collection('reservations').countDocuments({
    roomId: room.id,
  });
  if (reservationCount > 0) {
    return res.status(409).json({
      error: 'Rooms with reservation history cannot be deleted. Set the room to Inactive instead.',
    });
  }
  await db.collection('rooms').deleteOne({ id: room.id });
  res.json({ message: 'Room deleted successfully.' });
});

app.get('/api/reservations', authenticate, async (req, res) => {
  const filter = req.auth.guestId ? { guestId: req.auth.guestId } : {};
  const reservations = await db
    .collection('reservations')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  res.json(reservations.map(safeReservation));
});

app.get('/api/payments', authenticate, async (req, res) => {
  let filter = {};
  if (req.auth.guestId) {
    const ownedReservations = await db
      .collection('reservations')
      .find({ guestId: req.auth.guestId }, { projection: { id: 1 } })
      .toArray();
    filter = { bookingId: { $in: ownedReservations.map((booking) => booking.id) } };
  }
  const payments = await db
    .collection('payments')
    .find(filter)
    .project({ _id: 0 })
    .sort({ date: -1 })
    .toArray();
  res.json(payments);
});

app.post('/api/payments', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
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
      const booking = await db.collection('reservations').findOne({ id: bookingId }, { session });
      if (!booking) throw requestError(404, 'Reservation not found.');
      if (['Cancelled', 'Checked-out'].includes(booking.status)) {
        throw requestError(409, 'Payments cannot be recorded for this reservation.');
      }
      await db
        .collection('reservations')
        .updateOne({ id: bookingId }, { $inc: { paymentVersion: 1 } }, { session });
      const existing = await db.collection('payments').find({ bookingId }, { session }).toArray();
      const paid = existing.reduce((sum, record) => sum + Number(record.amount), 0);
      const balance = Math.round((stayTotal(booking) - paid) * 100) / 100;
      if (amount > balance) throw requestError(409, 'Payment exceeds the remaining balance.');
      await db.collection('payments').insertOne(payment, { session });
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  } finally {
    await session.endSession();
  }
  res.status(201).json(payment);
});

app.post('/api/reservations', authenticate, async (req, res) => {
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
  const guest = await db.collection('guests').findOne({ id: guestId }, { projection: { _id: 0 } });
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
      const room = await db.collection('rooms').findOne({ id: roomId }, { session });
      if (!room || room.status === 'Inactive') throw requestError(404, 'Room not found.');
      if (room.status !== 'Available') throw requestError(409, 'This room is not available.');
      if (room.capacity < guests)
        throw requestError(400, 'This room does not have enough capacity.');
      const claim = await db
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
      await db.collection('reservations').insertOne(reservation, { session });
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  } finally {
    await session.endSession();
  }
  res.status(201).json(safeReservation(reservation));
});

app.put('/api/reservations/:id', authenticate, async (req, res) => {
  const existing = await db.collection('reservations').findOne({ id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Reservation not found.' });
  if (req.auth.role === 'Guest' || !['Admin', 'Front Desk'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'You are not allowed to edit this reservation.' });
  }
  if (!['Pending', 'Confirmed'].includes(existing.status)) {
    return res.status(409).json({ error: 'Only pending or confirmed reservations can be edited.' });
  }
  const { roomId, checkIn, checkOut } = req.body;
  const guests = Number(req.body.guests);
  if (!roomId || !validStayDates(checkIn, checkOut) || checkIn < hotelToday()) {
    return res.status(400).json({ error: 'Choose valid future check-in/check-out dates.' });
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > 20) {
    return res.status(400).json({ error: 'Guest count must be between 1 and 20.' });
  }
  const session = client.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const room = await db.collection('rooms').findOne({ id: roomId }, { session });
      if (!room || room.status !== 'Available')
        throw requestError(409, 'Choose an available room.');
      if (room.capacity < guests)
        throw requestError(400, 'This room does not have enough capacity.');
      const claim = await db
        .collection('rooms')
        .updateOne(
          { id: roomId, status: 'Available' },
          { $inc: { reservationVersion: 1 } },
          { session },
        );
      if (claim.modifiedCount !== 1) throw requestError(409, 'This room is no longer available.');
      if (!(await checkStayAvailability(room, checkIn, checkOut, session, existing.id))) {
        throw requestError(409, 'This room is no longer available for those dates.');
      }
      updated = {
        ...existing,
        roomId,
        checkIn,
        checkOut,
        guests,
        rate: room.id === existing.roomId ? existing.rate : room.price,
        updatedAt: new Date().toISOString(),
      };
      const paid = await db
        .collection('payments')
        .find({ bookingId: existing.id }, { session })
        .toArray();
      if (stayTotal(updated) < paid.reduce((sum, payment) => sum + Number(payment.amount), 0)) {
        throw requestError(409, 'The revised total is below the amount already paid.');
      }
      await db.collection('reservations').replaceOne({ id: existing.id }, updated, { session });
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  } finally {
    await session.endSession();
  }
  res.json(safeReservation(updated));
});

app.patch('/api/reservations/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  const booking = await db.collection('reservations').findOne({ id: req.params.id });
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
    const otherStay = await db.collection('reservations').findOne({
      id: { $ne: booking.id },
      roomId: booking.roomId,
      status: 'Checked-in',
    });
    if (otherStay) return res.status(409).json({ error: 'This room is already occupied.' });
  }
  if (status === 'Checked-out') {
    const payments = await db.collection('payments').find({ bookingId: booking.id }).toArray();
    const paid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (paid < stayTotal(booking)) {
      return res.status(409).json({ error: 'Settle the reservation balance before checkout.' });
    }
  }
  const updatedAt = new Date().toISOString();
  const update = await db
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

// Create guest account
app.post('/api/guests', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  try {
    const guest = req.body;
    const error = validateGuestProfile(guest);
    if (error) return res.status(400).json({ error });
    const email = guest.email.trim().toLowerCase();
    const [existingGuest, existingStaff] = await Promise.all([
      db.collection('guests').findOne({ email }),
      db.collection('staff').findOne({ email }),
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
    await db.collection('guests').insertOne(saved);
    res.status(201).json(saved);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Email already registered.' });
    throw error;
  }
});

// Get all guests
app.get('/api/guests', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  try {
    const guests = await db.collection('guests').find({}).project({ _id: 0 }).toArray();
    res.json(guests);
  } catch (error) {
    console.error('Error fetching guests:', error);
    res.status(500).json({ error: 'Failed to fetch guests' });
  }
});

// Get single guest by ID
app.get('/api/guests/:id', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  try {
    const guest = await db
      .collection('guests')
      .findOne({ id: req.params.id }, { projection: { _id: 0 } });
    if (!guest) return res.status(404).json({ error: 'Guest not found.' });
    res.json(guest);
  } catch (error) {
    console.error('Error fetching guest:', error);
    res.status(500).json({ error: 'Failed to fetch guest' });
  }
});

app.put('/api/guests/:id', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  const error = validateGuestProfile(req.body);
  if (error) return res.status(400).json({ error });
  const { id } = req.params;
  const email = req.body.email.trim().toLowerCase();
  const [duplicateGuest, duplicateStaff] = await Promise.all([
    db.collection('guests').findOne({ id: { $ne: id }, email }),
    db.collection('staff').findOne({ email }),
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
  const result = await db.collection('guests').updateOne({ id }, { $set: updates });
  if (result.matchedCount === 0) return res.status(404).json({ error: 'Guest not found.' });
  res.json({ id, ...updates });
});

// Delete guest account
app.delete('/api/guests/:id', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if guest has reservation history
    const reservationCount = await db.collection('reservations').countDocuments({ guestId: id });
    if (reservationCount > 0) {
      return res.status(409).json({ error: 'Guests with reservation history cannot be deleted.' });
    }

    const result = await db.collection('guests').deleteOne({ id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Guest not found.' });
    }

    // Also delete the associated account if it exists
    await db.collection('accounts').deleteOne({ guestId: id });

    res.json({ message: 'Guest deleted successfully' });
  } catch (error) {
    console.error('Error deleting guest:', error);
    res.status(500).json({ error: 'Failed to delete guest' });
  }
});

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
    !/^[a-zA-Z0-9]{5,20}$/.test(guest.passport)
  ) {
    return 'Please provide valid guest details.';
  }
  return null;
}

// Create staff account
app.post('/api/staff', authenticate, allowRoles('Admin'), async (req, res) => {
  try {
    const staff = req.body;

    // Server-side validation
    if (!staff.name || staff.name.length < 2 || staff.name.length > 50) {
      return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
    }
    if (!/^[a-zA-Z\-'\s]+$/.test(staff.name)) {
      return res
        .status(400)
        .json({ error: 'Name can only contain letters, hyphens, apostrophes, and spaces' });
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
    const email = staff.email.trim().toLowerCase();
    const [existingGuest, existingStaff] = await Promise.all([
      db.collection('guests').findOne({ email }),
      db.collection('staff').findOne({ email }),
    ]);
    if (existingGuest || existingStaff) {
      return res.status(409).json({ error: 'Email already registered' });
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
      staffId: result.insertedId,
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ error: 'Failed to create staff account' });
  }
});

// Helper functions for password generation and hashing
function generateTempPassword() {
  return crypto.randomBytes(18).toString('base64url');
}

// OTP storage (in-memory, expires after 5 minutes)
const otpStore = new Map();
const loginChallenges = new Map();
const verifiedRegistrationTickets = new Map();

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

function storeOTP(email, otp, purpose) {
  const expiresAt = Date.now() + 1 * 60 * 1000; // 1 minute (60 seconds)
  otpStore.set(email.toLowerCase(), { otp, purpose, expiresAt });
}

function verifyOTP(email, otp) {
  const stored = otpStore.get(email.toLowerCase());
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return false;
  }
  return stored.otp === otp ? stored : false;
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
app.get('/api/staff', authenticate, allowRoles('Admin', 'Front Desk'), async (req, res) => {
  try {
    const staff = await db
      .collection('staff')
      .find({})
      .project({ _id: 0, salt: 0, digest: 0, password: 0 })
      .toArray();
    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Update staff account
app.put('/api/staff/:id', authenticate, allowRoles('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const staff = req.body;

    // Check if email already exists for another staff member
    const existingStaff = await db.collection('staff').findOne({
      email: staff.email.trim().toLowerCase(),
      id: { $ne: id },
    });
    const existingGuest = await db.collection('guests').findOne({
      email: staff.email.trim().toLowerCase(),
    });

    if (existingStaff || existingGuest) {
      return res.status(409).json({ error: 'Email already registered' });
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
    const result = await db.collection('staff').updateOne({ id }, { $set: updateFields });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json({
      message: 'Staff account updated successfully',
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Failed to update staff account' });
  }
});

// Delete staff account
app.delete('/api/staff/:id', authenticate, allowRoles('Admin'), async (req, res) => {
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
      message: 'Staff account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: 'Failed to delete staff account' });
  }
});

// Generate reset token
function generateResetToken() {
  return crypto.randomBytes(32).toString('base64url');
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
      await db.collection('accounts').updateOne({ guestId: guest.id }, { $set: { salt, digest } });
    }

    // Update staff password if exists
    const staff = await db.collection('staff').findOne({ email });
    if (staff) {
      await db.collection('staff').updateOne({ email }, { $set: { salt, digest } });
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
    const normalizedEmail = email.toLowerCase();
    if (
      purpose === 'Login Verification' &&
      (!loginChallenges.has(normalizedEmail) ||
        loginChallenges.get(normalizedEmail).expiresAt <= Date.now())
    ) {
      loginChallenges.delete(normalizedEmail);
      return res
        .status(400)
        .json({ error: 'Sign in again before requesting a verification code.' });
    }

    const otp = generateOTP();
    storeOTP(normalizedEmail, otp, purpose);

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

    const verified = verifyOTP(email, otp);

    if (verified) {
      // Clear OTP after successful verification
      otpStore.delete(email.toLowerCase());
      if (verified.purpose === 'Login Verification') {
        const challenge = loginChallenges.get(email.toLowerCase());
        loginChallenges.delete(email.toLowerCase());
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
        verifiedRegistrationTickets.set(registrationToken, {
          email: email.toLowerCase(),
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
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

async function startServer() {
  await connectToDatabase();
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  client.close().catch((closeError) => console.error('MongoDB shutdown failed:', closeError));
  process.exitCode = 1;
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});
