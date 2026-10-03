import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useHotel } from '../../context/HotelContext';
import AuthLayout from '../../layouts/AuthLayout';
import Field from '../../components/ui/Field';
import PasswordField from '../../components/forms/PasswordField';
import { ACCESS_PASSWORD, signInAccount, destinationAfterLogin } from '../../services/authService';
import axios from 'axios';

export default function Login() {
  const { session, setSession, guests, staff, accounts, setModal } = useHotel();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingAccount, setPendingAccount] = useState(null);
  const redirect = params.get('redirect');
  if (session) return <Navigate to={destinationAfterLogin(session.role, redirect)} replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const account = await signInAccount({ email, password, guests, staff, accounts });
      
      // Check if user has 2FA enabled
      const user = account.guestId 
        ? guests.find((g) => g.id === account.guestId)
        : staff.find((s) => s.id === account.staffId);
      
      const twoFactorEnabled = user?.twoFactorEnabled || false;
      
      if (twoFactorEnabled) {
        // Store pending account for after OTP verification
        setPendingAccount(account);
        
        // Show OTP modal (it will send the OTP on mount)
        setModal({
          type: 'otp',
          email: email.toLowerCase(),
          purpose: 'Login Verification',
          onVerified: () => {
            setSession(account);
            navigate(destinationAfterLogin(account.role, redirect), { replace: true });
          },
        });
      } else {
        // No 2FA, log in directly
        setSession(account);
        navigate(destinationAfterLogin(account.role, redirect), { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const accessAccounts = [
    { label: 'Guest', email: guests.find((g) => g.id === 'G-001')?.email },
    {
      label: 'Front desk',
      email: staff.find((s) => s.role === 'Front Desk' && s.status === 'Active')?.email,
    },
    {
      label: 'Admin',
      email: staff.find((s) => s.role === 'Admin' && s.status === 'Active')?.email,
    },
  ];
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
        <p className="auth-role-note">
          <LockKeyhole size={14} />
          One sign-in for guests, staff, and administrators.
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
      <details className="access-accounts">
        <summary>Sign-in access for Guest, Front Desk, and Admin</summary>
        <p>
          Select an account to fill the form. Password: <code>{ACCESS_PASSWORD}</code>
        </p>
        <div>
          {accessAccounts
            .filter((account) => account.email)
            .map((account) => (
              <button
                type="button"
                key={account.label}
                onClick={() => {
                  setEmail(account.email);
                  setPassword(ACCESS_PASSWORD);
                  setError('');
                }}
              >
                {account.label}
                <span>{account.email}</span>
              </button>
            ))}
        </div>
      </details>
    </AuthLayout>
  );
}
