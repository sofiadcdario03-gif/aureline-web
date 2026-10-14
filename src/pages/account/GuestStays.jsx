import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Users, BedDouble, Settings } from 'lucide-react';
import { useHotel } from '../../context/HotelContext';
import { dateLabel, nights, money } from '../../data';
import Badge from '../../components/ui/Badge';
import Empty from '../../components/ui/Empty';

export default function GuestStays() {
  const hotel = useHotel();
  const [filter, setFilter] = useState('All stays');
  const { session, visibleBookings, room, setModal, total, paymentStatus } = hotel;

  const getFilterCount = (filterType) => {
    return visibleBookings.filter((booking) => {
      switch (filterType) {
        case 'All stays':
          return true;
        case 'Upcoming':
          return ['Pending', 'Confirmed'].includes(booking.status);
        case 'Current stay':
          return booking.status === 'Checked-in';
        case 'Past stays':
          return booking.status === 'Checked-out';
        case 'Cancelled':
          return booking.status === 'Cancelled';
        default:
          return false;
      }
    }).length;
  };

  const rows = visibleBookings.filter(
    (booking) =>
      filter === 'All stays' ||
      (filter === 'Upcoming' && ['Pending', 'Confirmed'].includes(booking.status)) ||
      (filter === 'Current stay' && booking.status === 'Checked-in') ||
      (filter === 'Past stays' && booking.status === 'Checked-out') ||
      (filter === 'Cancelled' && booking.status === 'Cancelled'),
  );
  return (
    <>
      <div className="guest-welcome">
        <div>
          <div className="eyebrow">YOUR AURELINE JOURNAL</div>
          <h1>Welcome back, {session.name.split(' ')[0]}.</h1>
          <p>Your escapes, your memories, your next chapter.</p>
        </div>
        <Link className="button secondary" to="/profile">
          <Settings size={15} />
          My profile
        </Link>
      </div>
      <section className="guest-stays-banner">
        <div>
          <span>THERE’S ALWAYS ANOTHER STORY</span>
          <h2>
            Somewhere lovely
            <br />
            to look forward to.
          </h2>
        </div>
        <Link className="button secondary" to="/search">
          Plan a new stay
          <ArrowRight size={17} />
        </Link>
      </section>
      <div className="stay-filter-tabs" role="group" aria-label="Filter your stays">
        {['All stays', 'Upcoming', 'Current stay', 'Past stays', 'Cancelled'].map((tab) => {
          const count = getFilterCount(tab);
          return (
            <button
              key={tab}
              className={filter === tab ? 'selected' : ''}
              onClick={() => setFilter(tab)}
            >
              {tab}
              {count > 0 && <span className="filter-badge">{count}</span>}
            </button>
          );
        })}
      </div>
      <div className="guest-stay-list">
        {rows.map((booking) => {
          const bookedRoom = room(booking.roomId);
          return (
            <article className="guest-stay-card" key={booking.id}>
              <img src={bookedRoom?.image} alt={`${bookedRoom?.type} room`} />
              <div className="guest-stay-content">
                <div className="guest-stay-top">
                  <span>{booking.id}</span>
                  <Badge>{booking.status}</Badge>
                </div>
                <h3>
                  {bookedRoom?.type === 'Suite'
                    ? 'The Aureline Suite'
                    : `${bookedRoom?.type} retreat`}
                </h3>
                <div className="guest-stay-meta">
                  <span>
                    <CalendarDays size={15} />
                    {dateLabel(booking.checkIn, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    –{' '}
                    {dateLabel(booking.checkOut, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span>
                    <Users size={15} />
                    {booking.guests} guests
                  </span>
                  <span>
                    <BedDouble size={15} />
                    Room {bookedRoom?.number}
                  </span>
                </div>
                <div className="guest-stay-bottom">
                  <div>
                    <strong>{money(total(booking))}</strong>
                    <span>
                      {nights(booking.checkIn, booking.checkOut)} nights · {paymentStatus(booking)}
                    </span>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setModal({ type: 'booking', item: booking })}
                  >
                    View stay
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <div className="guest-empty">
          <Empty
            text="Your next story is waiting."
            detail="No reservations in this view. Find a room and make yourself at home."
          />
          <Link className="button primary" to="/search">
            Explore available rooms
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </>
  );
}
