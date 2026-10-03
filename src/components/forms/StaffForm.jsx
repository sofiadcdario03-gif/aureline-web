import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import axios from 'axios';
import { uid } from '../../utils/formatters.js';
import Field from '../ui/Field.jsx';
import Modal from '../ui/Modal.jsx';

// Validation functions
const validateName = (name) => {
  if (!name || name.length < 2) return 'Name must be at least 2 characters';
  if (name.length > 50) return 'Name must be at most 50 characters';
  if (!/^[a-zA-Z\-'\s]+$/.test(name)) return 'Name can only contain letters, hyphens, apostrophes, and spaces';
  return null;
};

const validateEmail = (email) => {
  if (!email || email.length < 5) return 'Email must be at least 5 characters';
  if (email.length > 254) return 'Email must be at most 254 characters';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return null;
};

const validatePhone = (phone) => {
  if (!phone) return 'Phone number is required';
  const digits = phone.replace(/\D/g, '');
  // Remove +63 9 prefix to count actual phone digits
  const phoneDigits = digits.startsWith('639') ? digits.slice(3) : digits;
  if (phoneDigits.length < 9) return 'Phone number must be at least 9 digits';
  if (phoneDigits.length > 9) return 'Phone number must be at most 9 digits';
  return null;
};

const formatPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return '';
  // If digits include +63 9, remove them first
  const phoneDigits = digits.startsWith('639') ? digits.slice(3) : digits;
  return '+63 9' + phoneDigits.slice(0, 9);
};

export default function StaffForm({ item, onClose, ...c }) {
  const [data, setData] = useState(
    item
      ? { ...item }
      : { name: '', email: '', phone: '', role: 'Front Desk', status: 'Active', twoFactorEnabled: false },
  );
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const handleNameChange = (e) => {
    const value = e.target.value;
    // Only allow letters, hyphens, apostrophes, and spaces
    const filtered = value.replace(/[^a-zA-Z\-'\s]/g, '');
    // Limit to 50 characters
    const limited = filtered.slice(0, 50);
    setData({ ...data, name: limited });
    
    // Live validation
    const error = validateName(limited);
    setErrors(prev => ({ ...prev, name: error || null }));
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    // Limit to 254 characters
    const limited = value.slice(0, 254);
    setData({ ...data, email: limited });
    
    // Live validation
    const error = validateEmail(limited);
    setErrors(prev => ({ ...prev, email: error || null }));
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    // Only allow digits and +63 prefix
    const filtered = value.replace(/[^\d+]/g, '');
    const digits = filtered.replace(/\D/g, '');
    // Remove +63 9 prefix to count actual phone digits
    const phoneDigits = digits.startsWith('639') ? digits.slice(3) : digits;
    // Limit to 9 digits
    const limitedPhoneDigits = phoneDigits.slice(0, 9);
    // Reconstruct phone number with +63 9 prefix
    const formatted = '+63 9' + limitedPhoneDigits;
    setData({ ...data, phone: formatted });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate all fields
    const newErrors = {};
    const nameError = validateName(data.name);
    if (nameError) newErrors.name = nameError;

    const emailError = validateEmail(data.email);
    if (emailError) newErrors.email = emailError;

    const phoneError = validatePhone(data.phone);
    if (phoneError) newErrors.phone = phoneError;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (
      [...c.staff, ...c.guests].some(
        (s) =>
          s.id !== item?.id &&
          s.email.trim().toLowerCase() === data.email.trim().toLowerCase(),
      )
    )
      return c.notify('An account already uses this email.');

    setBusy(true);
    try {
      const saved = {
        ...data,
        email: data.email.trim().toLowerCase(),
        phone: formatPhone(data.phone),
        id: item?.id || uid('ST'),
      };

      // For editing, keep existing password hash
      if (item) {
        saved.salt = item.salt;
        saved.digest = item.digest;
      }

      // Save to database
      if (item) {
        // Update existing staff
        await axios.put(`http://localhost:5000/api/staff/${item.id}`, saved);
      } else {
        // Create new staff - backend will generate password and send email
        await axios.post('http://localhost:5000/api/staff', saved);
      }

      // Reload staff from database to ensure sync
      await c.reloadStaff();
      onClose();
      c.notify(item ? 'Team directory updated.' : 'Staff account created. Credentials sent via email.');
    } catch (error) {
      console.error('Error saving staff:', error);
      c.notify('Failed to save staff member. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await axios.delete(`http://localhost:5000/api/staff/${item.id}`);
      await c.reloadStaff();
      c.notify('Staff member deleted.');
      onClose();
    } catch (error) {
      console.error('Error deleting staff:', error);
      c.notify('Failed to delete staff member. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={item ? 'Edit team member' : 'Grow your team'}
      subtitle="Front desk staff help make every stay seamless."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <Field
          label="Full name"
          required
          value={data.name}
          onChange={handleNameChange}
        />
        {errors.name && <p className="form-error">{errors.name}</p>}
        <Field
          label="Email address"
          required
          type="email"
          value={data.email}
          onChange={handleEmailChange}
        />
        {errors.email && <p className="form-error">{errors.email}</p>}
        <Field
          label="Phone number"
          type="tel"
          required
          placeholder="+63 9XXXXXXXXX (9 digits required)"
          value={data.phone || ''}
          onChange={handlePhoneChange}
        />
        {errors.phone && <p className="form-error">{errors.phone}</p>}
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
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={data.twoFactorEnabled}
              onChange={(e) => setData({ ...data, twoFactorEnabled: e.target.checked })}
              style={{ width: '18px', height: '18px' }}
            />
            <span>Enable two-factor authentication</span>
          </label>
        </div>
        <p className="info-note">
          A staff ID is generated automatically. Phone numbers are formatted as +63 9XXXXXXXXX. A temporary password will be generated and sent to the staff member's email. Two-factor authentication adds an extra layer of security.
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
                  action: handleDelete,
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
          <button className="button primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save team member'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
