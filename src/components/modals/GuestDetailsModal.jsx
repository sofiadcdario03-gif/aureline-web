import React, { useState } from 'react';
import { Mail, Phone, MapPin, ShieldCheck, Trash2, Pencil, Plus } from 'lucide-react';
import { fullName } from '../../utils/formatters.js';
import api from '../../services/api.js';
import Modal from '../ui/Modal.jsx';
import BookingTable from '../reservations/BookingTable.jsx';

export default function GuestDetailsModal({ item, onClose, ...c }) {
  const [filter, setFilter] = useState('All stays');
  const history = c.bookings.filter((b) => b.guestId === item.id);
  const filteredBookings = history.filter(
    (booking) =>
      filter === 'All stays' ||
      (filter === 'Upcoming Stay' && ['Pending', 'Confirmed'].includes(booking.status)) ||
      (filter === 'Current Reservation' && booking.status === 'Checked-in') ||
      (filter === 'Past Reservations' && booking.status === 'Checked-out') ||
      (filter === 'Cancelled' && booking.status === 'Cancelled'),
  );

  const handleCreateReservation = () => {
    onClose();
    c.navigate('/search');
  };

  return (
    <Modal title={fullName(item)} subtitle={item.id} onClose={onClose} wide>
      <div className="guest-detail-grid">
        <div>
          <Mail size={16} />
          {item.email}
        </div>
        <div>
          <Phone size={16} />
          {item.phone}
        </div>
        <div>
          <MapPin size={16} />
          {item.address}
        </div>
        <div>
          <ShieldCheck size={16} />
          ID: {item.passport}
        </div>
      </div>
      <h3 className="section-label">
        Reservation history <span>({history.length})</span>
      </h3>
      <div className="stay-filter-tabs" role="group" aria-label="Filter reservations" style={{ marginBottom: '20px' }}>
        {['All stays', 'Upcoming Stay', 'Current Reservation', 'Past Reservations', 'Cancelled'].map((tab) => (
          <button
            key={tab}
            className={filter === tab ? 'selected' : ''}
            onClick={() => setFilter(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <BookingTable {...c} rows={filteredBookings} compact />
      <div className="modal-actions">
        <button
          className="button danger-quiet"
          onClick={() => {
            if (history.length)
              return c.notify('Guests with reservation history cannot be deleted.');
            c.setModal({
              type: 'confirmDelete',
              title: 'Delete guest?',
              message: `Remove ${fullName(item)} from the guest directory.`,
              action: async () => {
                try {
                  await api.delete(`/guests/${item.id}`);
                  c.setGuests(c.guests.filter((g) => g.id !== item.id));
                  c.notify('Guest deleted.');
                  onClose();
                } catch (error) {
                  c.notify(error.response?.data?.error || 'Failed to delete guest.');
                }
              },
            });
          }}
        >
          <Trash2 size={16} />
          Delete guest
        </button>
        <button className="button secondary" onClick={handleCreateReservation}>
          <Plus size={16} />
          Create reservation
        </button>
        <button className="button primary" onClick={() => c.setModal({ type: 'guestForm', item })}>
          <Pencil size={16} />
          Edit guest
        </button>
      </div>
    </Modal>
  );
}
