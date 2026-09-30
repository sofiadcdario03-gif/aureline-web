import React from 'react';
import { Mail, Phone, MapPin, ShieldCheck, Trash2, Pencil } from 'lucide-react';
import { fullName } from '../../utils/formatters.js';
import Modal from '../ui/Modal.jsx';
import BookingTable from '../reservations/BookingTable.jsx';

export default function GuestDetailsModal({ item, onClose, ...c }) {
  const history = c.bookings.filter((b) => b.guestId === item.id);
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
      <BookingTable {...c} rows={history} compact />
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
              action: () => {
                c.setGuests(c.guests.filter((g) => g.id !== item.id));
                c.notify('Guest deleted.');
              },
            });
          }}
        >
          <Trash2 size={16} />
          Delete guest
        </button>
        <button className="button primary" onClick={() => c.setModal({ type: 'guestForm', item })}>
          <Pencil size={16} />
          Edit guest
        </button>
      </div>
    </Modal>
  );
}
