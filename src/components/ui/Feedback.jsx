import { CheckCircle2, X } from 'lucide-react';
import { useHotel } from '../../context/HotelContext';
import ModalContent from '../modals/ModalContent';

export default function Feedback() {
  const hotel = useHotel();
  return (
    <>
      {hotel.modal && (
        <ModalContent {...hotel} modal={hotel.modal} onClose={() => hotel.setModal(null)} />
      )}
      {hotel.toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {hotel.toast}
          <button onClick={() => hotel.setToast('')} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
