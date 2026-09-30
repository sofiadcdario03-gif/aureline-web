import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { day } from '../src/data.js';

let server;
let App;
let HotelProvider;
let useHotel;
let ModalContent;
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, value),
};
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  App = (await server.ssrLoadModule('/src/App.jsx')).default;
  ({ HotelProvider, useHotel } = await server.ssrLoadModule('/src/context/HotelContext.jsx'));
  ModalContent = (await server.ssrLoadModule('/src/components/modals/ModalContent.jsx')).default;
});
after(async () => {
  await server?.close();
  delete globalThis.localStorage;
});

const admin = { role: 'Admin', name: 'Alex Morgan', staffId: 'ST-001' };
const frontDesk = { role: 'Front Desk', name: 'Maria Cruz', staffId: 'ST-002' };
const guest = { role: 'Guest', name: 'Isabella Reyes', guestId: 'G-001' };
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
test('guest screen only renders the signed-in guest’s reservations', () => {
  const html = render('/my-stays', guest);
  assert.ok(html.includes('AH-2041'));
  assert.ok(html.includes('AH-2034'));
  assert.ok(!html.includes('AH-2040'));
  assert.ok(!html.includes('Team management'));
});
test('front desk navigation does not expose admin-only team management', () => {
  const html = render('/dashboard', frontDesk);
  assert.ok(html.includes('Maria Cruz'));
  assert.ok(!html.includes('Team management'));
});
test('booking search restores its URL state and shows available choices', () => {
  const html = render(`/search?start=${day(5)}&end=${day(7)}&guests=2&type=Suite`);
  assert.ok(html.includes('for your'));
  assert.ok(html.includes('The Aureline Suite'));
  assert.ok(!html.includes('The Quiet Single'));
});
test('separated detail dialogs and CRUD forms render with their dependencies', () => {
  storage.clear();
  storage.set('ah-session-v2', JSON.stringify(admin));
  function Harness({ type }) {
    const hotel = useHotel();
    const item =
      type.startsWith('room') || type === 'reserve'
        ? hotel.rooms[0]
        : type.startsWith('guest')
          ? hotel.guests[0]
          : type === 'staffForm'
            ? hotel.staff[1]
            : hotel.bookings[0];
    return React.createElement(ModalContent, {
      ...hotel,
      onClose: () => {},
      modal: { type, item, query: { start: day(8), end: day(10), count: 1 } },
    });
  }
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
    const html = renderToString(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(HotelProvider, null, React.createElement(Harness, { type })),
      ),
    );
    assert.ok(html.includes('role="dialog"'), `Dialog failed: ${type}`);
  }
});
