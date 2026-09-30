export const isActiveReservation = (booking) =>
  ['Pending', 'Confirmed', 'Checked-in'].includes(booking.status);

export function isRoomAvailable(room, bookings, start, end, excludedBookingId) {
  if (!start || !end || end <= start || room.status === 'Maintenance') return false;
  return !bookings.some(
    (booking) =>
      booking.id !== excludedBookingId &&
      booking.roomId === room.id &&
      isActiveReservation(booking) &&
      booking.checkIn < end &&
      booking.checkOut > start,
  );
}

export function getRoomStatus(room, bookings, date) {
  if (room.status === 'Maintenance') return 'Maintenance';
  if (
    bookings.some(
      (booking) =>
        booking.roomId === room.id &&
        booking.status === 'Checked-in' &&
        booking.checkIn <= date &&
        booking.checkOut >= date,
    )
  )
    return 'Occupied';
  if (
    bookings.some(
      (booking) =>
        booking.roomId === room.id &&
        isActiveReservation(booking) &&
        booking.checkIn <= date &&
        booking.checkOut > date,
    )
  )
    return 'Reserved';
  return 'Available';
}
