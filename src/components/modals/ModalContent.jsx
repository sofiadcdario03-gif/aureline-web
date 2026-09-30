import Modal from '../ui/Modal';
import RoomForm from '../forms/RoomForm';
import GuestForm from '../forms/GuestForm';
import StaffForm from '../forms/StaffForm';
import ReserveForm from '../forms/ReserveForm';
import EditBooking from '../forms/EditBooking';
import PaymentForm from '../forms/PaymentForm';
import RoomDetailsModal from './RoomDetailsModal';
import GuestDetailsModal from './GuestDetailsModal';
import BookingDetailsModal from './BookingDetailsModal';
import CancelBookingModal from './CancelBookingModal';

const modalComponents = {
  roomForm: RoomForm,
  guestForm: GuestForm,
  staffForm: StaffForm,
  reserve: ReserveForm,
  editBooking: EditBooking,
  payment: PaymentForm,
  room: RoomDetailsModal,
  guest: GuestDetailsModal,
  booking: BookingDetailsModal,
  cancel: CancelBookingModal,
};
export default function ModalContent({ modal, onClose, ...hotel }) {
  if (modal.type === 'confirmDelete')
    return (
      <Modal title={modal.title} subtitle={modal.message} onClose={onClose}>
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Keep record
          </button>
          <button
            className="button danger"
            onClick={() => {
              modal.action();
              onClose();
            }}
          >
            Delete record
          </button>
        </div>
      </Modal>
    );
  const Component = modalComponents[modal.type];
  return Component ? (
    <Component {...hotel} item={modal.item} query={modal.query} onClose={onClose} />
  ) : null;
}
