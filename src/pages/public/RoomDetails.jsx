import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Users, Maximize2, BedDouble } from 'lucide-react';
import { useHotel } from '../../context/HotelContext';
import { roomCollection } from '../../data/hotelContent';
import { money } from '../../data';
import BookingBar from '../../components/reservations/BookingBar';

export default function RoomDetails() {
  const { type } = useParams();
  const { rooms } = useHotel();
  const collection = roomCollection.find((room) => room.type.toLowerCase() === type);
  if (!collection) return <Navigate to="/stay" replace />;
  const matches = rooms.filter((room) => room.type === collection.type);
  const price = matches.length ? Math.min(...matches.map((room) => room.price)) : null;
  return (
    <>
      <Link className="hotel-text-link" to="/stay">
        <ArrowLeft size={15} />
        All rooms & suites
      </Link>
      <div className="room-detail-title">
        <div>
          <div className="eyebrow">YOUR PERSONAL RETREAT</div>
          <h1>{collection.name}</h1>
          <p>{collection.subtitle}</p>
        </div>
        {price && (
          <div>
            <small>FROM</small>
            <strong>
              {money(price)}
              <span> / night</span>
            </strong>
          </div>
        )}
      </div>
      <img className="room-detail-photo" src={collection.image} alt={collection.name} />
      <div className="room-detail-body">
        <div>
          <h2>Settle in. Slow down.</h2>
          <p>{collection.description}</p>
          <div className="room-detail-meta">
            <span>
              <Users size={17} />
              Up to {matches.length ? Math.max(...matches.map((room) => room.capacity)) : '—'}{' '}
              guests
            </span>
            <span>
              <Maximize2 size={17} />
              {collection.size}
            </span>
            <span>
              <BedDouble size={18} />
              {collection.bed}
            </span>
          </div>
        </div>
        <div>
          <h3>Considered comforts</h3>
          <div className="room-amenities">
            {[
              'Complimentary Wi-Fi',
              'Air conditioning',
              'Premium bed linen',
              'Daily housekeeping',
              'En-suite bathroom',
              'Tea & coffee facilities',
            ].map((amenity) => (
              <span key={amenity}>
                <Check size={14} />
                {amenity}
              </span>
            ))}
          </div>
        </div>
      </div>
      <BookingBar roomType={collection.type} />
    </>
  );
}
