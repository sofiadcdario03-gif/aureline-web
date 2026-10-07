import React, { useState } from 'react';

import { day, money } from '../../data.js';
import api from '../../services/api.js';
import Field from '../ui/Field.jsx';
import Modal from '../ui/Modal.jsx';

export default function EditBooking({ item, onClose, ...c }) {
  const [data, setData] = useState(item);
  const choices = c.rooms.filter(
    (r) =>
      r.capacity >= Number(data.guests) && c.available(r, data.checkIn, data.checkOut, item.id),
  );
  return (
    <Modal title="Update your stay" subtitle={item.id} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = c.room(data.roomId);
          if (data.checkOut <= data.checkIn) return c.notify('Check-out must be after check-in.');
          if (
            !r ||
            r.capacity < Number(data.guests) ||
            !c.available(r, data.checkIn, data.checkOut, item.id)
          )
            return c.notify('Choose an available room with enough capacity.');
          const update = { ...data, guests: Number(data.guests) };
          const updated = {
            ...item,
            ...update,
            rate: r.id === item.roomId ? item.rate : r.price,
          };
          if (c.total(updated) < c.paid(item))
            return c.notify(
              'The revised total is below the amount paid. Contact the front desk to arrange a refund first.',
            );
          try {
            const { data: saved } = await api.put(`/reservations/${item.id}`, update);
            c.setBookings(c.bookings.map((b) => (b.id === item.id ? saved : b)));
            onClose();
            c.notify('Reservation updated.');
          } catch (error) {
            c.notify(error.response?.data?.error || 'Reservation could not be updated.');
          }
        }}
      >
        <div className="form-grid">
          <Field
            label="Check-in"
            type="date"
            required
            min={day()}
            value={data.checkIn}
            onChange={(e) => setData({ ...data, checkIn: e.target.value })}
          />
          <Field
            label="Check-out"
            type="date"
            required
            min={data.checkIn}
            value={data.checkOut}
            onChange={(e) => setData({ ...data, checkOut: e.target.value })}
          />
          <Field
            label="Number of guests"
            required
            type="number"
            min="1"
            max="20"
            value={data.guests}
            onChange={(e) => setData({ ...data, guests: e.target.value })}
          />
          <Field label="Room">
            <select
              required
              value={data.roomId}
              onChange={(e) => setData({ ...data, roomId: e.target.value })}
            >
              <option value="">Select room</option>
              {choices.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} · {r.type} · {money(r.id === item.roomId ? item.rate : r.price)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Save reservation</button>
        </div>
      </form>
    </Modal>
  );
}
