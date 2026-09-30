import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { day, dateLabel } from '../../data.js';
import Empty from '../../components/ui/Empty.jsx';
import PageHeading from '../../components/ui/PageHeading.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import RoomCard from '../../components/rooms/RoomCard.jsx';

export default function Rooms(c) {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('All statuses'),
    [type, setType] = useState('All types'),
    [date, setDate] = useState(day());
  const filtered = c.rooms.filter(
    (r) =>
      (r.number + r.type).toLowerCase().includes(search.toLowerCase()) &&
      (type === 'All types' || r.type === type) &&
      (status === 'All statuses' || c.roomStatus(r, date) === status),
  );
  return (
    <>
      <PageHeading
        eyebrow="THE AURELINE COLLECTION"
        title="A space for every story."
        description="Considered comfort, down to the very last detail."
      >
        {c.role === 'Admin' && (
          <button className="button primary" onClick={() => c.setModal({ type: 'roomForm' })}>
            <Plus size={17} />
            Add room
          </button>
        )}
      </PageHeading>
      <div className="filter-bar panel room-filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Search rooms..." />
        <select aria-label="Room type" value={type} onChange={(e) => setType(e.target.value)}>
          {['All types', 'Single', 'Double', 'Deluxe', 'Suite'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Room status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {['All statuses', 'Available', 'Reserved', 'Occupied', 'Maintenance'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          aria-label="Room status date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || day())}
        />
      </div>
      <div className="results-heading">
        <span>{filtered.length} thoughtfully appointed rooms</span>
        <span>Status for {dateLabel(date)}</span>
      </div>
      <div className="room-grid">
        {filtered.map((r) => (
          <RoomCard
            key={r.id}
            r={r}
            status={c.roomStatus(r, date)}
            onClick={() => c.setModal({ type: 'room', item: r })}
          />
        ))}
      </div>
      {!filtered.length && <Empty text="No rooms match your filters" />}
    </>
  );
}
