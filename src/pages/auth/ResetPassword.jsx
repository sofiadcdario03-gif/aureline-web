import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import AuthLayout from '../../layouts/AuthLayout';
import PasswordField from '../../components/forms/PasswordField';
import api from '../../services/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [passwords, setPasswords] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = params.get('token');

  if (!token) {
    return (
      <AuthLayout>
        <div className="eyebrow">INVALID LINK</div>
        <h1>Reset link expired or invalid</h1>
        <p>This password reset link is no longer valid. Please request a new one.</p>
        <p className="login-switch">
          <Link to="/forgot-password">Request new reset link</Link>
        </p>
      </AuthLayout>
    );
  }

  async function submit(event) {
    event.preventDefault();
    setError('');

    if (passwords.password.length < 8) {
      return setError('Use at least 8 characters for your password.');
    }
    if (passwords.password !== passwords.confirmPassword) {
      return setError('Your passwords do not match.');
    }

    setBusy(true);
    try {
      await api.post('/reset-password', {
        token,
        password: passwords.password,
      });

      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="eyebrow">PASSWORD RESET</div>
      <h1>Create a new password</h1>
      <p>Enter your new password below to complete the reset process.</p>
      <form onSubmit={submit}>
        <PasswordField
          label="New password"
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          maxLength={64}
          value={passwords.password}
          onChange={(e) => setPasswords({ ...passwords, password: e.target.value })}
        />
        <PasswordField
          label="Confirm password"
          minLength={8}
          autoComplete="new-password"
          showStrength={false}
          maxLength={64}
          value={passwords.confirmPassword}
          onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full-width" disabled={busy}>
          {busy ? 'Resetting…' : 'Reset password'}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="login-switch">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
