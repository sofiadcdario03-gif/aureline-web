import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { day, nights } from '../data';
import { getRoomStatus, isRoomAvailable } from '../reservationRules';
import useSaved from '../hooks/useSaved';
const HotelContext = createContext(null);
export function useHotel() {
  const value = useContext(HotelContext);
  if (!value) throw new Error('useHotel must be used within HotelProvider');
  return value;
}
export function HotelProvider({ children }) {
  const [rooms, setRooms] = useState([]),
    [guests, setGuests] = useState([]),
    [bookings, setBookings] = useState([]),
    [payments, setPayments] = useState([]),
    [staff, setStaff] = useState([]);
  const [session, setSession] = useSaved('ah-session-v2', null);
  const [modal, setModal] = useState(null),
    [toast, setToast] = useState('');
  const navigate = useNavigate();
  const role = session?.role || 'Visitor',
    isGuest = role === 'Guest';
  const notify = (message) => {
    if (message && typeof message === 'object') {
      setToast(message.message || message.error || JSON.stringify(message));
    } else {
      setToast(String(message ?? 'An unexpected error occurred.'));
    }
  };
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    api
      .get('/rooms')
      .then(({ data }) => setRooms(Array.isArray(data) ? data : []))
      .catch((error) => {
        console.error('Error loading rooms from database:', error);
        setRooms([]);
        notify(error.response?.data?.error || 'Rooms could not be loaded from the server.');
      });
  }, []);

  useEffect(() => {
    if (session && !session.token) setSession(null);
    if (!session?.token) {
      setGuests([]);
      setStaff([]);
      return;
    }
    if (session.role === 'Guest') {
      let active = true;
      api
        .get('/profile')
        .then(({ data }) => {
          if (active) setGuests([data]);
        })
        .catch((error) => {
          if (!active) return;
          console.error('Error loading guest profile:', error);
          notify(error.response?.data?.error || 'Guest profile could not be loaded.');
        });
      setStaff([]);
      return () => {
        active = false;
      };
    }
    if (!['Admin', 'Front Desk'].includes(session.role)) return;
    setGuests([]);
    setStaff([]);
    let active = true;
    async function loadWorkspaceData() {
      try {
        const [guestResponse, staffResponse] = await Promise.all([
          api.get('/guests'),
          api.get('/staff'),
        ]);
        if (active) {
          setGuests(guestResponse.data);
          setStaff(staffResponse.data);
        }
      } catch (error) {
        if (!active) return;
        console.error('Error loading workspace accounts:', error);
        notify(error.response?.data?.error || 'Workspace account data could not be loaded.');
      }
    }
    loadWorkspaceData();
    return () => {
      active = false;
    };
  }, [session?.token, session?.role]);

  const reloadStaff = useCallback(async () => {
    try {
      const { data } = await api.get('/staff');
      setStaff(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error reloading staff from database:', error);
      setStaff([]);
      throw error;
    }
  }, []);

  const reloadRooms = useCallback(async () => {
    const { data } = await api.get('/rooms');
    setRooms(Array.isArray(data) ? data : []);
    return data;
  }, []);

  const reloadBookings = useCallback(async () => {
    try {
      const { data } = await api.get('/reservations');
      setBookings(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      setBookings([]);
      throw error;
    }
  }, []);

  const reloadPayments = useCallback(async () => {
    try {
      const { data } = await api.get('/payments');
      setPayments(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      setPayments([]);
      throw error;
    }
  }, []);
  const guest = (id) =>
      guests.find((g) => g.id === id) ||
      (session?.guestId === id && session.profile ? { id, ...session.profile } : undefined),
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
  const updateStatus = async (b, status) => {
    if (status === 'Checked-in' && (b.checkIn > day() || b.checkOut <= day()))
      return notify('Check-in is available during the reservation dates.');
    if (
      status === 'Checked-in' &&
      (room(b.roomId)?.status === 'Maintenance' ||
        bookings.some((x) => x.id !== b.id && x.roomId === b.roomId && x.status === 'Checked-in'))
    )
      return notify('This room is not ready for check-in. Reassign an available room.');
    try {
      const { data } = await api.patch(`/reservations/${b.id}/status`, { status });
      setBookings((prev) => prev.map((x) => (x.id === b.id ? data : x)));
      setModal(null);
      notify(`Reservation ${b.id} ${status.toLowerCase()}.`);
    } catch (error) {
      notify(error.response?.data?.error || 'Reservation status could not be updated.');
    }
  };
  useEffect(() => {
    if (!session?.token) {
      setBookings([]);
      setPayments([]);
      return;
    }
    Promise.all([reloadBookings(), reloadPayments()]).catch((error) => {
      console.error('Error loading reservations:', error);
      if (error.response?.status === 401) setSession(null);
      else
        notify(
          error.response?.data?.error || 'Reservation and payment records could not be loaded.',
        );
    });
  }, [session?.token, reloadBookings, reloadPayments]);
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
    reloadRooms,
    reloadBookings,
    reloadPayments,
  };

  return <HotelContext.Provider value={ctx}>{children}</HotelContext.Provider>;
}
