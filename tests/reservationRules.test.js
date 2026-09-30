import test from 'node:test';
import assert from 'node:assert/strict';
import { isRoomAvailable, getRoomStatus } from '../src/reservationRules.js';
import { nights } from '../src/data.js';

const room = { id: 'R1', status: 'Available' };
const reservation = {
  id: 'B1',
  roomId: 'R1',
  status: 'Confirmed',
  checkIn: '2026-10-02',
  checkOut: '2026-10-05',
};

test('overlapping stays are blocked, including a range surrounding an existing stay', () => {
  for (const [start, end] of [
    ['2026-10-01', '2026-10-03'],
    ['2026-10-03', '2026-10-06'],
    ['2026-10-03', '2026-10-04'],
    ['2026-10-01', '2026-10-06'],
  ]) {
    assert.equal(isRoomAvailable(room, [reservation], start, end), false);
  }
});
test('adjacent stays may share a checkout/check-in date', () => {
  assert.equal(isRoomAvailable(room, [reservation], '2026-10-01', '2026-10-02'), true);
  assert.equal(isRoomAvailable(room, [reservation], '2026-10-05', '2026-10-07'), true);
});
test('cancellation releases inventory and editing can exclude its own reservation', () => {
  assert.equal(
    isRoomAvailable(room, [{ ...reservation, status: 'Cancelled' }], '2026-10-02', '2026-10-05'),
    true,
  );
  assert.equal(isRoomAvailable(room, [reservation], '2026-10-02', '2026-10-05', 'B1'), true);
  assert.equal(
    isRoomAvailable(room, [{ ...reservation, status: 'Pending' }], '2026-10-02', '2026-10-05'),
    false,
  );
});
test('maintenance and invalid date ranges cannot be booked', () => {
  assert.equal(
    isRoomAvailable({ ...room, status: 'Maintenance' }, [], '2026-10-02', '2026-10-05'),
    false,
  );
  assert.equal(isRoomAvailable(room, [], '2026-10-05', '2026-10-05'), false);
  assert.equal(isRoomAvailable(room, [], '2026-10-05', '2026-10-02'), false);
});
test('room state reflects dates and checkout releases occupied rooms', () => {
  assert.equal(getRoomStatus(room, [reservation], '2026-10-01'), 'Available');
  assert.equal(getRoomStatus(room, [reservation], '2026-10-03'), 'Reserved');
  assert.equal(
    getRoomStatus(room, [{ ...reservation, status: 'Checked-in' }], '2026-10-05'),
    'Occupied',
  );
  assert.equal(
    getRoomStatus(room, [{ ...reservation, status: 'Checked-out' }], '2026-10-05'),
    'Available',
  );
});
test('night count works across month and year boundaries', () => {
  assert.equal(nights('2026-09-30', '2026-10-03'), 3);
  assert.equal(nights('2026-12-31', '2027-01-02'), 2);
});
