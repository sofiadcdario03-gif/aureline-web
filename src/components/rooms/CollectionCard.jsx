import { Link } from 'react-router-dom';
import { ArrowUpRight, Users, Maximize2 } from 'lucide-react';
import { money } from '../../data';
import { useHotel } from '../../context/HotelContext';

export default function CollectionCard({ collection }) {
  const { rooms } = useHotel();
  const matches = rooms.filter((room) => room.type === collection.type);
  const price = matches.length ? Math.min(...matches.map((room) => room.price)) : null;
  const capacity = matches.length ? Math.max(...matches.map((room) => room.capacity)) : null;
  return (
    <article className="collection-card">
      <Link className="collection-image" to={`/stay/${collection.type.toLowerCase()}`}>
        <img src={collection.image} alt={collection.name} loading="lazy" />
        <span>{collection.type.toUpperCase()}</span>
      </Link>
      <div className="collection-body">
        <div className="collection-heading">
          <h3>
            <Link to={`/stay/${collection.type.toLowerCase()}`}>{collection.name}</Link>
          </h3>
          <ArrowUpRight size={20} />
        </div>
        <p>{collection.subtitle}</p>
        <div className="collection-meta">
          <span>
            <Users size={14} />
            Up to {capacity ?? '—'} guests
          </span>
          <span>
            <Maximize2 size={13} />
            {collection.size}
          </span>
        </div>
        <div className="collection-bottom">
          <span>
            {price ? (
              <>
                <small>From </small>
                <strong>{money(price)}</strong>
                <small> / night</small>
              </>
            ) : (
              'Enquire for availability'
            )}
          </span>
          <Link to={`/stay/${collection.type.toLowerCase()}`}>
            Explore room
            <ArrowRightSmall />
          </Link>
        </div>
      </div>
    </article>
  );
}
function ArrowRightSmall() {
  return <span aria-hidden="true">→</span>;
}
