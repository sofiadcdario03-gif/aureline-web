import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bus,
  CalendarDays,
  Car,
  Clock,
  Gift,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Plane,
  Star,
} from 'lucide-react';
import { hotelImages, stayFAQs } from '../../data/hotelContent';

const contactDetails = [
  ['Address', 'Rizal Street, Sorsogon City, Philippines', MapPin],
  ['Reservations', '+63 917 842 7365', Phone],
  ['Email', 'reservations@aureline.hotel', Mail],
];

const directions = [
  {
    icon: Plane,
    title: 'By air',
    detail:
      'Fly to Bicol International Airport, then continue by private transfer, van, or bus toward Sorsogon City.',
  },
  {
    icon: Bus,
    title: 'By bus',
    detail:
      'Take a Manila to Sorsogon City provincial bus. From the city terminal, Aureline Hotel is a short local ride away.',
  },
  {
    icon: Car,
    title: 'By car',
    detail:
      'Drive via the Pan-Philippine Highway and follow directions toward central Sorsogon City. Guest drop-off is available at the hotel entrance.',
  },
];

const attractions = [
  {
    name: 'Museo Sorsogon',
    tag: 'Culture',
    detail: 'A heritage stop with galleries on Sorsogon history, communities, and local identity.',
  },
  {
    name: 'Rompeolas Baywalk',
    tag: 'City walk',
    detail:
      'A relaxed waterfront area for sunset strolls, photos, and easy evenings near the city.',
  },
  {
    name: 'Paguriran Island',
    tag: 'Beach',
    detail: 'A scenic island and beach escape known for clear water and a natural lagoon setting.',
  },
  {
    name: 'Bulusan Lake',
    tag: 'Nature',
    detail:
      'A peaceful lake in Bulusan Volcano Natural Park, ideal for nature trips and quiet views.',
  },
  {
    name: 'Donsol Whale Shark Interaction',
    tag: 'Adventure',
    detail: 'A famous Sorsogon experience for seasonal whale shark watching and marine encounters.',
  },
  {
    name: 'Barcelona Ruins',
    tag: 'Heritage',
    detail: 'A historic stone church ruin and coastal heritage stop in the town of Barcelona.',
  },
];

const reviews = [
  {
    name: 'Isabella R.',
    text: 'The rooms feel calm and elegant. Staff made check-in easy and helped us plan a Sorsogon day trip.',
  },
  {
    name: 'Miguel A.',
    text: 'Great location for a city stay. The breakfast bundle and weekday offer made the reservation worth it.',
  },
  {
    name: 'Sofia C.',
    text: 'Loved the quiet design and the guest account page. Everything about our stay was easy to follow.',
  },
];

const rewards = [
  'Earn stay credits for every confirmed reservation.',
  'Get priority access to selected weekday and suite discounts.',
  'Receive birthday treats, breakfast offers, and late checkout when available.',
];

export default function Contact() {
  return (
    <>
      <div className="public-page-heading">
        <div className="eyebrow">CONTACT & TRAVEL GUIDE</div>
        <h1>Plan your Aureline stay.</h1>
        <p>
          Contact the hotel, find your way here,
          <br />
          and discover places to see around Sorsogon.
        </p>
      </div>

      <section className="contact-grid">
        <img src={hotelImages.lobby} alt="A welcoming hotel lobby" />
        <div>
          <div className="eyebrow">A WARM WELCOME AWAITS</div>
          <h2>Contact information.</h2>
          {contactDetails.map(([label, value, Icon]) => (
            <div className="contact-item" key={label}>
              <Icon size={21} />
              <div>
                <h3>{label}</h3>
                <p>{value}</p>
              </div>
            </div>
          ))}
          <div className="contact-item">
            <Clock size={21} />
            <div>
              <h3>Arrival & departure</h3>
              <p>
                Check-in from 3:00 PM
                <br />
                Checkout by 12:00 PM
              </p>
            </div>
          </div>
          <div className="contact-item">
            <CalendarDays size={21} />
            <div>
              <h3>Planning your stay?</h3>
              <p>Explore rooms, current availability, and selected discount offers.</p>
              <Link className="hotel-text-link" to="/search">
                Find a room
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div className="contact-item">
            <MessageCircle size={21} />
            <div>
              <h3>Already have a reservation?</h3>
              <p>Sign in to view your details, update your dates, or cancel a pending stay.</p>
              <Link className="hotel-text-link" to="/my-stays">
                Manage your stay
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="travel-section">
        <div className="hotel-section-heading">
          <div>
            <div className="eyebrow">HOW TO GET HERE</div>
            <h2>Getting to Aureline Hotel.</h2>
          </div>
          <p>
            Choose the route that suits your trip.
            <br />
            The front desk can help arrange transfers.
          </p>
        </div>
        <div className="travel-grid">
          {directions.map(({ icon: Icon, title, detail }) => (
            <article key={title}>
              <Icon size={22} strokeWidth={1.4} />
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="attractions-section">
        <div className="hotel-section-heading">
          <div>
            <div className="eyebrow">NEARBY ATTRACTIONS</div>
            <h2>Places to see in Sorsogon.</h2>
          </div>
          <Link className="hotel-text-link" to="/search">
            Book before you explore
            <Navigation size={16} />
          </Link>
        </div>
        <div className="attractions-grid">
          {attractions.map((place) => (
            <article key={place.name}>
              <span>{place.tag}</span>
              <h3>{place.name}</h3>
              <p>{place.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="reviews-rewards">
        <div className="reviews-panel">
          <div className="eyebrow">GUEST REVIEWS</div>
          <h2>Kind words from recent stays.</h2>
          <div className="review-list">
            {reviews.map((review) => (
              <article key={review.name}>
                <div>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={13} fill="currentColor" />
                  ))}
                </div>
                <p>{review.text}</p>
                <strong>{review.name}</strong>
              </article>
            ))}
          </div>
        </div>
        <div className="rewards-panel">
          <Gift size={26} strokeWidth={1.3} />
          <div className="eyebrow">AURELINE REWARDS</div>
          <h2>More reasons to return.</h2>
          <ul>
            {rewards.map((reward) => (
              <li key={reward}>{reward}</li>
            ))}
          </ul>
          <Link className="button primary" to="/signup">
            Join as a guest
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="hotel-faq">
        <div>
          <div className="eyebrow">A LITTLE CLARITY</div>
          <h2>Happy to help.</h2>
        </div>
        <div>
          {stayFAQs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
