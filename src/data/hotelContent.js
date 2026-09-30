import { photos } from '../data';

export const hotelImages = {
  exterior:
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=85',
  dining:
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85',
  pool: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=85',
  lobby:
    'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=85',
};

export const roomCollection = [
  {
    type: 'Single',
    name: 'The Quiet Single',
    subtitle: 'A little space, entirely yours.',
    size: '24 sqm',
    bed: 'One single bed',
    image: photos.single,
    description:
      'For solo adventures and moments of calm. Warm wood, soft linen, and a beautifully simple space to slow down in.',
  },
  {
    type: 'Double',
    name: 'The Classic Double',
    subtitle: 'Better when shared.',
    size: '32 sqm',
    bed: 'One king bed',
    image: photos.double,
    description:
      'Easy mornings and unhurried evenings. Our classic double pairs generous comfort with the details that make you feel at home.',
  },
  {
    type: 'Deluxe',
    name: 'The Garden Deluxe',
    subtitle: 'A little more room to linger.',
    size: '42 sqm',
    bed: 'One king bed + daybed',
    image: photos.deluxe,
    description:
      'Light-filled interiors, natural textures, and a cozy place to curl up with a book. An elevated Sorsogon escape.',
  },
  {
    type: 'Suite',
    name: 'The Aureline Suite',
    subtitle: 'Make a little more of your stay.',
    size: '68 sqm',
    bed: 'One king bed + sofa bed',
    image: photos.suite,
    description:
      'Our most generous retreat, with a separate living area and room for everyone to unwind. Beautifully considered from morning to night.',
  },
];

export const experiences = [
  {
    id: 'dining',
    label: 'AT THE TABLE',
    title: 'Good food. Better company.',
    image: hotelImages.dining,
    description:
      'Gather over a leisurely breakfast, a seasonal plate, or one more conversation. Our dining concept celebrates simple pleasures and Sorsogon-inspired hospitality.',
    detail: 'The Veranda - Breakfast, lunch & dinner',
    hours: 'Open daily - 6:30 AM to 10:00 PM',
  },
  {
    id: 'unwind',
    label: 'ROOM TO BREATHE',
    title: 'Do a little less.',
    image: hotelImages.pool,
    description:
      'A quiet swim. A seat in the sun. Give yourself permission to slow down and enjoy the gentler side of your stay.',
    detail: 'The courtyard - Pool & quiet spaces',
    hours: 'Open daily - 7:00 AM to 9:00 PM',
  },
  {
    id: 'gather',
    label: 'MOMENTS THAT MATTER',
    title: 'Bring your people together.',
    image: hotelImages.lobby,
    description:
      'From a small celebration to an inspiring conversation, enjoy a welcoming setting made for meaningful time together.',
    detail: 'The drawing room - Small gatherings',
    hours: 'Private gatherings - By arrangement',
  },
];

export const stayFAQs = [
  [
    'Where is Aureline Hotel located?',
    'Aureline Hotel is set in Sorsogon City, Philippines, with easy access to local dining, city stops, and nearby coastal trips.',
  ],
  [
    'What time are check-in and checkout?',
    'Check-in begins at 3:00 PM and checkout is by 12:00 PM. Early arrival or a later departure is subject to availability; speak with the front desk.',
  ],
  [
    'How do I make a reservation?',
    'Choose your dates and guest count, browse available rooms, then sign in or create a guest account. Your reservation appears in My stays while the front desk confirms it.',
  ],
  [
    'Are there discounts or offers?',
    'Selected weekday stays include up to 10% off, while Deluxe and Suite stays of two nights or more may receive up to 15% off depending on availability.',
  ],
  [
    'Can I change or cancel my stay?',
    'You can edit or cancel pending and confirmed reservations from My stays. For a current stay or a reservation with a payment, contact the front desk for assistance.',
  ],
  [
    'Is payment taken when I book?',
    'Online reservations are recorded first. Payments are confirmed by the front desk, and your reservation shows its current payment status.',
  ],
];
