import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useHotel } from '../../context/HotelContext';
import AuthLayout from '../../layouts/AuthLayout';
import Field from '../../components/ui/Field';
import PasswordField from '../../components/forms/PasswordField';
import OTPModal from '../../components/modals/OTPModal';
import { normalizeEmail, destinationAfterLogin, checkEmailAvailable, checkPhoneAvailable, checkPassportAvailable } from '../../services/authService';
import { fullName } from '../../utils/formatters';
import api from '../../services/api';

export default function SignUp() {
  const { session, setSession, setGuests, setModal } = useHotel();
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
  const [fieldErrors, setFieldErrors] = useState({});

  // Server-side validation state
  const [emailServerError, setEmailServerError] = useState(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [phoneServerError, setPhoneServerError] = useState(null);
  const [phoneChecking, setPhoneChecking] = useState(false);
  const [passportServerError, setPassportServerError] = useState(null);
  const [passportChecking, setPassportChecking] = useState(false);

  // Debounce timers
  const emailDebounceRef = useRef(null);
  const phoneDebounceRef = useRef(null);
  const passportDebounceRef = useRef(null);

  const redirect = params.get('redirect');

  const validateField = (key, value) => {
    let error = '';
    switch (key) {
      case 'firstName':
      case 'lastName':
        if (value.length === 0) {
          error = `${key === 'firstName' ? 'First' : 'Last'} name is required`;
        } else if (value.length < 2) {
          error = 'Minimum 2 characters';
        }
        break;
      case 'email':
        if (value.length === 0) {
          error = 'Email address is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Invalid email format';
        } else if (value.length < 5) {
          error = 'Minimum 5 characters';
        }
        break;
      case 'phone':
        if (value.length === 0 || value === '+63 9') {
          error = 'Phone number is required';
        } else {
          const digits = value.replace(/\D/g, '');
          const phoneDigits = digits.startsWith('639') ? digits.slice(3) : digits;
          if (phoneDigits.length !== 9) {
            error = 'Phone number must contain exactly 9 digits';
          }
        }
        break;
      case 'address':
        if (value.length === 0) {
          error = 'Address is required';
        } else if (value.length < 10) {
          error = 'Minimum 10 characters';
        }
        break;
      case 'passport':
        if (value.length === 0) {
          error = 'ID/passport number is required';
        } else if (value.length < 5) {
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

    // Trigger server-side validation for email, phone, and passport
    if (key === 'email') {
      if (emailServerError) setEmailServerError(null);
      emailDebounceRef.current && clearTimeout(emailDebounceRef.current);
      if (validateField('email', value) || value.length === 0) return;

      setEmailChecking(true);
      emailDebounceRef.current = setTimeout(async () => {
        try {
          const available = await checkEmailAvailable(value.trim().toLowerCase());
          setEmailServerError(available ? null : 'Email address already taken');
        } catch (_) {
          // Ignore errors, just stop checking
        } finally {
          setEmailChecking(false);
        }
      }, 600);
    }

    if (key === 'phone') {
      if (phoneServerError) setPhoneServerError(null);
      phoneDebounceRef.current && clearTimeout(phoneDebounceRef.current);
      if (validateField('phone', value) || value === '+63 9') return;

      setPhoneChecking(true);
      phoneDebounceRef.current = setTimeout(async () => {
        try {
          const available = await checkPhoneAvailable(value.trim());
          setPhoneServerError(available ? null : 'Phone number already taken');
        } catch (_) {
          // Ignore errors, just stop checking
        } finally {
          setPhoneChecking(false);
        }
      }, 600);
    }

    if (key === 'passport') {
      if (passportServerError) setPassportServerError(null);
      passportDebounceRef.current && clearTimeout(passportDebounceRef.current);
      if (validateField('passport', value) || value.length === 0) return;

      setPassportChecking(true);
      passportDebounceRef.current = setTimeout(async () => {
        try {
          const available = await checkPassportAvailable(value.trim());
          setPassportServerError(available ? null : 'ID/passport number already registered');
        } catch (_) {
          // Ignore errors, just stop checking
        } finally {
          setPassportChecking(false);
        }
      }, 600);
    }
  };

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
      if (passportDebounceRef.current) clearTimeout(passportDebounceRef.current);
    };
  }, []);

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

    const hasErrors = Object.values(validations).some((err) => err !== '');
    if (hasErrors) {
      return setError('Please fix the validation errors before submitting.');
    }

    // Check for server-side validation errors
    if (emailServerError) {
      return setError(emailServerError);
    }
    if (phoneServerError) {
      return setError(phoneServerError);
    }
    if (passportServerError) {
      return setError(passportServerError);
    }

    // Wait for any pending checks
    if (emailChecking || phoneChecking || passportChecking) {
      return setError('Please wait while we verify your details...');
    }

    if (data.password.length === 0) return setError('Password is required.');
    if (data.password.length < 8) return setError('Use at least 8 characters for your password.');
    if (data.confirmPassword.length === 0) return setError('Please confirm your password.');
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
      };
      // Show OTP modal
      setModal({
        type: 'otp',
        email: email,
        purpose: 'Account Creation',
        onVerified: async (verified) => {
          // Save to MongoDB after OTP verification
          try {
            const { data: account } = await api.post('/auth/register', {
              profile: guest,
              password,
              verificationToken: verified?.registrationToken,
            });
            setGuests([account.guest]);
            setSession({ ...account.user, token: account.token });
            navigate(destinationAfterLogin('Guest', redirect), { replace: true });
          } catch (err) {
            setError(err.response?.data?.error || 'Failed to create account. Please try again.');
          }
        },
      });
    } catch (err) {
      console.error('Error preparing account creation:', err);
      setError('We could not start account creation. Please try again.');
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
            {fieldErrors.firstName && (
              <p className="form-error" style={{ fontSize: '12px' }}>
                {fieldErrors.firstName}
              </p>
            )}
          </div>
          <div>
            <Field
              label="Last name"
              required
              autoComplete="family-name"
              value={data.lastName}
              onChange={update('lastName')}
            />
            {fieldErrors.lastName && (
              <p className="form-error" style={{ fontSize: '12px' }}>
                {fieldErrors.lastName}
              </p>
            )}
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
            {(fieldErrors.email || emailServerError) && (
              <p className="form-error" style={{ fontSize: '12px' }}>
                {fieldErrors.email || emailServerError}
              </p>
            )}
            {emailChecking && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <Loader2 size={12} className="spinner" />
                <span style={{ fontSize: '11px', color: '#999' }}>Checking availability...</span>
              </div>
            )}
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
            {(fieldErrors.phone || phoneServerError) && (
              <p className="form-error" style={{ fontSize: '12px' }}>
                {fieldErrors.phone || phoneServerError}
              </p>
            )}
            {phoneChecking && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <Loader2 size={12} className="spinner" />
                <span style={{ fontSize: '11px', color: '#999' }}>Checking availability...</span>
              </div>
            )}
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
          {fieldErrors.address && (
            <p className="form-error" style={{ fontSize: '12px' }}>
              {fieldErrors.address}
            </p>
          )}
        </div>
        <div>
          <Field
            label="ID / passport number"
            required
            placeholder="Example: P1234567 or UMID number"
            value={data.passport}
            onChange={update('passport')}
          />
          {(fieldErrors.passport || passportServerError) && (
            <p className="form-error" style={{ fontSize: '12px' }}>
              {fieldErrors.passport || passportServerError}
            </p>
          )}
          {passportChecking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <Loader2 size={12} className="spinner" />
              <span style={{ fontSize: '11px', color: '#999' }}>Checking availability...</span>
            </div>
          )}
        </div>
        <div className="form-grid">
          <PasswordField
            label="Password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            maxLength={64}
            value={data.password}
            onChange={update('password')}
          />
          <PasswordField
            label="Confirm password"
            required
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
