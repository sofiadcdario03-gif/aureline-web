import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import WorkspaceHeader from '../components/layout/WorkspaceHeader';

const titles = {
  '/dashboard': 'Overview',
  '/reservations': 'Reservations',
  '/rooms': 'Rooms',
  '/guests': 'Guests',
  '/billing': 'Payments & billing',
  '/team': 'Team management',
  '/search': 'Find a room',
  '/profile': 'My profile',
};
export default function WorkspaceLayout() {
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [pathname]);
  return (
    <div className="app-shell">
      {menu && <div className="sidebar-shade" onClick={() => setMenu(false)} />}
      <Sidebar menu={menu} />
      <div className="main-shell">
        <WorkspaceHeader title={titles[pathname] || 'Workspace'} menu={menu} setMenu={setMenu} />
        <main>
          <Outlet />
        </main>
        <footer className="page-footer">
          <span>© {new Date().getFullYear()} Aureline Hotel</span>
          <span>
            Thoughtfully hosted. Beautifully managed. <span className="footer-star">✦</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
