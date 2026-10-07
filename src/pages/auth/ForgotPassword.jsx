import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import api from '../../services/api';
import AuthLayout from '../../layouts/AuthLayout';
import Field from '../../components/ui/Field';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      // Send reset email
      const response = await api.post('/forgot-password', {
        email: email.toLowerCase(),
      });

      if (response.data.error) {
        setError(response.data.error);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="eyebrow">PASSWORD RESET</div>
        <h1>Check your email</h1>
        <p>
          We've sent a password reset link to {email}. Click the link in the email to reset your
          password.
        </p>
        <p className="login-switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="eyebrow">PASSWORD RESET</div>
      <h1>Forgot your password?</h1>
      <p>Enter your email address and we'll send you a link to reset your password.</p>
      <form onSubmit={submit}>
        <Field
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
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
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full-width" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className="login-switch">
        Remember your password? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
