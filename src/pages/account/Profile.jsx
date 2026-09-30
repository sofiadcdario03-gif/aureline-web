import React, { useState } from 'react';
import { Pencil, LockKeyhole } from 'lucide-react';
import { initials } from '../../utils/formatters.js';
import Badge from '../../components/ui/Badge.jsx';
import PageHeading from '../../components/ui/PageHeading.jsx';
import PasswordField from '../../components/forms/PasswordField.jsx';
import {
  createAccountCredential,
  normalizeEmail,
  signInAccount,
} from '../../services/authService.js';

export default function Profile(c) {
  const g = c.isGuest ? c.guest(c.session.guestId) : null;
  const staffAccount = !c.isGuest ? c.staff.find((s) => s.id === c.session.staffId) : null;
  const email = g?.email || staffAccount?.email || '';
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [busy, setBusy] = useState(false);
  const updatePassword = (key) => (event) =>
    setPasswords({ ...passwords, [key]: event.target.value });

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError('');
    if (passwords.next.length < 8)
      return setPasswordError('Use at least 8 characters for your new password.');
    if (passwords.next !== passwords.confirm)
      return setPasswordError('Your new passwords do not match.');
    setBusy(true);
    try {
      await signInAccount({
        email,
        password: passwords.current,
        guests: c.guests,
        staff: c.staff,
        accounts: c.accounts,
      });
      if (c.isGuest) {
        const credential = await createAccountCredential(c.session.guestId, passwords.next);
        c.setAccounts([
          ...c.accounts.filter((account) => account.guestId !== c.session.guestId),
          credential,
        ]);
      } else {
        c.setStaff(
          c.staff.map((s) => (s.id === c.session.staffId ? { ...s, password: passwords.next } : s)),
        );
      }
      setPasswords({ current: '', next: '', confirm: '' });
      c.notify('Password updated.');
    } catch {
      setPasswordError('Current password is incorrect.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="A FEW PERSONAL DETAILS"
        title="My profile"
        description="Keep your information up to date for a smoother experience."
      />
      <section className="panel profile-panel">
        <div className="profile-cover" />
        <div className="profile-content">
          <span className="avatar profile-avatar">{initials(c.session.name)}</span>
          <h2>{c.session.name}</h2>
          <Badge>{c.role}</Badge>
          <div className="profile-details">
            <div>
              <span>Email address</span>
              <strong>{email}</strong>
            </div>
            <div>
              <span>Phone number</span>
              <strong>{g?.phone || 'Not provided'}</strong>
            </div>
            <div>
              <span>Address</span>
              <strong>{g?.address || 'Aureline Hotel'}</strong>
            </div>
            <div>
              <span>Account type</span>
              <strong>{c.role}</strong>
            </div>
          </div>
          {g && (
            <button
              className="button primary"
              onClick={() => c.setModal({ type: 'guestForm', item: g })}
            >
              <Pencil size={16} />
              Edit profile
            </button>
          )}
          <p className="info-note">
            <LockKeyhole size={15} />
            Change your password below to keep your account secure.
          </p>
          <form className="password-panel" onSubmit={changePassword}>
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={passwords.current}
              onChange={updatePassword('current')}
            />
            <div className="form-grid">
              <PasswordField
                label="New password"
                minLength={8}
                autoComplete="new-password"
                value={passwords.next}
                onChange={updatePassword('next')}
              />
              <PasswordField
                label="Confirm password"
                minLength={8}
                autoComplete="new-password"
                value={passwords.confirm}
                onChange={updatePassword('confirm')}
              />
            </div>
            {passwordError && (
              <p className="form-error" role="alert">
                {passwordError}
              </p>
            )}
            <button className="button secondary" disabled={busy}>
              {busy ? 'Updating...' : 'Change password'}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
