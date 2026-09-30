import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { uid } from '../../utils/formatters.js';
import Field from '../ui/Field.jsx';
import Modal from '../ui/Modal.jsx';
import PasswordField from './PasswordField.jsx';

export default function StaffForm({ item, onClose, ...c }) {
  const [data, setData] = useState(
    item
      ? { ...item, password: '' }
      : { name: '', email: '', password: '', role: 'Front Desk', status: 'Active' },
  );
  return (
    <Modal
      title={item ? 'Edit team member' : 'Grow your team'}
      subtitle="Front desk staff help make every stay seamless."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            [...c.staff, ...c.guests].some(
              (s) =>
                s.id !== item?.id &&
                s.email.trim().toLowerCase() === data.email.trim().toLowerCase(),
            )
          )
            return c.notify('An account already uses this email.');
          if (!item && data.password.length < 8)
            return c.notify('Enter at least 8 characters for the staff password.');
          const saved = {
            ...Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'password')),
            email: data.email.trim().toLowerCase(),
            id: item?.id || uid('ST'),
          };
          if (data.password) saved.password = data.password;
          c.setStaff(
            item ? c.staff.map((s) => (s.id === item.id ? saved : s)) : [...c.staff, saved],
          );
          onClose();
          c.notify('Team directory updated.');
        }}
      >
        <Field
          label="Full name"
          required
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
        />
        <Field
          label="Email address"
          required
          type="email"
          value={data.email}
          onChange={(e) => setData({ ...data, email: e.target.value })}
        />
        <PasswordField
          label={item ? 'New password (optional)' : 'Password'}
          minLength={item ? undefined : 8}
          autoComplete="new-password"
          placeholder={item ? 'Leave blank to keep current password' : 'At least 8 characters'}
          value={data.password}
          onChange={(e) => setData({ ...data, password: e.target.value })}
        />
        <div className="form-grid">
          <Field label="Role">
            <input value="Front Desk" disabled />
          </Field>
          <Field label="Status">
            <select
              value={data.status}
              onChange={(e) => setData({ ...data, status: e.target.value })}
            >
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </Field>
        </div>
        <p className="info-note">
          A staff ID is generated automatically. Active staff can sign in using this password.
        </p>
        <div className="modal-actions">
          {item && (
            <button
              type="button"
              className="button danger-quiet"
              onClick={() =>
                c.setModal({
                  type: 'confirmDelete',
                  title: 'Delete staff member?',
                  message: `Remove ${item.name} from the team directory.`,
                  action: () => {
                    c.setStaff(c.staff.filter((s) => s.id !== item.id));
                    c.notify('Staff member deleted.');
                  },
                })
              }
            >
              <Trash2 size={15} />
              Delete
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Save team member</button>
        </div>
      </form>
    </Modal>
  );
}
