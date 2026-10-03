import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  day,
  nights,
  initialRooms,
  initialGuests,
  initialBookings,
  initialPayments,
  initialStaff,
} from '../data';
import { getRoomStatus, isRoomAvailable } from '../reservationRules';
import useSaved from '../hooks/useSaved';
const HotelContext = createContext(null);
export function useHotel() {
  const value = useContext(HotelContext);
  if (!value) throw new Error('useHotel must be used within HotelProvider');
  return value;
}
export function HotelProvider({ children }) {
  const [rooms, setRooms] = useSaved('ah-rooms-v1', initialRooms),
    [guests, setGuests] = useSaved('ah-guests-v1', initialGuests),
    [bookings, setBookings] = useSaved('ah-bookings-v1', initialBookings),
    [payments, setPayments] = useSaved('ah-payments-v1', initialPayments),
    [staff, setStaff] = useSaved('ah-staff-v1', initialStaff);
  const [session, setSession] = useSaved('ah-session-v2', null);
  const [accounts, setAccounts] = useSaved('ah-accounts-v1', []);
  const [modal, setModal] = useState(null),
    [toast, setToast] = useState('');
  const navigate = useNavigate();
  const role = session?.role || 'Visitor',
    isGuest = role === 'Guest';
  const notify = (message) => {
    setToast(message);
  };
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load guests from MongoDB on mount
  useEffect(() => {
    const loadGuests = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/guests');
        if (response.data && response.data.length > 0) {
          setGuests(response.data);
        }
      } catch (error) {
        console.error('Error loading guests from database:', error);
        // Fall back to initial guests if API fails
      }
    };
    loadGuests();
  }, []);

  // Load staff from MongoDB on mount
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/staff');
        if (response.data && response.data.length > 0) {
          setStaff(response.data);
        }
      } catch (error) {
        console.error('Error loading staff from database:', error);
        // Fall back to initial staff if API fails
      }
    };
    loadStaff();
  }, []);

  // Function to reload staff from database
  const reloadStaff = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/staff');
      if (response.data) {
        setStaff(response.data);
      }
    } catch (error) {
      console.error('Error reloading staff from database:', error);
    }
  };

  // Load accounts from MongoDB on mount
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/accounts');
        if (response.data && response.data.length > 0) {
          setAccounts(response.data);
        }
      } catch (error) {
        console.error('Error loading accounts from database:', error);
        // Fall back to initial accounts if API fails
      }
    };
    loadAccounts();
  }, []);
  const guest = (id) => guests.find((g) => g.id === id),
    room = (id) => rooms.find((r) => r.id === id),
    total = (b) => nights(b.checkIn, b.checkOut) * b.rate,
    paid = (b) => payments.filter((p) => p.bookingId === b.id).reduce((s, p) => s + p.amount, 0),
    paymentStatus = (b) =>
      paid(b) >= total(b) ? 'Paid' : paid(b) > 0 ? 'Partially paid' : 'Unpaid';
  const roomStatus = (r, date = day()) => getRoomStatus(r, bookings, date);
  const available = (r, start, end, exclude) => isRoomAvailable(r, bookings, start, end, exclude);
  const visibleBookings = isGuest
    ? bookings.filter((b) => b.guestId === session?.guestId)
    : bookings;
  const updateStatus = (b, status) => {
    if (status === 'Checked-in' && (b.checkIn > day() || b.checkOut <= day()))
      return notify('Check-in is available during the reservation dates.');
    if (
      status === 'Checked-in' &&
      (room(b.roomId)?.status === 'Maintenance' ||
        bookings.some((x) => x.id !== b.id && x.roomId === b.roomId && x.status === 'Checked-in'))
    )
      return notify('This room is not ready for check-in. Reassign an available room.');
    setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, status } : x)));
    setModal(null);
    notify(`Reservation ${b.id} ${status.toLowerCase()}.`);
  };
  const ctx = {
    rooms,
    setRooms,
    guests,
    setGuests,
    bookings,
    setBookings,
    payments,
    setPayments,
    staff,
    setStaff,
    session,
    setSession,
    accounts,
    setAccounts,
    role,
    isGuest,
    guest,
    room,
    total,
    paid,
    paymentStatus,
    roomStatus,
    available,
    visibleBookings,
    modal,
    setModal,
    toast,
    setToast,
    notify,
    updateStatus,
    navigate,
    reloadStaff,
  };

  return <HotelContext.Provider value={ctx}>{children}</HotelContext.Provider>;
}
