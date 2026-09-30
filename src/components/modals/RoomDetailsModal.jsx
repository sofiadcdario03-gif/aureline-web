import React from 'react';
import { ArrowRight, Check, Trash2, Pencil } from 'lucide-react';
import { money } from '../../data.js';
import Badge from '../ui/Badge.jsx';
import Modal from '../ui/Modal.jsx';

export default function RoomDetailsModal({ item, onClose, ...c }) {
  return (
    <Modal
      title={`Room ${item.number} · ${item.type}`}
      subtitle="A thoughtful space for a beautiful stay."
      onClose={onClose}
    >
      <img className="modal-room-image" src={item.image} alt={`${item.type} room`} />
      <div className="detail-inline">
        <Badge>{c.roomStatus(item)}</Badge>
        <span>{item.capacity} guests</span>
        <strong>{money(item.price)} / night</strong>
      </div>
      <p className="description-text">{item.description}</p>
      <div className="amenities">
        <span>
          <Check size={15} />
          Complimentary Wi-Fi
        </span>
        <span>
          <Check size={15} />
          Air conditioning
        </span>
        <span>
          <Check size={15} />
          Premium linens
        </span>
        <span>
          <Check size={15} />
          Daily housekeeping
        </span>
      </div>
      <div className="modal-actions">
        {c.role === 'Admin' && (
          <>
            <button
              className="button danger-quiet"
              onClick={() => {
                if (c.bookings.some((b) => b.roomId === item.id))
                  return c.notify(
                    'This room has reservation history. Set it to maintenance instead.',
                  );
                c.setModal({
                  type: 'confirmDelete',
                  title: 'Delete this room?',
                  message: `Room ${item.number} will be removed from the room collection.`,
                  action: () => {
                    c.setRooms(c.rooms.filter((r) => r.id !== item.id));
                    c.notify('Room deleted.');
                  },
                });
              }}
            >
              <Trash2 size={16} />
              Delete
            </button>
            <button
              className="button secondary"
              onClick={() => c.setModal({ type: 'roomForm', item })}
            >
              <Pencil size={16} />
              Edit room
            </button>
          </>
        )}
        <button
          className="button primary"
          onClick={() => {
            onClose();
            c.navigate('/search');
          }}
        >
          Find availability
          <ArrowRight size={15} />
        </button>
      </div>
    </Modal>
  );
}
