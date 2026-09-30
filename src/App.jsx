import { HotelProvider } from './context/HotelContext';
import AppRoutes from './routes/AppRoutes';
import Feedback from './components/ui/Feedback';

export default function App() {
  return (
    <HotelProvider>
      <AppRoutes />
      <Feedback />
    </HotelProvider>
  );
}
