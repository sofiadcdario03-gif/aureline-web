import React, { useState } from 'react';
import { ArrowRight, Search, X, Check } from 'lucide-react';
import { nights, money, dateLabel } from '../../data.js';
import { fullName } from '../../utils/formatters.js';
import { roomInclusions } from '../../data/roomInclusions.js';
import api from '../../services/api.js';
import Field from '../ui/Field.jsx';
import Modal from '../ui/Modal.jsx';

export default function ReserveForm({ item, query, onClose, ...c }) {
  const [guestId, setGuestId] = useState(c.isGuest ? c.session.guestId : c.guests[0]?.id || '');
  const [guestSearch, setGuestSearch] = useState('');
  const [showGuestSearch, setShowGuestSearch] = useState(false);

  const filteredGuests = c.guests.filter(
    (g) =>
      (fullName(g) + g.email + g.phone).toLowerCase().includes(guestSearch.toLowerCase()),
  );

  const selectedGuest = c.guests.find((g) => g.id === guestId);

  return (
    <Modal
      title="A stay to look forward to"
      subtitle={`Room ${item.number} · ${item.type}`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!c.available(item, query.start, query.end))
            return c.notify('This room is no longer available for these dates.');
          if (!guestId) return c.notify('Add a guest before creating a reservation.');
          const request = {
            guestId,
            roomId: item.id,
            checkIn: query.start,
            checkOut: query.end,
            guests: query.count,
          };
          try {
            const { data: b } = await api.post('/reservations', request);
            c.setBookings([b, ...c.bookings]);
            onClose();
            c.navigate('/reservations');
            c.notify(`Reservation ${b.id} created. A lovely stay awaits.`);
          } catch (error) {
            c.notify(error.response?.data?.error || 'Reservation could not be created.');
          }
        }}
      >
        <img className="modal-room-image short" src={item.image} alt={`${item.type} room`} />
        <div className="detail-inline">
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
        <Field label="Guest">
          {c.isGuest ? (
            <select
              required
              value={guestId}
              disabled
              onChange={(e) => setGuestId(e.target.value)}
            >
              {c.guests.filter((g) => g.id === c.session.guestId).map((g) => (
                <option key={g.id} value={g.id}>
                  {fullName(g)} · {g.email}
                </option>
              ))}
            </select>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  required
                  value={guestId}
                  onChange={(e) => setGuestId(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Select a guest...</option>
                  {c.guests.map((g) => (
                    <option key={g.id} value={g.id}>
                      {fullName(g)} · {g.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowGuestSearch(!showGuestSearch)}
                  title="Search guests"
                >
                  <Search size={18} />
                </button>
              </div>
              {showGuestSearch && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '12px',
                    border: '1px solid #dfe4dc',
                    borderRadius: '6px',
                    backgroundColor: '#fafbf8',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      placeholder="Search by name, email, or phone..."
                      value={guestSearch}
                      onChange={(e) => setGuestSearch(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #dfe4dc',
                    borderRadius: '4px',
                      }}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => {
                        setShowGuestSearch(false);
                        setGuestSearch('');
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div
                    style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {filteredGuests.length === 0 ? (
                      <p style={{ color: '#9a9f98', fontSize: '12px', textAlign: 'center' }}>
                        No guests found
                      </p>
                    ) : (
                      filteredGuests.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setGuestId(g.id);
                            setShowGuestSearch(false);
                            setGuestSearch('');
                          }}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #e8ebe5',
                            borderRadius: '4px',
                            backgroundColor: 'white',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'background 0.18s',
                          }}
                          onMouseEnter={(e) => (e.target.style.backgroundColor = '#f2f5ef')}
                          onMouseLeave={(e) => (e.target.style.backgroundColor = 'white')}
                        >
                          <div style={{ fontWeight: '500', fontSize: '12px' }}>{fullName(g)}</div>
                          <div style={{ fontSize: '11px', color: '#7d897e' }}>{g.email}</div>
                          <div style={{ fontSize: '10px', color: '#9ba18f' }}>{g.phone}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              {selectedGuest && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#f0f3ea',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}
                >
                  <strong>Selected:</strong> {fullName(selectedGuest)} · {selectedGuest.email} ·{' '}
                  {selectedGuest.phone}
                </div>
              )}
            </>
          )}
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
