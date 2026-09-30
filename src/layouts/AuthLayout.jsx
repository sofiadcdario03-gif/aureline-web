import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Brand from '../components/ui/Brand';
import { photos } from '../data';

export default function AuthLayout({ children, signup = false }) {
  return (
    <div className={`login-screen auth-screen ${signup ? 'signup-screen' : ''}`}>
      <aside
        className="login-photo"
        style={{
          backgroundImage: `linear-gradient(0deg,rgba(20,37,31,.83),rgba(20,37,31,.1)),url('${photos.hero}')`,
        }}
      >
        <Brand light />
        <div>
          <div className="eyebrow">AURELINE HOTEL - SORSOGON CITY</div>
          <h1>
            Some places
            <br />
            stay with you.
          </h1>
          <p>
            A beautiful room in Sorsogon City.
            <br />A welcome that feels like coming home.
          </p>
        </div>
        <span className="auth-photo-caption">CONSIDERED COMFORT. TIMELESS CHARM.</span>
      </aside>
      <div className="login-form auth-form">
        <Link className="auth-back" to="/">
          <ArrowLeft size={15} />
          Back to the hotel
        </Link>
        {children}
        <p className="auth-access-note">
          Use the access list above for Guest, Front Desk, and Admin sign-in.
        </p>
      </div>
    </div>
  );
}
