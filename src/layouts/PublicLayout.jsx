import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Menu, X, UserRound, LogOut } from 'lucide-react';
import Brand from '../components/ui/Brand';
import { useHotel } from '../context/HotelContext';

export default function PublicLayout() {
  const { session, setSession } = useHotel();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const accountPath = session?.role === 'Guest' ? '/my-stays' : '/dashboard';
  return (
    <div className="public-site">
      <div className="hotel-announcement">
        Sorsogon City, Philippines. <span>Enjoy up to 15% off selected stays.</span>
      </div>
      <header className="hotel-header">
        <Brand />
        <nav className={open ? 'hotel-nav is-open' : 'hotel-nav'} aria-label="Hotel navigation">
          {[
            ['/', 'The hotel'],
            ['/stay', 'Rooms & suites'],
            ['/experiences', 'Experiences'],
            ['/contact', 'Contact'],
          ].map(([path, label]) => (
            <NavLink end key={path} to={path}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hotel-header-actions">
          <Link className="hotel-account-link" to={session ? accountPath : '/login'}>
            <UserRound size={17} />
            <span>{session ? session.name.split(' ')[0] : 'Sign in'}</span>
          </Link>
          <Link className="button primary hotel-book-button" to="/search">
            Book your stay <ArrowUpRight size={15} />
          </Link>
          <button
            className="icon-button hotel-menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main className={`public-main ${pathname === '/' ? 'public-main-home' : ''}`}>
        <Outlet />
      </main>
      <footer className="hotel-footer">
        <div className="hotel-footer-top">
          <div>
            <Brand light />
            <p>
              Some places are visited.
              <br />
              Others stay with you.
            </p>
          </div>
          <div>
            <span>MAKE YOURSELF AT HOME</span>
            <Link to="/stay">Rooms & suites</Link>
            <Link to="/experiences">The Aureline experience</Link>
            <Link to="/contact">Plan your visit</Link>
          </div>
          <div>
            <span>YOUR STAY</span>
            <Link to="/search">Find a room</Link>
            <Link to={session ? accountPath : '/login'}>{session ? 'My account' : 'Sign in'}</Link>
            {session ? (
              <button
                onClick={() => {
                  setSession(null);
                  navigate('/');
                }}
              >
                <LogOut size={13} />
                Sign out
              </button>
            ) : (
              <Link to="/signup">Create an account</Link>
            )}
          </div>
          <div className="footer-note">
            <span>SORSOGON CITY</span>
            <p>
              A little attention.
              <br />A thoughtful detail.
              <br />
              The Aureline difference.
            </p>
            <span className="footer-spark">*</span>
          </div>
        </div>
        <div className="hotel-footer-bottom">
          <span>Copyright {new Date().getFullYear()} Aureline Hotel</span>
          <span>Sorsogon City, Philippines</span>
          <Link to="/login">
            Staff & admin sign in <ArrowUpRight size={12} />
          </Link>
        </div>
      </footer>
    </div>
  );
}
