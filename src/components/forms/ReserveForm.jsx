import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { day, nights, money, dateLabel } from '../../data.js';
import { uid, fullName } from '../../utils/formatters.js';
import Field from '../ui/Field.jsx';
import Modal from '../ui/Modal.jsx';

export default function ReserveForm({ item, query, onClose, ...c }) {
  const [guestId, setGuestId] = useState(c.isGuest ? c.session.guestId : c.guests[0]?.id || '');
  return (
    <Modal
      title="A stay to look forward to"
      subtitle={`Room ${item.number} · ${item.type}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!c.available(item, query.start, query.end))
            return c.notify('This room is no longer available for these dates.');
          if (!guestId) return c.notify('Add a guest before creating a reservation.');
          const b = {
            id: uid('AH'),
            guestId,
            roomId: item.id,
            checkIn: query.start,
            checkOut: query.end,
            guests: query.count,
            status: 'Pending',
            createdAt: day(),
            rate: item.price,
          };
          c.setBookings([b, ...c.bookings]);
          onClose();
          c.navigate('/reservations');
          c.notify(`Reservation ${b.id} created. A lovely stay awaits.`);
        }}
      >
        <img className="modal-room-image short" src={item.image} alt={`${item.type} room`} />
        <Field label="Guest">
          <select
            required
            value={guestId}
            disabled={c.isGuest}
            onChange={(e) => setGuestId(e.target.value)}
          >
            {(c.isGuest ? c.guests.filter((g) => g.id === c.session.guestId) : c.guests).map(
              (g) => (
                <option key={g.id} value={g.id}>
                  {fullName(g)} · {g.email}
                </option>
              ),
            )}
          </select>
        </Field>
        {!c.isGuest && (
          <p className="form-hint">New guest? Add their profile in Guests before booking.</p>
        )}
        <div className="detail-grid">
          <div>
            <span>Check-in</span>
            <strong>
              {dateLabel(query.start, { month: 'short', day: 'numeric', year: 'numeric' })}
            </strong>
          </div>
          <div>
            <span>Check-out</span>
            <strong>
              {dateLabel(query.end, { month: 'short', day: 'numeric', year: 'numeric' })}
            </strong>
          </div>
          <div>
            <span>Guests</span>
            <strong>{query.count}</strong>
          </div>
          <div>
            <span>Room rate</span>
            <strong>{money(item.price)} / night</strong>
          </div>
        </div>
        <div className="bill-total">
          <span>
            {nights(query.start, query.end)} nights · Total stay
            <small>No payment is taken at reservation.</small>
          </span>
          <strong>{money(nights(query.start, query.end) * item.price)}</strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Go back
          </button>
          <button className="button primary">
            Create reservation
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
