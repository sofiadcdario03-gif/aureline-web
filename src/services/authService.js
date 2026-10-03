// Local auth adapter. Replace these methods with your Express auth API.
export const ACCESS_PASSWORD = 'Aureline123!';
export const normalizeEmail = (value) => value.trim().toLowerCase();

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

export async function createAccountCredential(guestId, password) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return { guestId, salt, digest: await passwordDigest(password, salt) };
}

export async function signInAccount({ email, password, guests, staff, accounts }) {
  const normalized = normalizeEmail(email);
  const employee = staff.find((person) => normalizeEmail(person.email) === normalized);
  if (employee) {
    // Check if employee has hashed password
    if (employee.salt && employee.digest) {
      const valid = (await passwordDigest(password, employee.salt)) === employee.digest;
      if (!valid || employee.status !== 'Active')
        throw new Error('The email or password is incorrect, or this account is inactive.');
    } else {
      // Fallback to plain text for old accounts or access password
      if (password !== (employee.password || ACCESS_PASSWORD) || employee.status !== 'Active')
        throw new Error('The email or password is incorrect, or this account is inactive.');
    }
    return { name: employee.name, role: employee.role, staffId: employee.id };
  }
  const guest = guests.find((person) => normalizeEmail(person.email) === normalized);
  const credential = accounts.find((account) => account.guestId === guest?.id);
  const valid = credential
    ? (await passwordDigest(password, credential.salt)) === credential.digest
    : guest?.id === 'G-001' && password === ACCESS_PASSWORD;
  if (!guest || !valid) throw new Error('The email or password is incorrect. Please try again.');
  return { name: `${guest.firstName} ${guest.lastName}`, role: 'Guest', guestId: guest.id };
}

export function destinationAfterLogin(role, requested) {
  const pathname = requested?.split('?')[0];
  const permitted =
    role === 'Guest'
      ? ['/my-stays', '/profile', '/search', '/reservations']
      : [
          '/dashboard',
          '/profile',
          '/search',
          '/reservations',
          '/rooms',
          '/guests',
          '/billing',
          ...(role === 'Admin' ? ['/team'] : []),
        ];
  return permitted.includes(pathname) ? requested : role === 'Guest' ? '/my-stays' : '/dashboard';
}
