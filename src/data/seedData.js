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
export const initialGuests = [];
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
export const initialBookings = [];
export const initialPayments = [];
export const initialStaff = [];
