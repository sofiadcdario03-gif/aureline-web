import React from 'react';
import { ArrowRight, Check, Trash2, Pencil } from 'lucide-react';
import { money } from '../../data.js';
import { roomInclusions } from '../../data/roomInclusions.js';
import Badge from '../ui/Badge.jsx';
import Modal from '../ui/Modal.jsx';
import api from '../../services/api.js';

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
        {roomInclusions[item.type].map((inclusion) => (
          <span key={inclusion}>
            <Check size={15} />
            {inclusion}
          </span>
        ))}
      </div>
      <div className="modal-actions">
        {c.role === 'Admin' && (
          <>
            <button
              className="button danger-quiet"
              onClick={() => {
                c.setModal({
                  type: 'confirmDelete',
                  title: 'Delete this room permanently?',
                  message: `Room ${item.number} will be permanently deleted. Rooms with reservation history cannot be deleted; edit the room and set it to Inactive to keep its history.`,
                  confirmLabel: 'Delete room',
                  cancelLabel: 'Keep room',
                  action: async () => {
                    await api.delete(`/rooms/${item.id}`);
                    c.setRooms((rooms) => rooms.filter((room) => room.id !== item.id));
                    c.notify('Room permanently deleted.');
                  },
                });
              }}
            >
              <Trash2 size={16} />
              Delete room
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
