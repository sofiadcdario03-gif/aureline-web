import React from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, Check, Pencil } from 'lucide-react';
import { nights, money, dateLabel } from '../../data.js';
import { fullName, initials } from '../../utils/formatters.js';
import Badge from '../ui/Badge.jsx';
import Modal from '../ui/Modal.jsx';

export default function BookingDetailsModal({ item, onClose, ...c }) {
  const b = c.bookings.find((b) => b.id === item.id) || item;
  return (
    <Modal
      title={`Reservation ${b.id}`}
      subtitle={`Created ${dateLabel(b.createdAt, { month: 'long', day: 'numeric', year: 'numeric' })}`}
      onClose={onClose}
    >
      <div className="booking-detail-head">
        <div className="guest-cell">
          <span className="avatar avatar-0">{initials(fullName(c.guest(b.guestId)))}</span>
          <div>
            <strong>{fullName(c.guest(b.guestId))}</strong>
            <small>{c.guest(b.guestId)?.email}</small>
          </div>
        </div>
        <Badge>{b.status}</Badge>
      </div>
      <div className="detail-grid">
        {[
          ['Room', `${c.room(b.roomId)?.number} · ${c.room(b.roomId)?.type}`],
          ['Guests', b.guests],
          ['Check-in', dateLabel(b.checkIn, { month: 'short', day: 'numeric', year: 'numeric' })],
          ['Check-out', dateLabel(b.checkOut, { month: 'short', day: 'numeric', year: 'numeric' })],
          ['Length of stay', `${nights(b.checkIn, b.checkOut)} nights`],
          ['Rate per night', money(b.rate)],
        ].map(([label, v]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="bill-total">
        <span>
          Total amount
          <small>
            {c.paymentStatus(b)} · {money(c.paid(b))} received
          </small>
        </span>
        <strong>{money(c.total(b))}</strong>
      </div>
      {b.status === 'Checked-in' && (
        <p className="info-note">
          Before checkout, confirm the guest’s departure and total balance of{' '}
          {money(Math.max(0, c.total(b) - c.paid(b)))}.
        </p>
      )}
      <div className="modal-actions wrap">
        {['Pending', 'Confirmed'].includes(b.status) && (
          <>
            <button
              className="button danger-quiet"
              onClick={() => c.setModal({ type: 'cancel', item: b })}
            >
              Cancel reservation
            </button>
            <button
              className="button secondary"
              onClick={() => c.setModal({ type: 'editBooking', item: b })}
            >
              <Pencil size={15} />
              Edit
            </button>
          </>
        )}
        {!c.isGuest && b.status === 'Pending' && (
          <button className="button primary" onClick={() => c.updateStatus(b, 'Confirmed')}>
            <Check size={16} />
            Confirm booking
          </button>
        )}
        {!c.isGuest && b.status === 'Confirmed' && (
          <button className="button primary" onClick={() => c.updateStatus(b, 'Checked-in')}>
            <ArrowDownLeft size={16} />
            Confirm check-in
          </button>
        )}
        {!c.isGuest && b.status === 'Checked-in' && (
          <button
            className="button primary"
            onClick={() => {
              if (c.paid(b) < c.total(b)) {
                c.setModal({ type: 'payment', item: b });
                c.notify('Please settle the balance before checkout.');
              } else c.updateStatus(b, 'Checked-out');
            }}
          >
            Confirm checkout
            <ArrowUpRight size={15} />
          </button>
        )}
        {!c.isGuest && b.status !== 'Cancelled' && (
          <button
            className="button secondary"
            onClick={() => c.setModal({ type: 'payment', item: b })}
          >
            <Wallet size={15} />
            Billing
          </button>
        )}
      </div>
    </Modal>
  );
}
