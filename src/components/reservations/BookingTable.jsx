import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { nights, money, dateLabel } from '../../data.js';
import { fullName, initials } from '../../utils/formatters.js';
import Badge from '../ui/Badge.jsx';
import Empty from '../ui/Empty.jsx';

export default function BookingTable(c) {
  const { rows, guest, room, total, setModal, compact = false } = c;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Guest</th>
            <th>Room</th>
            <th>{compact ? 'Stay dates' : 'Check-in / out'}</th>
            {!compact && <th>Amount</th>}
            <th>Status</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((b, i) => (
            <tr key={b.id}>
              <td>
                <button
                  className="guest-cell"
                  onClick={() => setModal({ type: 'booking', item: b })}
                >
                  <span className={`avatar avatar-${i % 4}`}>
                    {initials(fullName(guest(b.guestId)))}
                  </span>
                  <span>
                    <strong>{fullName(guest(b.guestId))}</strong>
                    <small>#{b.id}</small>
                  </span>
                </button>
              </td>
              <td>
                <strong className="room-number">{room(b.roomId)?.number}</strong>
                <small>{room(b.roomId)?.type}</small>
              </td>
              <td>
                <span className="stay-date">
                  {dateLabel(b.checkIn)} <span className="date-arrow">→</span>{' '}
                  {dateLabel(b.checkOut)}
                </span>
                <small>
                  {nights(b.checkIn, b.checkOut)} nights · {b.guests} guest
                  {b.guests !== 1 ? 's' : ''}
                </small>
              </td>
              {!compact && (
                <td>
                  <strong>{money(total(b))}</strong>
                  <small>{c.paymentStatus(b)}</small>
                </td>
              )}
              <td>
                <Badge>{b.status}</Badge>
              </td>
              <td>
                <button
                  className="icon-button"
                  onClick={() => setModal({ type: 'booking', item: b })}
                  aria-label={`View reservation ${b.id}`}
                >
                  <MoreHorizontal size={19} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty text="No reservations found" />}
    </div>
  );
}
