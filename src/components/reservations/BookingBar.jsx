import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Users } from 'lucide-react';
import { day } from '../../data';

export default function BookingBar({ roomType }) {
  const navigate = useNavigate();
  const [start, setStart] = useState(day());
  const [end, setEnd] = useState(day(2));
  const [guests, setGuests] = useState(roomType === 'Single' ? 1 : 2);
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    if (end <= start) return setError('Check-out must be after check-in.');
    const params = new URLSearchParams({
      start,
      end,
      guests,
      ...(roomType ? { type: roomType } : {}),
    });
    navigate(`/search?${params}`);
  }
  return (
    <form className="hotel-booking-bar" onSubmit={submit}>
      <div className="booking-bar-intro">
        <span>YOUR NEXT CHAPTER</span>
        <strong>Stay a little.</strong>
      </div>
      <label>
        <span>
          <CalendarDays size={14} />
          Check-in
        </span>
        <input
          aria-label="Check-in date"
          required
          type="date"
          min={day()}
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setError('');
          }}
        />
      </label>
      <label>
        <span>
          <CalendarDays size={14} />
          Check-out
        </span>
        <input
          aria-label="Check-out date"
          required
          type="date"
          min={start}
          value={end}
          onChange={(e) => {
            setEnd(e.target.value);
            setError('');
          }}
        />
      </label>
      <label>
        <span>
          <Users size={14} />
          Guests
        </span>
        <select
          aria-label="Number of guests"
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} guest{n > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </label>
      <button className="button primary">
        Find your room
        <ArrowRight size={17} />
      </button>
      {error && (
        <p className="booking-bar-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
