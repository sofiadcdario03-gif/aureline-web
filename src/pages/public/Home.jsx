import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Leaf, Wifi, Coffee, Waves } from 'lucide-react';
import BookingBar from '../../components/reservations/BookingBar';
import CollectionCard from '../../components/rooms/CollectionCard';
import { hotelImages, roomCollection, experiences } from '../../data/hotelContent';

export default function Home() {
  return (
    <>
      <section
        className="hotel-hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(19,39,32,.67),rgba(19,39,32,.1)),url('${hotelImages.exterior}')`,
        }}
      >
        <div className="hotel-hero-copy">
          <div className="eyebrow">
            <span />
            AURELINE HOTEL
          </div>
          <h1>Aureline Hotel</h1>
          <p>
            Find a softer rhythm near the heart of Sorsogon.
            <br />
            Stay longer and enjoy exclusive room offers.
          </p>
          <Link to="/stay" className="hero-link">
            Discover Aureline
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="hotel-hero-side">CONSIDERED COMFORT - TIMELESS CHARM</div>
        <span className="hotel-hero-bottom">
          AURELINE HOTEL <span>*</span> THOUGHTFULLY HOSTED
        </span>
      </section>
      <div className="hotel-booking-wrap">
        <BookingBar />
      </div>
      <section className="hotel-intro hotel-section">
        <div>
          <div className="eyebrow">WELCOME TO AURELINE HOTEL</div>
          <h2>
            A calmer side of Sorsogon.
            <br />
            <em>A place to feel.</em>
          </h2>
        </div>
        <div>
          <p>
            There is a certain kind of comfort in the things done well. Soft linen. Warm light.
            Someone who remembers your name.
          </p>
          <p>
            At Aureline, we make room for those little moments. A considered collection of rooms,
            spaces to unwind, and hospitality shaped by Sorsogon's easy coastal warmth.
          </p>
          <Link className="hotel-text-link" to="/experiences">
            The Aureline experience <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <div className="hotel-amenity-strip">
        {[
          [Wifi, 'Stay connected', 'Complimentary Wi-Fi'],
          [Coffee, 'Mornings, made better', 'Breakfast offers'],
          [Waves, 'Sorsogon escapes', 'City and coastal access'],
          [Leaf, 'Save on stays', 'Up to 15% off'],
        ].map(([Icon, title, detail]) => (
          <div key={title}>
            <Icon size={23} strokeWidth={1.3} />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </div>
        ))}
      </div>
      <section className="hotel-offers">
        <div>
          <span>LIMITED OFFERS</span>
          <h2>Stay a little longer in Sorsogon.</h2>
        </div>
        <div className="offer-grid">
          <article>
            <strong>15% off suites</strong>
            <p>Book two nights or more in Deluxe or Suite rooms.</p>
          </article>
          <article>
            <strong>10% weekday escape</strong>
            <p>Save on Sunday to Thursday stays, subject to room availability.</p>
          </article>
          <article>
            <strong>Breakfast bundle</strong>
            <p>Add breakfast for two at a special front desk rate.</p>
          </article>
        </div>
      </section>
      <section className="hotel-section collection-section">
        <div className="hotel-section-heading">
          <div>
            <div className="eyebrow">THE AURELINE COLLECTION</div>
            <h2>Your own little retreat.</h2>
            <p>Four ways to settle in. One feeling of being right where you belong.</p>
          </div>
          <Link className="hotel-text-link" to="/stay">
            All rooms & suites
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="collection-grid">
          {roomCollection.slice(1).map((room) => (
            <CollectionCard collection={room} key={room.type} />
          ))}
        </div>
      </section>
      <section className="hotel-experience-feature">
        <img
          src={hotelImages.dining}
          alt="An intimate restaurant with a beautifully set table"
          loading="lazy"
        />
        <div>
          <div className="eyebrow">SAVOR THE SLOW MOMENTS</div>
          <h2>
            A little less rushing.
            <br />
            <em>A little more living.</em>
          </h2>
          <p>
            A leisurely breakfast. An afternoon by the water. Conversations that last a little
            longer. Sometimes, the best part of a stay is simply having time.
          </p>
          <Link className="hotel-text-link" to="/experiences">
            Explore the experience
            <ArrowUpRight size={17} />
          </Link>
          <span className="feature-flower">*</span>
        </div>
      </section>
      <section className="hotel-section">
        <div className="hotel-section-heading">
          <div>
            <div className="eyebrow">MAKE YOUR STAY YOUR OWN</div>
            <h2>More than a room key.</h2>
          </div>
          <p>
            A few good reasons
            <br />
            to stay a little longer.
          </p>
        </div>
        <div className="experience-preview-grid">
          {experiences.map((experience) => (
            <Link
              to={`/experiences#${experience.id}`}
              className="experience-preview"
              key={experience.id}
            >
              <img src={experience.image} alt={experience.title} loading="lazy" />
              <div>
                <span>{experience.label}</span>
                <h3>
                  {experience.title}
                  <ArrowUpRight size={20} />
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="hotel-invitation">
        <Leaf size={28} strokeWidth={1} />
        <div className="eyebrow">YOUR ROOM IS WAITING</div>
        <h2>
          Come for a stay.
          <br />
          <em>Leave with a story.</em>
        </h2>
        <Link className="button primary" to="/search">
          Plan your stay
          <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
