import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { fullName, initials } from '../../utils/formatters.js';
import Empty from '../../components/ui/Empty.jsx';
import PageHeading from '../../components/ui/PageHeading.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';

export default function Guests(c) {
  const [search, setSearch] = useState('');
  const rows = c.guests.filter((g) =>
    (fullName(g) + g.email + g.phone).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="PEOPLE, NOT JUST RESERVATIONS"
        title="Our guests"
        description="Remember the names. Take care of the details."
      />
      <section className="panel">
        <div className="filter-bar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search guests by name, email, or phone..."
          />
          <span className="filter-count">{rows.length} guests</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Contact details</th>
                <th>Location</th>
                <th>Reservations</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((g, i) => (
                <tr key={g.id}>
                  <td>
                    <button
                      className="guest-cell"
                      onClick={() => c.setModal({ type: 'guest', item: g })}
                    >
                      <span className={`avatar avatar-${i % 4}`}>{initials(fullName(g))}</span>
                      <span>
                        <strong>{fullName(g)}</strong>
                        <small>{g.id}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {g.email}
                    <small>{g.phone}</small>
                  </td>
                  <td>{g.address}</td>
                  <td>{c.bookings.filter((b) => b.guestId === g.id).length} stays</td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`View ${fullName(g)}`}
                      onClick={() => c.setModal({ type: 'guest', item: g })}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty />}
      </section>
    </>
  );
}
