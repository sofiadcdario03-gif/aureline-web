import React, { useState } from 'react';
import { Wallet, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react';
import { money } from '../../data.js';
import { fullName } from '../../utils/formatters.js';
import Badge from '../../components/ui/Badge.jsx';
import Empty from '../../components/ui/Empty.jsx';
import PageHeading from '../../components/ui/PageHeading.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';

export default function Billing(c) {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('All payments');
  const rows = c.bookings.filter(
    (b) =>
      b.status !== 'Cancelled' &&
      (status === 'All payments' || c.paymentStatus(b) === status) &&
      (b.id + fullName(c.guest(b.guestId))).toLowerCase().includes(search.toLowerCase()),
  );
  const collectible = c.bookings
    .filter((b) => b.status !== 'Cancelled')
    .reduce((s, b) => s + Math.max(0, c.total(b) - c.paid(b)), 0);
  return (
    <>
      <PageHeading
        eyebrow="THE FINISHING TOUCHES"
        title="Payments & billing"
        description="Clear accounts. Seamless stays."
      />
      <div className="billing-stats">
        <div className="panel">
          <Wallet size={22} />
          <span>Total collected</span>
          <strong>{money(c.payments.reduce((s, p) => s + p.amount, 0))}</strong>
        </div>
        <div className="panel">
          <Clock size={22} />
          <span>Outstanding balance</span>
          <strong>{money(collectible)}</strong>
        </div>
        <div className="panel">
          <CheckCircle2 size={22} />
          <span>Paid reservations</span>
          <strong>{c.bookings.filter((b) => c.paymentStatus(b) === 'Paid').length}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="filter-bar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search guest or reservation..."
          />
          <select
            aria-label="Payment status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {['All payments', 'Unpaid', 'Partially paid', 'Paid'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Guest / Reservation</th>
                <th>Total amount</th>
                <th>Amount paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{fullName(c.guest(b.guestId))}</strong>
                    <small>{b.id}</small>
                  </td>
                  <td>{money(c.total(b))}</td>
                  <td>{money(c.paid(b))}</td>
                  <td>{money(Math.max(0, c.total(b) - c.paid(b)))}</td>
                  <td>
                    <Badge>{c.paymentStatus(b)}</Badge>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => c.setModal({ type: 'payment', item: b })}
                    >
                      {c.paymentStatus(b) === 'Paid' ? 'View receipt' : 'Record payment'}
                      <ArrowUpRight size={14} />
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
