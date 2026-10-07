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
