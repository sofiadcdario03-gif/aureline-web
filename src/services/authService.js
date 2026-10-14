import api from './api';

export const normalizeEmail = (value) => value.trim().toLowerCase();

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

export async function checkEmailAvailable(email) {
  try {
    const { data } = await api.get('/auth/check-email', { params: { email } });
    return data.available === true;
  } catch (error) {
    console.error('Error checking email availability:', error);
    return false;
  }
}

export async function checkPhoneAvailable(phone) {
  try {
    const { data } = await api.get('/auth/check-phone', { params: { phone } });
    return data.available === true;
  } catch (error) {
    console.error('Error checking phone availability:', error);
    return false;
  }
}

export async function checkPassportAvailable(passport) {
  try {
    const { data } = await api.get('/auth/check-passport', { params: { passport } });
    return data.available === true;
  } catch (error) {
    console.error('Error checking passport availability:', error);
    return false;
  }
}
