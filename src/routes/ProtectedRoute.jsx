import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useHotel } from '../context/HotelContext';

export default function ProtectedRoute({ roles }) {
  const { session } = useHotel();
  const location = useLocation();
  if (!session)
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (roles && !roles.includes(session.role))
    return <Navigate to={session.role === 'Guest' ? '/my-stays' : '/dashboard'} replace />;
  return <Outlet />;
}
