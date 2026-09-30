import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccountCredential,
  signInAccount,
  destinationAfterLogin,
  ACCESS_PASSWORD,
} from '../src/services/authService.js';
import { initialGuests, initialStaff } from '../src/data.js';

const fixtures = { guests: initialGuests, staff: initialStaff, accounts: [] };
test('one email/password login resolves Admin, Front Desk, and Guest accounts', async () => {
  for (const [email, role] of [
    ['alex@aureline.hotel', 'Admin'],
    ['maria@aureline.hotel', 'Front Desk'],
    ['isabella.reyes@example.com', 'Guest'],
  ]) {
    const session = await signInAccount({ ...fixtures, email, password: ACCESS_PASSWORD });
    assert.equal(session.role, role);
    assert.ok(session.staffId || session.guestId);
  }
});
test('wrong passwords, unknown emails, and inactive staff cannot sign in', async () => {
  await assert.rejects(
    signInAccount({ ...fixtures, email: 'alex@aureline.hotel', password: 'wrong' }),
  );
  await assert.rejects(
    signInAccount({ ...fixtures, email: 'nobody@example.com', password: ACCESS_PASSWORD }),
  );
  await assert.rejects(
    signInAccount({
      ...fixtures,
      staff: initialStaff.map((s) => ({ ...s, status: 'Inactive' })),
      email: 'maria@aureline.hotel',
      password: ACCESS_PASSWORD,
    }),
  );
});
test('staff accounts can use an administrator-assigned password', async () => {
  const staff = initialStaff.map((person) =>
    person.id === 'ST-002' ? { ...person, password: 'FrontDesk123!' } : person,
  );
  const session = await signInAccount({
    ...fixtures,
    staff,
    email: 'maria@aureline.hotel',
    password: 'FrontDesk123!',
  });
  assert.equal(session.role, 'Front Desk');
  await assert.rejects(
    signInAccount({ ...fixtures, staff, email: 'maria@aureline.hotel', password: ACCESS_PASSWORD }),
  );
});
test('guest registration credentials support returning login without persisting a plain password', async () => {
  const guest = { id: 'G-TEST', firstName: 'Test', lastName: 'Guest', email: 'test@example.com' };
  const credential = await createAccountCredential(guest.id, 'SamplePass123!');
  assert.ok(credential.salt && credential.digest);
  assert.ok(!JSON.stringify(credential).includes('SamplePass123!'));
  const input = {
    guests: [guest],
    staff: initialStaff,
    accounts: [credential],
    email: ' TEST@example.com ',
    password: 'SamplePass123!',
  };
  const session = await signInAccount(input);
  assert.equal(session.role, 'Guest');
  assert.equal(session.guestId, guest.id);
  await assert.rejects(signInAccount({ ...input, password: 'WrongPassword' }));
});
test('login keeps booking dates while rejecting external and disallowed redirects', () => {
  const search = '/search?start=2026-12-02&end=2026-12-05&guests=2';
  assert.equal(destinationAfterLogin('Guest', search), search);
  assert.equal(destinationAfterLogin('Guest', '/dashboard'), '/my-stays');
  assert.equal(destinationAfterLogin('Front Desk', '/team'), '/dashboard');
  assert.equal(destinationAfterLogin('Admin', '/team'), '/team');
  assert.equal(destinationAfterLogin('Guest', 'https://example.com'), '/my-stays');
  assert.equal(destinationAfterLogin('Admin', '//example.com'), '/dashboard');
});
