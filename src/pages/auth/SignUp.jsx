import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useHotel } from '../../context/HotelContext';
import AuthLayout from '../../layouts/AuthLayout';
import Field from '../../components/ui/Field';
import PasswordField from '../../components/forms/PasswordField';
import {
  createAccountCredential,
  normalizeEmail,
  destinationAfterLogin,
} from '../../services/authService';
import { uid, fullName } from '../../utils/formatters';

export default function SignUp() {
  const { session, setSession, guests, setGuests, staff, accounts, setAccounts } = useHotel();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    passport: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const redirect = params.get('redirect');
  const update = (key) => (event) => setData({ ...data, [key]: event.target.value });
  if (session) return <Navigate to={destinationAfterLogin(session.role, redirect)} replace />;
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!data.firstName.trim() || !data.lastName.trim())
      return setError('Please enter your first and last name.');
    if (data.password.length < 8) return setError('Use at least 8 characters for your password.');
    if (data.password !== data.confirmPassword) return setError('Your passwords do not match.');
    const email = normalizeEmail(data.email);
    if ([...guests, ...staff].some((person) => normalizeEmail(person.email) === email))
      return setError('This email is already registered. Please sign in or use another email.');
    setBusy(true);
    try {
      const { password, confirmPassword, ...profile } = data;
      const guest = {
        ...profile,
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email,
        id: uid('G'),
      };
      const credential = await createAccountCredential(guest.id, password);
      setAccounts([...accounts, credential]);
      setGuests([...guests, guest]);
      setSession({ name: fullName(guest), role: 'Guest', guestId: guest.id });
      navigate(destinationAfterLogin('Guest', redirect), { replace: true });
    } catch {
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
          <Field
            label="First name"
            required
            autoComplete="given-name"
            value={data.firstName}
            onChange={update('firstName')}
          />
          <Field
            label="Last name"
            required
            autoComplete="family-name"
            value={data.lastName}
            onChange={update('lastName')}
          />
        </div>
        <div className="form-grid">
          <Field
            label="Email address"
            required
            type="email"
            autoComplete="username"
            value={data.email}
            onChange={update('email')}
          />
          <Field
            label="Phone number"
            required
            type="tel"
            autoComplete="tel"
            value={data.phone}
            onChange={update('phone')}
          />
        </div>
        <Field
          label="Address"
          required
          autoComplete="street-address"
          value={data.address}
          onChange={update('address')}
        />
        <Field
          label="ID / passport number"
          required
          placeholder="Example: P1234567 or UMID number"
          value={data.passport}
          onChange={update('passport')}
        />
        <div className="form-grid">
          <PasswordField
            label="Password"
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={data.password}
            onChange={update('password')}
          />
          <PasswordField
            label="Confirm password"
            minLength={8}
            autoComplete="new-password"
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
