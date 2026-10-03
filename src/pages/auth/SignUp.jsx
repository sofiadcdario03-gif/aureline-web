import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useHotel } from '../../context/HotelContext';
import AuthLayout from '../../layouts/AuthLayout';
import Field from '../../components/ui/Field';
import PasswordField from '../../components/forms/PasswordField';
import OTPModal from '../../components/modals/OTPModal';
import {
  createAccountCredential,
  normalizeEmail,
  destinationAfterLogin,
} from '../../services/authService';
import { uid, fullName } from '../../utils/formatters';
import axios from 'axios';

export default function SignUp() {
  const { session, setSession, guests, setGuests, staff, accounts, setAccounts, setModal } = useHotel();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '+63 9',
    address: '',
    passport: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingGuest, setPendingGuest] = useState(null);
  const [pendingCredential, setPendingCredential] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const redirect = params.get('redirect');

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

  const update = (key) => (event) => {
    let value = event.target.value;
    
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
  };
  if (session) return <Navigate to={destinationAfterLogin(session.role, redirect)} replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    
    // Validate all fields
    const validations = {
      firstName: validateField('firstName', data.firstName),
      lastName: validateField('lastName', data.lastName),
      email: validateField('email', data.email),
      phone: validateField('phone', data.phone),
      address: validateField('address', data.address),
      passport: validateField('passport', data.passport),
    };
    
    const hasErrors = Object.values(validations).some(err => err !== '');
    if (hasErrors) {
      return setError('Please fix the validation errors before submitting.');
    }
    
    if (data.password.length < 8) return setError('Use at least 8 characters for your password.');
    if (data.password !== data.confirmPassword) return setError('Your passwords do not match.');
    const email = normalizeEmail(data.email);
    
    setBusy(true);
    try {
      const { password, confirmPassword, ...profile } = data;
      const guest = {
        ...profile,
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email,
        id: uid('G'),
        twoFactorEnabled: false,
      };
      const credential = await createAccountCredential(guest.id, password);
      
      // Store pending data for after OTP verification
      setPendingGuest(guest);
      setPendingCredential(credential);
      
      // Show OTP modal
      setModal({
        type: 'otp',
        email: email,
        purpose: 'Account Creation',
        onVerified: async () => {
          // Save to MongoDB after OTP verification
          try {
            await axios.post('http://localhost:5000/api/guests', guest);
            await axios.post('http://localhost:5000/api/accounts', credential);
            
            setAccounts([...accounts, credential]);
            setGuests([...guests, guest]);
            setSession({ name: fullName(guest), role: 'Guest', guestId: guest.id });
            navigate(destinationAfterLogin('Guest', redirect), { replace: true });
          } catch (err) {
            setError(err.response?.data?.error || 'Failed to create account. Please try again.');
          }
        },
      });
    } catch (err) {
      console.error('Error creating account:', err);
      setError('We could not create your account. Please try again on localhost or HTTPS.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout signup>
      <div className="eyebrow">A PLACE TO CALL YOUR OWN</div>
      <h1>Your stay starts here.</h1>
      <p>Create your guest account for easier reservations and a more personal welcome.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div>
            <Field
              label="First name"
              required
              autoComplete="given-name"
              value={data.firstName}
              onChange={update('firstName')}
            />
            {fieldErrors.firstName && <p className="form-error" style={{ fontSize: '12px' }}>{fieldErrors.firstName}</p>}
          </div>
          <div>
            <Field
              label="Last name"
              required
              autoComplete="family-name"
              value={data.lastName}
              onChange={update('lastName')}
            />
            {fieldErrors.lastName && <p className="form-error" style={{ fontSize: '12px' }}>{fieldErrors.lastName}</p>}
          </div>
        </div>
        <div className="form-grid">
          <div>
            <Field
              label="Email address"
              required
              type="email"
              autoComplete="username"
              maxLength={254}
              value={data.email}
              onChange={update('email')}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.preventDefault();
                }
              }}
            />
            {fieldErrors.email && <p className="form-error" style={{ fontSize: '12px' }}>{fieldErrors.email}</p>}
          </div>
          <div>
            <Field
              label="Phone number"
              required
              type="tel"
              autoComplete="tel"
              value={data.phone}
              onChange={update('phone')}
            />
            {fieldErrors.phone && <p className="form-error" style={{ fontSize: '12px' }}>{fieldErrors.phone}</p>}
          </div>
        </div>
        <div>
          <Field
            label="Address"
            required
            autoComplete="street-address"
            value={data.address}
            onChange={update('address')}
          />
          {fieldErrors.address && <p className="form-error" style={{ fontSize: '12px' }}>{fieldErrors.address}</p>}
        </div>
        <div>
          <Field
            label="ID / passport number"
            required
            placeholder="Example: P1234567 or UMID number"
            value={data.passport}
            onChange={update('passport')}
          />
          {fieldErrors.passport && <p className="form-error" style={{ fontSize: '12px' }}>{fieldErrors.passport}</p>}
        </div>
        <div className="form-grid">
          <PasswordField
            label="Password"
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            maxLength={64}
            value={data.password}
            onChange={update('password')}
          />
          <PasswordField
            label="Confirm password"
            minLength={8}
            autoComplete="new-password"
            showStrength={false}
            maxLength={64}
            value={data.confirmPassword}
            onChange={update('confirmPassword')}
          />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full-width" disabled={busy}>
          {busy ? 'Creating account…' : 'Create guest account'}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="login-switch">
        Already part of Aureline?{' '}
        <Link to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>
          Sign in
        </Link>
      </p>
      <p className="auth-role-note">Staff accounts are managed by the hotel administrator.</p>
    </AuthLayout>
  );
}
