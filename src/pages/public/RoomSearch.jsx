import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Leaf } from 'lucide-react';
import { day, nights, photos } from '../../data';
import api from '../../services/api';
import { readStaySearch } from '../../utils/searchParams';
import Empty from '../../components/ui/Empty';
import Field from '../../components/ui/Field';
import PageHeading from '../../components/ui/PageHeading';
import RoomCard from '../../components/rooms/RoomCard';

export default function RoomSearch(hotel) {
  const [params, setParams] = useSearchParams();
  const query = readStaySearch(params);
  const [start, setStart] = useState(query?.start || day());
  const [end, setEnd] = useState(query?.end || day(2));
  const [count, setCount] = useState(query?.count || 2);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const types = ['All rooms', 'Single', 'Double', 'Deluxe', 'Suite'];
  const type = types.includes(params.get('type')) ? params.get('type') : 'All rooms';
  useEffect(() => {
    const selection = readStaySearch(params);
    if (selection) {
      setStart(selection.start);
      setEnd(selection.end);
      setCount(selection.count);
    }
    setError('');
  }, [params]);
  useEffect(() => {
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    setResults([]);
    setLoading(true);
    api
      .get('/rooms', {
        params: {
          checkIn: query.start,
          checkOut: query.end,
          guests: query.count,
          ...(type !== 'All rooms' ? { type } : {}),
        },
      })
      .then(({ data }) => {
        if (active) setResults(data);
      })
      .catch((requestError) => {
        if (!active) return;
        setResults([]);
        setError(requestError.response?.data?.error || 'Room availability could not be checked.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query?.start, query?.end, query?.count, type]);

  function search(event) {
    event.preventDefault();
    const next = new URLSearchParams({ start, end, guests: count, type });
    if (!readStaySearch(next))
      return setError('Choose valid future dates with check-out after check-in.');
    setError('');
    setParams(next);
  }
  function reserve(room) {
    if (!hotel.session) {
      hotel.navigate(`/login?redirect=${encodeURIComponent(`/search?${params}`)}`);
      return;
    }
    hotel.setModal({ type: 'reserve', item: room, query });
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Find your kind of quiet."
        description="A beautiful room. A slower morning. A stay to remember."
      />
      <div
        className="search-hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(24,43,35,.78),rgba(24,43,35,.05)),url('${photos.double}')`,
        }}
      >
        <span>ROOM TO REST. SPACE TO RECONNECT.</span>
        <h2>
          Your next chapter
          <br />
          begins here.
        </h2>
      </div>
      <form className="booking-search panel" onSubmit={search}>
        <Field label="Check-in">
          <input
            required
            type="date"
            min={day()}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="Check-out">
          <input
            required
            type="date"
            min={start}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
        <Field label="Guests">
          <select value={count} onChange={(e) => setCount(e.target.value)}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} guest{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </Field>
        <button className="button primary">
          <Search size={18} />
          Find available rooms
        </button>
        {error && (
          <p className="form-error search-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {query ? (
        <>
          <div className="results-heading">
            <span>
              <strong>{loading ? 'Checking' : results.length} rooms</strong> for your{' '}
              {nights(query.start, query.end)}-night stay · {query.start} → {query.end}
            </span>
            <select
              aria-label="Filter room types"
              value={type}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set('type', e.target.value);
                setParams(next);
              }}
            >
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="room-grid">
            {results.map((room) => (
              <RoomCard
                r={room}
                key={room.id}
                booking
                status="Available"
                onClick={() => reserve(room)}
              />
            ))}
          </div>
          {!loading && !results.length && (
            <Empty
              text="A different date, perhaps?"
              detail="No rooms are available for this selection. Try another date or guest count."
            />
          )}
        </>
      ) : (
        <div className="search-intro">
          <Leaf size={25} />
          <h3>Good things are worth staying for.</h3>
          <p>Choose your dates to explore our available rooms.</p>
          <div>
            <span>Complimentary Wi-Fi</span>
            <span>Thoughtful amenities</span>
            <span>Warm, personal service</span>
          </div>
        </div>
      )}
    </>
  );
}
