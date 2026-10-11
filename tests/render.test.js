import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { day, initialRooms } from '../src/data.js';

let server;
let App;
let ModalContent;
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, value),
};
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  App = (await server.ssrLoadModule('/src/App.jsx')).default;
  ModalContent = (await server.ssrLoadModule('/src/components/modals/ModalContent.jsx')).default;
});
after(async () => {
  await server?.close();
  delete globalThis.localStorage;
});

const admin = { role: 'Admin', name: 'Alex Morgan', staffId: 'ST-001', token: 'test-token' };
const frontDesk = {
  role: 'Front Desk',
  name: 'Maria Cruz',
  staffId: 'ST-002',
  token: 'test-token',
};
const guest = { role: 'Guest', name: 'Isabella Reyes', guestId: 'G-001', token: 'test-token' };
function render(path, session = null) {
  storage.clear();
  storage.set('ah-session-v2', JSON.stringify(session));
  return renderToString(
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App)),
  );
}

test('all public hotel and authentication screens render independently', () => {
  for (const [path, label] of [
    ['/', 'Some places'],
    ['/stay', 'A room for your kind of stay'],
    ['/stay/suite', 'The Aureline Suite'],
    ['/experiences', 'Make room for the good things'],
    ['/contact', 'Plan your Aureline stay'],
    ['/login', 'Good to see you again'],
    ['/signup', 'Your stay starts here'],
    ['/search', 'Find your kind of quiet'],
  ]) {
    const html = render(path);
    assert.ok(html.includes(label), `Missing screen content on ${path}`);
    assert.ok(!html.includes('Aureline House'));
  }
});
test('management screens survive the component extraction', () => {
  for (const path of [
    '/dashboard',
    '/reservations',
    '/rooms',
    '/guests',
    '/billing',
    '/team',
    '/profile',
    '/search',
  ]) {
    const html = render(path, admin);
    assert.ok(html.includes('Workspace'), `Missing workspace on ${path}`);
    assert.ok(html.includes('Alex Morgan'));
  }
});
test('guest screen renders an empty state before server reservations load', () => {
  const html = render('/my-stays', guest);
  assert.ok(html.includes('Your next story is waiting.'));
  assert.ok(!html.includes('Team management'));
});
test('front desk navigation does not expose admin-only team management', () => {
  const html = render('/dashboard', frontDesk);
  assert.ok(html.includes('Maria Cruz'));
  assert.ok(!html.includes('Team management'));
});
test('booking search restores its URL state before server availability results load', () => {
  const html = render(`/search?start=${day(5)}&end=${day(7)}&guests=2&type=Suite`);
  assert.match(html, /2(?:<!-- -->)?-night stay/);
  assert.match(html, /0(?:<!-- -->)? rooms/);
  assert.ok(!html.includes('The Quiet Single'));
});
test('separated detail dialogs and CRUD forms render with their dependencies', () => {
  const room = initialRooms[0];
  const guestRecord = {
    id: 'G-001',
    firstName: 'Isabella',
    lastName: 'Reyes',
    email: 'isabella@example.com',
    phone: '+63 9123456789',
    address: 'Sorsogon City',
    passport: 'AB12345',
  };
  const booking = {
    id: 'AH-2041',
    guestId: guestRecord.id,
    roomId: room.id,
    checkIn: day(8),
    checkOut: day(10),
    guests: 1,
    rate: room.price,
    status: 'Pending',
    createdAt: day(),
  };
  const hotel = {
    rooms: [room],
    guests: [guestRecord],
    staff: [
      {
        id: 'ST-001',
        name: 'Alex Morgan',
        email: 'alex@example.com',
        role: 'Admin',
        status: 'Active',
      },
      {
        id: 'ST-002',
        name: 'Maria Cruz',
        email: 'maria@example.com',
        role: 'Front Desk',
        status: 'Active',
      },
    ],
    bookings: [booking],
    payments: [],
    role: 'Admin',
    isGuest: false,
    session: admin,
    guest: (id) => [guestRecord].find((record) => record.id === id),
    room: (id) => [room].find((record) => record.id === id),
    total: (item) => item.rate * 2,
    paid: () => 0,
    paymentStatus: () => 'Unpaid',
    roomStatus: () => 'Available',
    available: () => true,
    setModal: () => {},
    setRooms: () => {},
    setBookings: () => {},
    setPayments: () => {},
    setGuests: () => {},
    setStaff: () => {},
    notify: () => {},
    navigate: () => {},
    updateStatus: () => {},
    reloadStaff: async () => {},
  };
  for (const type of [
    'room',
    'guest',
    'booking',
    'cancel',
    'roomForm',
    'guestForm',
    'staffForm',
    'reserve',
    'editBooking',
    'payment',
  ]) {
    const item =
      type.startsWith('room') || type === 'reserve'
        ? room
        : type.startsWith('guest')
          ? guestRecord
          : type === 'staffForm'
            ? hotel.staff[1]
            : booking;
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ModalContent, {
          ...hotel,
          onClose: () => {},
          modal: { type, item, query: { start: day(8), end: day(10), count: 1 } },
        }),
      ),
    );
    assert.ok(html.includes('role="dialog"'), `Dialog failed: ${type}`);
    if (type === 'room') {
      assert.ok(html.includes('Delete room'));
      assert.ok(!html.includes('Archive room'));
      assert.ok(html.includes('Fresh linens'));
    }
  }
  const suiteForm = renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ModalContent, {
        ...hotel,
        onClose: () => {},
        modal: { type: 'roomForm', item: { ...room, type: 'Suite' } },
      }),
    ),
  );
  assert.ok(suiteForm.includes('Separate living area'));
  assert.ok(suiteForm.includes('Welcome refreshments'));
  assert.ok(!suiteForm.includes('Dedicated workspace'));
});
