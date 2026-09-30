export const uid = (prefix) => prefix + '-' + crypto.randomUUID().slice(0, 8).toUpperCase();
export const fullName = (guest) =>
  guest ? guest.firstName + ' ' + guest.lastName : 'Unknown guest';
export const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

export const money = (n) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(n);
