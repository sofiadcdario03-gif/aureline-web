import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useHotel } from '../context/HotelContext';
import ProtectedRoute from './ProtectedRoute';
import PublicLayout from '../layouts/PublicLayout';
import WorkspaceLayout from '../layouts/WorkspaceLayout';
import Home from '../pages/public/Home';
import Stay from '../pages/public/Stay';
import RoomDetails from '../pages/public/RoomDetails';
import Experiences from '../pages/public/Experiences';
import Contact from '../pages/public/Contact';
import RoomSearch from '../pages/public/RoomSearch';
import Login from '../pages/auth/Login';
import SignUp from '../pages/auth/SignUp';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import GuestStays from '../pages/account/GuestStays';
import Profile from '../pages/account/Profile';
import Dashboard from '../pages/workspace/Dashboard';
import Reservations from '../pages/workspace/Reservations';
import Rooms from '../pages/workspace/Rooms';
import Guests from '../pages/workspace/Guests';
import Billing from '../pages/workspace/Billing';
import Team from '../pages/workspace/Team';

export default function AppRoutes() {
  const hotel = useHotel();
  const { pathname } = useLocation();
  const employee = ['Admin', 'Front Desk'].includes(hotel.session?.role);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="stay" element={<Stay />} />
        <Route path="stay/:type" element={<RoomDetails />} />
        <Route path="experiences" element={<Experiences />} />
        <Route path="contact" element={<Contact />} />
        <Route element={<ProtectedRoute roles={['Guest']} />}>
          <Route path="my-stays" element={<GuestStays />} />
        </Route>
      </Route>
      <Route path="login" element={<Login />} />
      <Route path="signup" element={<SignUp />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route element={employee ? <WorkspaceLayout /> : <PublicLayout />}>
        <Route path="search" element={<RoomSearch {...hotel} />} />
        <Route element={<ProtectedRoute />}>
          <Route
            path="reservations"
            element={employee ? <Reservations {...hotel} /> : <Navigate to="/my-stays" replace />}
          />
          <Route path="profile" element={<Profile {...hotel} />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute roles={['Admin', 'Front Desk']} />}>
        <Route element={<WorkspaceLayout />}>
          <Route path="dashboard" element={<Dashboard {...hotel} />} />
          <Route path="rooms" element={<Rooms {...hotel} />} />
          <Route path="guests" element={<Guests {...hotel} />} />
          <Route path="billing" element={<Billing {...hotel} />} />
          <Route element={<ProtectedRoute roles={['Admin']} />}>
            <Route path="team" element={<Team {...hotel} />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
