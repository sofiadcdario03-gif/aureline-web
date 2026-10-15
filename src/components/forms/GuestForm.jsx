import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { fullName } from '../../utils/formatters.js';
import api from '../../services/api.js';
import Field from '../ui/Field.jsx';
import Modal from '../ui/Modal.jsx';

export default function GuestForm({ item, onClose, ...c }) {
  const [data, setData] = useState(
    item || { firstName: '', lastName: '', email: '', phone: '+63 9', address: '', passport: '' },
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [checkingPassport, setCheckingPassport] = useState(false);

  const validateField = (key, value) => {
    let error = '';
    switch (key) {
      case 'firstName':
      case 'lastName':
        if (value.length > 0 && value.length < 2) {
          error = 'Minimum 2 characters';
        }
        break;
      case 'email':
        if (value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Invalid email format';
        } else if (value.length > 0 && value.length < 5) {
          error = 'Minimum 5 characters';
        }
        break;
      case 'address':
        if (value.length > 0 && value.length < 10) {
          error = 'Minimum 10 characters';
        }
        break;
      case 'passport':
        if (value.length > 0 && value.length < 5) {
          error = 'Minimum 5 characters';
        }
        break;
    }
    setFieldErrors({ ...fieldErrors, [key]: error });
    return error;
  };

  const handleChange = (key) => (e) => {
    let value = e.target.value;

    // Handle phone number formatting
    if (key === 'phone') {
      // If value is empty or just the prefix, reset to prefix
      if (!value || value === '+63 9' || value === '+63') {
        value = '+63 9';
      } else {
        // Extract digits from the value
        const digits = value.replace(/\D/g, '');
        // Remove the 639 prefix if present to get the actual phone digits
        const phoneDigits = digits.startsWith('639') ? digits.slice(3) : digits;
        // Reconstruct with prefix, limiting to 9 digits
        value = '+63 9' + phoneDigits.slice(0, 9);
      }
    }

    // Prevent invalid characters and limit length for first/last name
    if (key === 'firstName' || key === 'lastName') {
      value = value.replace(/[^a-zA-Z\s\-']/g, '').slice(0, 50);
    }

    // Limit email to 254 characters
    if (key === 'email') {
      value = value.slice(0, 254);
    }

    // Prevent invalid characters and limit length for address
    if (key === 'address') {
      value = value.replace(/[^a-zA-Z0-9\s#\-']/g, '').slice(0, 200);
    }

    // Prevent invalid characters and limit length for passport
    if (key === 'passport') {
      value = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    }

    setData({ ...data, [key]: value });
    validateField(key, value);

    // Real-time availability checks
    if (key === 'phone' && value.length >= 12) {
      checkPhoneAvailability(value);
    }
    if (key === 'passport' && value.length >= 5) {
      checkPassportAvailability(value);
    }
  };

  const checkPhoneAvailability = async (phoneNumber) => {
    if (phoneNumber.length < 12) return; // Not a complete phone number yet
    if (phoneNumber === item?.phone) {
      setFieldErrors({ ...fieldErrors, phone: '' });
      return;
    }

    setCheckingPhone(true);
    try {
      const currentId = item?.id || null;
      const response = await api.get('/auth/check-phone', {
        params: { phone: phoneNumber, excludeId: currentId },
      });
      if (!response.data.available) {
        setFieldErrors({ ...fieldErrors, phone: 'Phone number already registered' });
      } else {
        setFieldErrors({ ...fieldErrors, phone: '' });
      }
    } catch (error) {
      console.error('Error checking phone availability:', error);
    } finally {
      setCheckingPhone(false);
    }
  };

  const checkPassportAvailability = async (passportNumber) => {
    if (passportNumber.length < 5) return; // Not a complete passport number yet
    if (passportNumber === item?.passport) {
      setFieldErrors({ ...fieldErrors, passport: '' });
      return;
    }

    setCheckingPassport(true);
    try {
      const currentId = item?.id || null;
      const response = await api.get('/auth/check-passport', {
        params: { passport: passportNumber, excludeId: currentId },
      });
      if (!response.data.available) {
        setFieldErrors({ ...fieldErrors, passport: 'Passport number already registered' });
      } else {
        setFieldErrors({ ...fieldErrors, passport: '' });
      }
    } catch (error) {
      console.error('Error checking passport availability:', error);
    } finally {
      setCheckingPassport(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    // Validate all fields
    const validations = {
      firstName: validateField('firstName', data.firstName),
      lastName: validateField('lastName', data.lastName),
      email: validateField('email', data.email),
      phone: validateField('phone', data.phone),
      address: validateField('address', data.address),
      passport: validateField('passport', data.passport),
    };

    const hasErrors = Object.values(validations).some((err) => err !== '');
    if (hasErrors) {
      return c.notify('Please fix the validation errors before submitting.');
    }

    if (
      [...c.guests, ...c.staff].some(
        (g) =>
          g.id !== item?.id && g.email.trim().toLowerCase() === data.email.trim().toLowerCase(),
      )
    )
      return c.notify('This email is already registered.');
    const profile = {
      ...data,
      email: data.email.trim().toLowerCase(),
    };
    try {
      let saved;
      if (c.isGuest) {
        const { email, ...guestUpdates } = profile;
        const { data: updatedProfile } = await api.patch('/profile', guestUpdates);
        saved = { ...item, ...updatedProfile, id: c.session.guestId, email };
        c.setGuests((previous) => previous.map((guest) => (guest.id === saved.id ? saved : guest)));
        c.setSession({ ...c.session, name: fullName(saved) });
      } else if (item) {
        const { data: updatedGuest } = await api.put(`/guests/${item.id}`, profile);
        saved = { ...item, ...updatedGuest };
      } else {
        const { data: createdGuest } = await api.post('/guests', profile);
        saved = createdGuest;
      }
      c.setGuests((previous) =>
        item
          ? previous.map((guest) => (guest.id === item.id ? saved : guest))
          : [...previous, saved],
      );
      onClose();
      c.notify(item ? 'Guest profile updated.' : 'Guest added to the directory.');
    } catch (error) {
      c.notify(error.response?.data?.error || 'Guest profile could not be saved.');
    }
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
            <div key={key}>
              <Field
                label={label}
                required
                disabled={c.isGuest && key === 'email'}
                type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                value={data[key]}
                onChange={handleChange(key)}
              />
              {fieldErrors[key] && (
                <p className="form-error" style={{ fontSize: '12px' }}>
                  {fieldErrors[key]}
                </p>
              )}
            </div>
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
