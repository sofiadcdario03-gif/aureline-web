// Shared exports for the UI. Seed content and utilities live in their own modules.
export { day, nights, dateLabel } from './utils/dates.js';
export { money } from './utils/formatters.js';
export {
  photos,
  initialGuests,
  initialRooms,
  initialBookings,
  initialPayments,
  initialStaff,
} from './data/seedData.js';
