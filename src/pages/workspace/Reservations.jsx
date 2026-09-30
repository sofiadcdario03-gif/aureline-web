import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { fullName } from '../../utils/formatters.js';
import PageHeading from '../../components/ui/PageHeading.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import BookingTable from '../../components/reservations/BookingTable.jsx';

export default function Reservations(c) {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('All statuses'),
    [page, setPage] = useState(1);
  const filtered = c.visibleBookings.filter(
    (b) =>
      (status === 'All statuses' || b.status === status) &&
      (b.id + fullName(c.guest(b.guestId)) + c.room(b.roomId)?.number)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="EVERY STAY STARTS HERE"
        title={c.isGuest ? 'My reservations' : 'Reservations'}
        description="A considered welcome, from the very first booking."
      >
        <button className="button primary" onClick={() => c.navigate('/search')}>
          <Plus size={17} />
          New reservation
        </button>
      </PageHeading>
      <div className="summary-row">
        {['All reservations', 'Pending', 'Confirmed', 'Checked-in', 'Checked-out'].map((s) => (
          <button
            key={s}
            className={
              status === (s === 'All reservations' ? 'All statuses' : s)
                ? 'summary-item selected'
                : 'summary-item'
            }
            onClick={() => {
              setStatus(s === 'All reservations' ? 'All statuses' : s);
              setPage(1);
            }}
          >
            <span>{s}</span>
            <strong>
              {c.visibleBookings.filter((b) => s === 'All reservations' || b.status === s).length}
            </strong>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="filter-bar">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name, reservation, or room..."
          />
          <select
            aria-label="Filter reservation status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {['All statuses', 'Pending', 'Confirmed', 'Checked-in', 'Checked-out', 'Cancelled'].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
          <span className="filter-count">{filtered.length} reservations</span>
        </div>
        <BookingTable {...c} rows={filtered.slice((page - 1) * 8, page * 8)} />
        <div className="table-bottom">
          <span>
            Showing {filtered.length ? (page - 1) * 8 + 1 : 0}–{Math.min(page * 8, filtered.length)}{' '}
            of {filtered.length}
          </span>
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span>{page}</span>
            <button
              disabled={page * 8 >= filtered.length}
              onClick={() => setPage(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
