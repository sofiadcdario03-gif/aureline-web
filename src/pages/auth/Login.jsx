import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useHotel } from '../../context/HotelContext';
import AuthLayout from '../../layouts/AuthLayout';
import Field from '../../components/ui/Field';
import PasswordField from '../../components/forms/PasswordField';
import { destinationAfterLogin, normalizeEmail } from '../../services/authService';
import api from '../../services/api';

export default function Login() {
  const { session, setSession, setModal } = useHotel();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const redirect = params.get('redirect');
  if (session) return <Navigate to={destinationAfterLogin(session.role, redirect)} replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', {
        email: normalizeEmail(email),
        password,
      });
      if (data.requiresOtp) {
        setModal({
          type: 'otp',
          email: normalizeEmail(email),
          purpose: 'Login Verification',
          onVerified: (verified) => {
            if (!verified?.token || !verified.user) {
              setError('Sign-in verification expired. Please sign in again.');
              return;
            }
            setSession({ ...verified.user, token: verified.token });
            navigate(destinationAfterLogin(verified.user.role, redirect), { replace: true });
          },
        });
      } else {
        setSession({ ...data.user, token: data.token });
        navigate(destinationAfterLogin(data.user.role, redirect), { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <div className="eyebrow">WELCOME TO AURELINE HOTEL</div>
      <h1>Good to see you again.</h1>
      <p>Sign in to your account. Your next chapter awaits.</p>
      <form onSubmit={submit}>
        <Field
          label="Email address"
          type="email"
          name="email"
          autoComplete="username"
          placeholder="you@example.com"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === ' ') {
              e.preventDefault();
            }
          }}
        />
        <PasswordField
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          showStrength={false}
          maxLength={64}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="login-switch" style={{ textAlign: 'right' }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <button className="button primary full-width" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="login-switch">
        First time here?{' '}
        <Link to={`/signup${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>
          Create a guest account
        </Link>
      </p>
    </AuthLayout>
  );
}
