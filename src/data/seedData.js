import { day } from '../utils/dates.js';

export const photos = {
  hero: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1800&q=85',
  suite:
    'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=900&q=85',
  deluxe:
    'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=85',
  double:
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=85',
  single:
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=85',
};
export const initialGuests = [
  {
    id: 'G-001',
    firstName: 'Isabella',
    lastName: 'Reyes',
    email: 'isabella.reyes@example.com',
    phone: '+63 917 234 5678',
    address: 'Sorsogon City, Philippines',
    passport: 'PH-1001',
  },
  {
    id: 'G-002',
    firstName: 'Oliver',
    lastName: 'Bennett',
    email: 'oliver.b@example.com',
    phone: '+44 7700 900123',
    address: 'London, United Kingdom',
    passport: 'UK-2201',
  },
  {
    id: 'G-003',
    firstName: 'Sofia',
    lastName: 'Chen',
    email: 'sofia.chen@example.com',
    phone: '+65 8123 4567',
    address: 'Singapore',
    passport: 'SG-3301',
  },
  {
    id: 'G-004',
    firstName: 'James',
    lastName: 'Anderson',
    email: 'james.a@example.com',
    phone: '+1 202 555 0123',
    address: 'New York, United States',
    passport: 'US-4401',
  },
  {
    id: 'G-005',
    firstName: 'Amelia',
    lastName: 'Santos',
    email: 'amelia.s@example.com',
    phone: '+63 918 345 6789',
    address: 'Legazpi City, Philippines',
    passport: 'PH-5501',
  },
  {
    id: 'G-006',
    firstName: 'Lucas',
    lastName: 'Martin',
    email: 'lucas.m@example.com',
    phone: '+33 6 12 34 56 78',
    address: 'Paris, France',
    passport: 'FR-6601',
  },
];
export const initialRooms = Array.from({ length: 24 }, (_, i) => {
  const type = ['Single', 'Double', 'Deluxe', 'Suite'][Math.floor(i / 6)];
  return {
    id: `R-${i + 1}`,
    number: String(101 + Math.floor(i / 8) * 100 + (i % 8)),
    type,
    price: { Single: 3200, Double: 4800, Deluxe: 6500, Suite: 9800 }[type],
    capacity: { Single: 1, Double: 2, Deluxe: 3, Suite: 4 }[type],
    status: i === 22 || i === 23 ? 'Maintenance' : 'Available',
    description: {
      Single:
        'A quiet retreat with warm textures, soft linen, and everything you need to feel at home.',
      Double:
        'Room to unwind. A beautifully appointed space with a generous bed and thoughtful comforts.',
      Deluxe:
        'An elevated stay with sunlit interiors, handcrafted details, and a little extra room to linger.',
      Suite:
        'Our most generous retreat. A separate living space, beautiful views, and considered luxury.',
    }[type],
    image: photos[type.toLowerCase()],
  };
});
export const initialBookings = [
  {
    id: 'AH-2041',
    guestId: 'G-001',
    roomId: 'R-19',
    checkIn: day(),
    checkOut: day(3),
    guests: 2,
    status: 'Confirmed',
    createdAt: day(-4),
    rate: 9800,
  },
  {
    id: 'AH-2040',
    guestId: 'G-002',
    roomId: 'R-13',
    checkIn: day(),
    checkOut: day(2),
    guests: 2,
    status: 'Pending',
    createdAt: day(-3),
    rate: 6500,
  },
  {
    id: 'AH-2039',
    guestId: 'G-003',
    roomId: 'R-7',
    checkIn: day(-2),
    checkOut: day(),
    guests: 2,
    status: 'Checked-in',
    createdAt: day(-7),
    rate: 4800,
  },
  {
    id: 'AH-2038',
    guestId: 'G-004',
    roomId: 'R-20',
    checkIn: day(-1),
    checkOut: day(3),
    guests: 3,
    status: 'Checked-in',
    createdAt: day(-8),
    rate: 9800,
  },
  {
    id: 'AH-2037',
    guestId: 'G-005',
    roomId: 'R-14',
    checkIn: day(),
    checkOut: day(4),
    guests: 2,
    status: 'Confirmed',
    createdAt: day(-2),
    rate: 6500,
  },
  {
    id: 'AH-2036',
    guestId: 'G-006',
    roomId: 'R-1',
    checkIn: day(-3),
    checkOut: day(),
    guests: 1,
    status: 'Checked-in',
    createdAt: day(-9),
    rate: 3200,
  },
  {
    id: 'AH-2035',
    guestId: 'G-002',
    roomId: 'R-8',
    checkIn: day(2),
    checkOut: day(5),
    guests: 2,
    status: 'Confirmed',
    createdAt: day(-1),
    rate: 4800,
  },
  {
    id: 'AH-2034',
    guestId: 'G-001',
    roomId: 'R-15',
    checkIn: day(-12),
    checkOut: day(-10),
    guests: 2,
    status: 'Checked-out',
    createdAt: day(-20),
    rate: 6500,
  },
];
export const initialPayments = [
  { id: 'PAY-1001', bookingId: 'AH-2038', amount: 39200, method: 'Card', date: day(-1) },
  { id: 'PAY-1002', bookingId: 'AH-2039', amount: 4800, method: 'Cash', date: day(-2) },
  { id: 'PAY-1003', bookingId: 'AH-2041', amount: 9800, method: 'Card', date: day(-3) },
  { id: 'PAY-1004', bookingId: 'AH-2034', amount: 13000, method: 'Card', date: day(-10) },
];
export const initialStaff = [
  {
    id: 'ST-001',
    name: 'Alex Morgan',
    email: 'alex@aureline.hotel',
    role: 'Admin',
    status: 'Active',
  },
  {
    id: 'ST-002',
    name: 'Maria Cruz',
    email: 'maria@aureline.hotel',
    role: 'Front Desk',
    status: 'Active',
  },
  {
    id: 'ST-003',
    name: 'Daniel Lee',
    email: 'daniel@aureline.hotel',
    role: 'Front Desk',
    status: 'Active',
  },
];
