import crypto from 'crypto';

export function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
}

export function verifyPassword(password, salt, expectedDigest) {
  if (
    typeof password !== 'string' ||
    typeof salt !== 'string' ||
    typeof expectedDigest !== 'string'
  ) {
    return false;
  }
  const expected = Buffer.from(expectedDigest, 'hex');
  if (expected.length !== 32) return false;
  const actual = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return crypto.timingSafeEqual(actual, expected);
}

export function createAccessToken(identity, secret, now = Date.now()) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ ...identity, exp: now + 12 * 60 * 60 * 1000 }),
  ).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

export function verifyAccessToken(token, secret, now = Date.now()) {
  const [header, payload, signature, extra] = String(token || '').split('.');
  if (!header || !payload || !signature || extra) return null;
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString());
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') return null;
    const expected = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > now ? data : null;
  } catch {
    return null;
  }
}
