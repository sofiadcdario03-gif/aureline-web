import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { photos } from '../../data.js';
import { roomInclusions } from '../../data/roomInclusions.js';
import { isActiveReservation as active } from '../../reservationRules.js';
import api from '../../services/api.js';
import Field from '../ui/Field.jsx';
import Modal from '../ui/Modal.jsx';

export default function RoomForm({ item, onClose, ...c }) {
  const [data, setData] = useState(
    item || {
      number: '',
      type: 'Double',
      price: 4800,
      capacity: 2,
      status: 'Available',
      description: '',
      image: photos.double,
    },
  );
  return (
    <Modal
      title={item ? 'Refine the details' : 'Add to the collection'}
      subtitle="Create a space your guests will love."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (c.rooms.some((r) => r.id !== item?.id && r.number === data.number))
            return c.notify('This room number already exists.');
          if (
            ['Maintenance', 'Inactive'].includes(data.status) &&
            c.bookings.some((b) => b.roomId === item?.id && active(b))
          )
            return c.notify(
              'Reassign or cancel active reservations before setting this room to maintenance or inactive.',
            );
          if (
            c.bookings.some(
              (b) => b.roomId === item?.id && active(b) && b.guests > Number(data.capacity),
            )
          )
            return c.notify('Capacity cannot be lower than an active reservation’s guest count.');
          const payload = {
            ...data,
            price: Number(data.price),
            capacity: Number(data.capacity),
          };
          try {
            const { data: saved } = item
              ? await api.put(`/rooms/${item.id}`, payload)
              : await api.post('/rooms', payload);
            c.setRooms((previous) =>
              item
                ? previous.map((room) => (room.id === item.id ? saved : room))
                : [...previous, saved],
            );
            onClose();
            c.notify(item ? 'Room details updated.' : 'New room added.');
          } catch (error) {
            c.notify(error.response?.data?.error || 'Room could not be saved.');
          }
        }}
      >
        <div className="form-grid">
          <Field
            label="Room number"
            required
            value={data.number}
            onChange={(e) => setData({ ...data, number: e.target.value })}
          />
          <Field label="Room type">
            <select
              value={data.type}
              onChange={(e) =>
                setData({
                  ...data,
                  type: e.target.value,
                  image: photos[e.target.value.toLowerCase()],
                })
              }
            >
              {['Single', 'Double', 'Deluxe', 'Suite'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Price per night (PHP)"
            required
            type="number"
            min="1"
            value={data.price}
            onChange={(e) => setData({ ...data, price: e.target.value })}
          />
          <Field
            label="Guest capacity"
            required
            type="number"
            min="1"
            max="20"
            value={data.capacity}
            onChange={(e) => setData({ ...data, capacity: e.target.value })}
          />
          <Field label="Operating status">
            <select
              value={data.status}
              onChange={(e) => setData({ ...data, status: e.target.value })}
            >
              <option>Available</option>
              <option>Maintenance</option>
              {item && <option>Inactive</option>}
            </select>
          </Field>
          <Field
            label="Image URL"
            required
            type="url"
            value={data.image}
            onChange={(e) => setData({ ...data, image: e.target.value })}
          />
        </div>
        <Field label="Included with this room">
          <div className="amenities room-inclusions" aria-live="polite">
            {roomInclusions[data.type].map((inclusion) => (
              <span key={inclusion}>
                <Check size={15} />
                {inclusion}
              </span>
            ))}
          </div>
        </Field>
        <Field label="Description">
          <textarea
            required
            rows="3"
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
          />
        </Field>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">
            Save room
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
