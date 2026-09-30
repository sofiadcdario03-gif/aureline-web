import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { uid, fullName } from '../../utils/formatters.js';
import Field from '../ui/Field.jsx';
import Modal from '../ui/Modal.jsx';

export default function GuestForm({ item, onClose, ...c }) {
  const [data, setData] = useState(
    item || { firstName: '', lastName: '', email: '', phone: '', address: '', passport: '' },
  );
  const submit = (e) => {
    e.preventDefault();
    if (
      [...c.guests, ...c.staff].some(
        (g) =>
          g.id !== item?.id && g.email.trim().toLowerCase() === data.email.trim().toLowerCase(),
      )
    )
      return c.notify('This email is already registered.');
    const saved = { ...data, email: data.email.trim().toLowerCase(), id: item?.id || uid('G') };
    c.setGuests(item ? c.guests.map((g) => (g.id === item.id ? saved : g)) : [...c.guests, saved]);
    if (c.isGuest) c.setSession({ ...c.session, name: fullName(saved) });
    onClose();
    c.notify(item ? 'Guest profile updated.' : 'Guest added to the directory.');
  };
  return (
    <Modal
      title={item ? 'Edit guest profile' : 'A new face to welcome'}
      subtitle="All the details for a thoughtful stay."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {[
            ['firstName', 'First name'],
            ['lastName', 'Last name'],
            ['email', 'Email address'],
            ['phone', 'Phone number'],
            ['address', 'Address'],
            ['passport', 'ID / passport number'],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              required
              type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
              value={data[key]}
              onChange={(e) => setData({ ...data, [key]: e.target.value })}
            />
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">
            {item ? 'Save changes' : 'Add guest'}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
