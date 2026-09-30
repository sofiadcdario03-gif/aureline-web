import { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ArrowUpRight, Clock } from 'lucide-react';
import { experiences } from '../../data/hotelContent';

export default function Experiences() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash)
      requestAnimationFrame(() =>
        document
          .getElementById(hash.slice(1))
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
  }, [hash]);
  return (
    <>
      <div className="public-page-heading">
        <div className="eyebrow">THE AURELINE EXPERIENCE</div>
        <h1>Make room for the good things.</h1>
        <p>
          A meal to remember. A moment of calm.
          <br />A little more of what makes you feel like you.
        </p>
      </div>
      <div className="experience-list">
        {experiences.map((experience, index) => (
          <section
            id={experience.id}
            className={`experience-row ${index % 2 ? 'reverse' : ''}`}
            key={experience.id}
          >
            <img src={experience.image} alt={experience.title} loading="lazy" />
            <div>
              <div className="eyebrow">{experience.label}</div>
              <h2>{experience.title}</h2>
              <p>{experience.description}</p>
              <strong>{experience.detail}</strong>
              <span>
                <Clock size={14} />
                {experience.hours}
              </span>
              <Link className="hotel-text-link" to="/contact">
                Plan something lovely
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
