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
  const [originalStatus, setOriginalStatus] = useState(item?.status || 'Active');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Update original status when item changes
  React.useEffect(() => {
    if (item) {
      setOriginalStatus(item.status);
    }
  }, [item]);

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

    // Check if status changed and require admin password verification
    if (item && data.status !== originalStatus) {
      setShowPasswordModal(true);
      return;
    }

    proceedWithSave();
  };

  const proceedWithSave = async () => {
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

  const handlePasswordVerification = async () => {
    setPasswordError('');
    try {
      // Verify admin password by calling the login endpoint
      const adminStaff = c.staff.find(s => s.id === c.session.staffId);
      if (!adminStaff) {
        setPasswordError('Admin account not found');
        return;
      }

      // Use the authentication service to verify password
      const { signInAccount } = await import('../../services/authService.js');
      await signInAccount({
        email: adminStaff.email,
        password: adminPassword,
        guests: c.guests,
        staff: c.staff,
        accounts: c.accounts,
      });
      
      // Password verified, proceed with save
      setShowPasswordModal(false);
      setAdminPassword('');
      proceedWithSave();
    } catch (error) {
      setPasswordError('Invalid password');
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
        <p className="info-note">
          A staff ID is generated automatically. A temporary password will be generated and sent to the staff member's email.
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
      
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%',
          }}>
            <h3 style={{ marginBottom: '16px' }}>Verify Admin Password</h3>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              Changing staff status requires admin verification. Please enter your password to continue.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === ' ') e.preventDefault();
                }}
                maxLength={64}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>
            {passwordError && <p style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px', marginBottom: '16px' }}>{passwordError}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setShowPasswordModal(false);
                  setAdminPassword('');
                  setPasswordError('');
                  setData({ ...data, status: originalStatus });
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={handlePasswordVerification}
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
