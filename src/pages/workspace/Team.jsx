import React, { useState } from 'react';
import { Plus, ShieldCheck, Pencil } from 'lucide-react';
import { initials } from '../../utils/formatters.js';
import Badge from '../../components/ui/Badge.jsx';
import Empty from '../../components/ui/Empty.jsx';
import PageHeading from '../../components/ui/PageHeading.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';

export default function Team(c) {
  const [search, setSearch] = useState('');
  const filtered = c.staff.filter((s) =>
    (s.name + s.email + s.id).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="THE PEOPLE BEHIND THE WELCOME"
        title="Our team"
        description="Great hospitality starts with a great team."
      >
        <button className="button primary" onClick={() => c.setModal({ type: 'staffForm' })}>
          <Plus size={17} />
          Add staff member
        </button>
      </PageHeading>
      <section className="panel">
        <div className="filter-bar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search team members..." />
          <span className="filter-count">{filtered.length} team members</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <div className="guest-cell">
                      <span className={`avatar avatar-${i % 4}`}>{initials(s.name)}</span>
                      <span>
                        <strong>{s.name}</strong>
                        <small>{s.id}</small>
                      </span>
                    </div>
                  </td>
                  <td>{s.email}</td>
                  <td>{s.role}</td>
                  <td>
                    <Badge>{s.status}</Badge>
                  </td>
                  <td>
                    {s.role !== 'Admin' && (
                      <button
                        className="icon-button"
                        aria-label={`Edit ${s.name}`}
                        onClick={() => c.setModal({ type: 'staffForm', item: s })}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <Empty />}
      </section>
      <p className="info-note">
        <ShieldCheck size={16} />
        Staff accounts are managed by the administrator. Active staff can access the workspace from
        the shared sign-in page.
      </p>
    </>
  );
}
