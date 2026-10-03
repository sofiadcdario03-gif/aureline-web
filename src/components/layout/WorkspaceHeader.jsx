import React, { useState, useEffect } from 'react';
import {
  Settings,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  ArrowRight,
  Menu,
  LogOut,
} from 'lucide-react';
import { day } from '../../data.js';
import { fullName, initials } from '../../utils/formatters.js';
import { isActiveReservation as active } from '../../reservationRules.js';
import { useLocation } from 'react-router-dom';
import { useHotel } from '../../context/HotelContext';

export default function WorkspaceHeader({ title, menu, setMenu }) {
  const { role, session, setSession, visibleBookings, guest, room, setModal, navigate } =
    useHotel();
  const location = useLocation();
  const [profileMenu, setProfileMenu] = useState(false),
    [notifications, setNotifications] = useState(false),
    [globalSearch, setGlobalSearch] = useState('');
  useEffect(() => {
    setGlobalSearch('');
    setNotifications(false);
    setProfileMenu(false);
  }, [location.pathname]);
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button
          className="icon-button mobile-menu"
          onClick={() => setMenu(!menu)}
          aria-label="Toggle navigation"
        >
          <Menu size={22} />
        </button>
        <span>Workspace</span>
        <span className="breadcrumb-slash">/</span>
        <strong>{title}</strong>
      </div>
      <div className="topbar-right">
        <div className="global-search">
          <Search size={16} />
          <input
            aria-label="Search reservations"
            placeholder="Search anything..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
          <kbd>/</kbd>
          {globalSearch && (
            <div className="search-results">
              {visibleBookings
                .filter((b) =>
                  (b.id + fullName(guest(b.guestId)) + room(b.roomId)?.number)
                    .toLowerCase()
                    .includes(globalSearch.toLowerCase()),
                )
                .slice(0, 5)
                .map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setModal({ type: 'booking', item: b });
                      setGlobalSearch('');
                    }}
                  >
                    <span>
                      {fullName(guest(b.guestId))}
                      <small>
                        {b.id} · Room {room(b.roomId)?.number}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              {!visibleBookings.some((b) =>
                (b.id + fullName(guest(b.guestId)) + room(b.roomId)?.number)
                  .toLowerCase()
                  .includes(globalSearch.toLowerCase()),
              ) && <p>No matching reservations.</p>}
            </div>
          )}
        </div>
        <div className="topbar-divider" />
        <div className="popover-wrap">
          <button
            className="icon-button notification-button"
            onClick={() => {
              setNotifications(!notifications);
              setProfileMenu(false);
            }}
            aria-label="Notifications"
          >
            <Bell size={19} />
            <i />
          </button>
          {notifications && (
            <div className="popover notification-popover">
              <h4>Your daily briefing</h4>
              <p>
                {visibleBookings.filter((b) => b.checkIn === day() && active(b)).length} arrivals
                expected today.
              </p>
              <p>
                {visibleBookings.filter((b) => b.status === 'Pending').length} reservations awaiting
                confirmation.
              </p>
              <button
                className="text-button"
                onClick={() => {
                  navigate('/reservations');
                  setNotifications(false);
                }}
              >
                View reservations <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="popover-wrap">
          <button
            className="user-menu"
            onClick={() => {
              setProfileMenu(!profileMenu);
              setNotifications(false);
            }}
          >
            <span className="avatar avatar-admin">{initials(session.name)}</span>
            <span className="user-name">
              {session.name}
              <small>{role === 'Admin' ? 'Administrator' : role}</small>
            </span>
            <ChevronDown size={14} />
          </button>
          {profileMenu && (
            <div className="popover">
              <div className="popover-label">YOUR ACCOUNT</div>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}
                onClick={() => {
                  navigate('/');
                  setProfileMenu(false);
                }}
              >
                <ArrowUpRight size={15} />
                Hotel website
              </button>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}
                onClick={() => {
                  navigate('/profile');
                  setProfileMenu(false);
                }}
              >
                <Settings size={15} />
                My profile
              </button>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}
                onClick={() => {
                  setSession(null);
                  setProfileMenu(false);
                  navigate('/login');
                }}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
