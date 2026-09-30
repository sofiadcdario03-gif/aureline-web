import React from 'react';
import { BedDouble, Users, ArrowUpRight, ArrowRight } from 'lucide-react';
import { money, photos } from '../../data.js';
import Badge from '../ui/Badge.jsx';

export default function RoomCard({ r, status, onClick, booking = false }) {
  return (
    <article className="room-card">
      <button className="room-image" onClick={onClick}>
        <img
          src={r.image || photos[r.type.toLowerCase()]}
          alt={`${r.type} room with elegant furnishings`}
          loading="lazy"
        />
        {status && <Badge>{status}</Badge>}
        <span className="room-image-number">NO. {r.number}</span>
      </button>
      <div className="room-card-body">
        <div className="room-card-title">
          <h3>
            {r.type === 'Suite'
              ? 'The Aureline Suite'
              : r.type === 'Deluxe'
                ? 'The Garden Deluxe'
                : r.type === 'Double'
                  ? 'The Classic Double'
                  : 'The Quiet Single'}
          </h3>
          <ArrowUpRight size={18} />
        </div>
        <div className="room-meta">
          <Users size={14} />
          {r.capacity} guest{r.capacity > 1 ? 's' : ''}
          <span>·</span>
          <BedDouble size={15} />
          {r.type === 'Single' ? 'Single bed' : 'King bed'}
        </div>
        <p>{r.description}</p>
        <div className="room-card-footer">
          <span>
            <strong>{money(r.price)}</strong>
            <small> / night</small>
          </span>
          <button className="text-button" onClick={onClick}>
            {booking ? 'Reserve' : 'View room'}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
