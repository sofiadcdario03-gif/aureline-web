import React from 'react';

import { fullName } from '../../utils/formatters.js';
import Modal from '../ui/Modal.jsx';

export default function CancelBookingModal({ item, onClose, ...c }) {
  return (
    <Modal
      title="Cancel this reservation?"
      subtitle={`${item.id} · ${fullName(c.guest(item.guestId))}`}
      onClose={onClose}
    >
      <p className="description-text">
        The room will be released for these dates. The reservation will remain in your history.
        {c.paid(item) > 0
          ? ' A payment has already been recorded. Any refund must be arranged separately with the front desk.'
          : ''}
      </p>
      <div className="modal-actions">
        <button className="button secondary" onClick={() => c.setModal({ type: 'booking', item })}>
          Keep reservation
        </button>
        <button className="button danger" onClick={() => c.updateStatus(item, 'Cancelled')}>
          Yes, cancel reservation
        </button>
      </div>
    </Modal>
  );
}
