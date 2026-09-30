import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  Users,
  Wallet,
  UserRoundCog,
  Settings,
  ChevronDown,
  ArrowUpRight,
  Leaf,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useHotel } from '../../context/HotelContext';

const navItems = [
  ['/dashboard', 'Overview', LayoutDashboard],
  ['/reservations', 'Reservations', CalendarDays],
  ['/rooms', 'Rooms', BedDouble],
  ['/guests', 'Guests', Users],
  ['/billing', 'Payments & billing', Wallet],
  ['/team', 'Team management', UserRoundCog],
];
export default function Sidebar({ menu }) {
  const { role, isGuest, visibleBookings } = useHotel();
  const allowed =
    role === 'Front Desk'
      ? ['/dashboard', '/reservations', '/rooms', '/guests', '/billing', '/search', '/profile']
      : null;
  return (
    <aside className={`sidebar ${menu ? 'open' : ''}`}>
      <NavLink className="brand" to="/dashboard">
        <div className="brand-mark">
          A<span>✦</span>
        </div>
        <div>
          AURELINE<span>H O T E L</span>
        </div>
      </NavLink>
      <div className="property-label">
        <span className="live-dot" /> HOTEL MANAGEMENT <ChevronDown size={12} />
      </div>
      <div className="nav-caption">WORKSPACE</div>
      <nav>
        {navItems
          .filter(([path]) => !allowed || allowed.includes(path))
          .map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} />
              <span>{isGuest && path === '/reservations' ? 'My reservations' : label}</span>
              {path === '/reservations' && (
                <small>{visibleBookings.filter((b) => b.status === 'Pending').length}</small>
              )}
            </NavLink>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="care-card">
          <div className="care-icon">
            <Leaf size={19} />
          </div>
          <h4>A little care. A lasting stay.</h4>
          <p>
            Thoughtful hospitality starts
            <br />
            with the little things.
          </p>
          <span>
            THE AURELINE WAY <ArrowUpRight size={13} />
          </span>
        </div>
        <NavLink className="nav-link" to="/profile">
          <Settings size={18} />
          <span>Account settings</span>
        </NavLink>
        <div className="sidebar-footer">
          <span className="live-dot" /> Aureline Hotel <span>Sorsogon City</span>
        </div>
      </div>
    </aside>
  );
}
