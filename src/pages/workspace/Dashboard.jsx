import React, { useState } from 'react';
import {
  CalendarDays,
  BedDouble,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ArrowDownLeft,
  Leaf,
  Sun,
  CheckCircle2,
  ClipboardList,
  Users,
  Wrench,
} from 'lucide-react';
import { day, dateLabel, photos } from '../../data.js';
import { isActiveReservation as active } from '../../reservationRules.js';
import PageHeading from '../../components/ui/PageHeading.jsx';
import BookingTable from '../../components/reservations/BookingTable.jsx';

export default function Dashboard(c) {
  const { rooms, guests, visibleBookings, isGuest, session, roomStatus, navigate } = c;
  const [tab, setTab] = useState('All reservations');
  const occupied = rooms.filter((r) => roomStatus(r) === 'Occupied').length;
  const available = rooms.filter((r) => roomStatus(r) === 'Available').length;
  const maintenance = rooms.filter((r) => r.status === 'Maintenance').length;
  const arrivals = visibleBookings.filter((b) => b.checkIn === day() && active(b));
  const departures = visibleBookings.filter(
    (b) => b.checkOut === day() && b.status === 'Checked-in',
  );
  const pending = visibleBookings.filter((b) => b.status === 'Pending');
  const todaysReservations = visibleBookings.filter((b) => {
    if (!b.createdAt) return false;
    const createdDate = b.createdAt.split('T')[0]; // Extract date part if timestamp is included
    return createdDate === day();
  });
  const rows =
    tab === 'Arrivals'
      ? arrivals
      : tab === 'Departures'
        ? departures
        : tab === 'Pending'
          ? pending
          : visibleBookings;
  const stats = isGuest
    ? [
        ['My reservations', visibleBookings.length, CalendarDays, 'Your stays, all in one place'],
        [
          'Upcoming stay',
          visibleBookings.filter((b) => b.checkIn >= day() && active(b)).length,
          ArrowDownLeft,
          'Something to look forward to',
        ],
        [
          'Current reservation',
          visibleBookings.filter((b) => b.status === 'Checked-in').length,
          BedDouble,
          'Make yourself at home',
        ],
        [
          'Past reservations',
          visibleBookings.filter((b) => b.status === 'Checked-out').length,
          CheckCircle2,
          'Memories worth keeping',
        ],
      ]
    : c.role === 'Front Desk'
      ? [
          ['Available rooms', available, CheckCircle2, 'Ready for a warm welcome'],
          ['Occupied rooms', occupied, BedDouble, 'Guests currently in house'],
          [
            "Today's check-ins",
            arrivals.length,
            ArrowDownLeft,
            `${arrivals.filter((b) => b.status === 'Checked-in').length} checked in so far`,
          ],
          ["Today's check-outs", departures.length, ArrowUpRight, "Let's make the goodbye lovely"],
          [
            "Today's reservations",
            todaysReservations.length,
            CalendarDays,
            'Bookings created today',
          ],
          ['Pending reservations', pending.length, ClipboardList, 'Awaiting confirmation'],
        ]
      : [
          ['Total rooms', rooms.length, BedDouble, `${maintenance} rooms under maintenance`],
          ['Available rooms', available, CheckCircle2, 'Ready for a warm welcome'],
          ['Occupied rooms', occupied, BedDouble, 'Guests currently in house'],
          ['Maintenance rooms', maintenance, Wrench, 'Temporarily out of service'],
          ["Today's bookings", todaysReservations.length, CalendarDays, 'Bookings created today'],
          [
            "Today's check-ins",
            arrivals.length,
            ArrowDownLeft,
            `${arrivals.filter((b) => b.status === 'Checked-in').length} checked in so far`,
          ],
          ["Today's check-outs", departures.length, ArrowUpRight, "Let's make the goodbye lovely"],
          ['Total guests', guests.length, Users, 'Guest records in the system'],
        ];
  return (
    <>
      <PageHeading
        title={`A lovely day to ${isGuest ? 'stay' : 'host'}, ${session.name.split(' ')[0]}.`}
        description={
          isGuest
            ? 'Your next beautiful stay starts here.'
            : "Here's what's happening at Aureline Hotel today."
        }
      >
        <div className="date-pill">
          <CalendarDays size={16} />
          {dateLabel(day(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <button className="button primary" onClick={() => navigate('/search')}>
          <Plus size={17} />
          New reservation
        </button>
      </PageHeading>
      <section
        className="hero-banner"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(20,37,31,.87) 0%,rgba(20,37,31,.60) 42%,rgba(20,37,31,.02) 100%),url('${photos.hero}')`,
        }}
      >
        <div className="hero-copy">
          <div className="hero-overline">
            <span /> THE ART OF A WELCOMING STAY
          </div>
          <h2>
            Every stay, a story.
            <br />
            Make this one exceptional.
          </h2>
          <p>
            A little attention. A thoughtful detail.
            <br />
            That's the Aureline difference.
          </p>
          <button onClick={() => navigate(isGuest ? '/search' : '/rooms')}>
            Explore our rooms <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="hero-caption">
          <span className="hero-caption-line" />
          <span>
            THE AURELINE COLLECTION<small>Considered comfort. Timeless charm.</small>
          </span>
        </div>
        <span className="hero-count">
          01 <span>/ 04</span>
        </span>
      </section>
      <section className="stats-grid">
        {stats.map(([label, value, Icon, detail], i) => (
          <div className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <div className={`stat-icon stat-icon-${i % 4}`}>
                <Icon size={19} />
              </div>
            </div>
            <div className="stat-value">
              {String(value).padStart(2, '0')}
              <span>{i === 0 && c.role === 'Admin' ? 'across 4 room types' : ''}</span>
            </div>
            <div className="stat-detail">
              <span className={`mini-dot dot-${i % 4}`} />
              {detail}
            </div>
          </div>
        ))}
      </section>
      <div className="dashboard-columns">
        <section className="panel reservations-panel">
          <div className="panel-heading">
            <div>
              <h2>{isGuest ? 'Your reservations' : 'Reservation activity'}</h2>
              <p>
                {isGuest
                  ? 'A home away from home, whenever you need it.'
                  : 'Every arrival is the beginning of something good.'}
              </p>
            </div>
            <button className="text-button" onClick={() => navigate('/reservations')}>
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="tabs">
            {['All reservations', 'Arrivals', 'Departures', 'Pending'].map((t) => (
              <button className={t === tab ? 'selected' : ''} onClick={() => setTab(t)} key={t}>
                {t}
                {t === 'Arrivals' && <span>{arrivals.length}</span>}
                {t === 'Pending' && <span>{pending.length}</span>}
              </button>
            ))}
          </div>
          <BookingTable {...c} rows={rows.slice(0, 5)} compact />
          <div className="table-bottom">
            <span>
              Showing {Math.min(rows.length, 5)} of {rows.length} reservations
            </span>
            <span className="updated-dot">
              <span className="live-dot" /> Live overview
            </span>
          </div>
        </section>
        <aside className="dashboard-side">
          <section className="panel occupancy-panel">
            <div className="panel-heading">
              <h2>{isGuest ? 'Your next escape' : 'Room overview'}</h2>
              <BedDouble size={18} />
            </div>
            {isGuest ? (
              <div className="guest-escape">
                <Leaf size={30} />
                <h3>Stay a little longer.</h3>
                <p>Find your quiet corner in the city.</p>
                <button className="button primary" onClick={() => navigate('/search')}>
                  Discover rooms <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <>
                <div
                  className="occupancy-ring"
                  style={{
                    '--occupied': `${(occupied / rooms.length) * 100 || 0}%`,
                    '--reserved': `${
                      (rooms.filter((r) => roomStatus(r) === 'Reserved').length / rooms.length) *
                        100 +
                        (occupied / rooms.length) * 100 || 0
                    }%`,
                    '--available': `${100 - (maintenance / rooms.length) * 100 || 0}%`,
                  }}
                >
                  <div>
                    <strong>
                      {Math.round((occupied / rooms.length) * 100) || 0}
                      <small>%</small>
                    </strong>
                    <span>Occupancy today</span>
                  </div>
                </div>
                <div className="occupancy-legend">
                  {[
                    ['Occupied', 'green'],
                    ['Available', 'light-green'],
                    ['Reserved', 'gold'],
                    ['Maintenance', 'gray'],
                  ].map(([s, color]) => (
                    <div key={s}>
                      <span>
                        <i className={color} />
                        {s}
                      </span>
                      <strong>
                        {rooms.filter((r) => roomStatus(r) === s).length}
                        <small> rooms</small>
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
          <section className="note-card">
            <Sun size={23} />
            <div>
              <span>A THOUGHT FOR TODAY</span>
              <p>
                "Hospitality is simply an
                <br />
                opportunity to show love
                <br />
                and care."
              </p>
              <small>Make someone feel at home.</small>
            </div>
          </section>
        </aside>
      </div>
      <section className="bottom-strip">
        <div className="bottom-strip-icon">
          <Leaf size={22} />
        </div>
        <div>
          <h3>Good hospitality is in the details.</h3>
          <p>
            {isGuest
              ? 'Your comfort is our favorite detail.'
              : 'A smooth check-in. A remembered name. A room that feels just right.'}
          </p>
        </div>
        <span>
          AURELINE HOTEL <span>*</span>
        </span>
      </section>
    </>
  );
}
