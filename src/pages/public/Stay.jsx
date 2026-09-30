import { roomCollection, stayFAQs } from '../../data/hotelContent';
import CollectionCard from '../../components/rooms/CollectionCard';
import BookingBar from '../../components/reservations/BookingBar';
import { Plus } from 'lucide-react';

export default function Stay() {
  return (
    <>
      <div className="public-page-heading">
        <div className="eyebrow">THE AURELINE COLLECTION</div>
        <h1>A room for your kind of stay.</h1>
        <p>
          Soft textures. Natural light. Thoughtful little details.
          <br />
          Find the space that feels like you.
        </p>
      </div>
      <BookingBar />
      <div className="collection-grid collection-grid-four">
        {roomCollection.map((room) => (
          <CollectionCard collection={room} key={room.type} />
        ))}
      </div>
      <section className="hotel-faq">
        <div>
          <div className="eyebrow">BEFORE YOU SETTLE IN</div>
          <h2>
            A few things
            <br />
            worth knowing.
          </h2>
          <p>Less wondering. More looking forward.</p>
        </div>
        <div>
          {stayFAQs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <Plus size={16} />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
