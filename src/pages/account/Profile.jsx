import React, { useState } from 'react';
import { Pencil, LockKeyhole } from 'lucide-react';
import axios from 'axios';
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
  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState(staffAccount?.phone || '');
  const [phoneError, setPhoneError] = useState('');
  const [pendingPasswordData, setPendingPasswordData] = useState(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    c.isGuest ? (g?.twoFactorEnabled || false) : (staffAccount?.twoFactorEnabled || false)
  );

  const startEditingPhone = () => {
    setEditingPhone(true);
    // Set default prefix if phone is empty
    if (!phone || phone === 'Not provided') {
      setPhone('+63 9');
    }
  };
  const updatePassword = (key) => (event) =>
    setPasswords({ ...passwords, [key]: event.target.value });

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
    setPhone(formatted);
    
    // Validation
    if (limitedPhoneDigits.length < 9) {
      setPhoneError('Phone number must be exactly 9 digits');
    } else {
      setPhoneError('');
    }
  };

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
      
      // Store pending password data for after OTP verification
      setPendingPasswordData({
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      
      // Show OTP modal (it will send the OTP on mount)
      c.setModal({
        type: 'otp',
        email: email.toLowerCase(),
        purpose: 'Password Change',
        onVerified: async () => {
          if (c.isGuest) {
            const credential = await createAccountCredential(c.session.guestId, passwords.next);
            c.setAccounts([
              ...c.accounts.filter((account) => account.guestId !== c.session.guestId),
              credential,
            ]);
          } else {
            // Update password in database
            await axios.put(`http://localhost:5000/api/staff/${c.session.staffId}/password`, {
              currentPassword: passwords.current,
              newPassword: passwords.next,
            });
            // Reload staff from database
            await c.reloadStaff();
          }
          setPasswords({ current: '', next: '', confirm: '' });
          c.notify('Password updated. Please sign in again.');
          // Logout after password change
          setTimeout(() => {
            c.setSession(null);
            c.navigate('/login');
          }, 1500);
        },
      });
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('Current password is incorrect.');
    } finally {
      setBusy(false);
    }
  }

  async function savePhone() {
    setBusy(true);
    try {
      // Validate phone number
      const digits = phone.replace(/\D/g, '');
      const phoneDigits = digits.startsWith('639') ? digits.slice(3) : digits;
      if (phoneDigits.length < 9) {
        setPhoneError('Phone number must be exactly 9 digits');
        setBusy(false);
        return;
      }
      
      // Format phone number
      const formattedPhone = '+63 9' + phoneDigits.slice(0, 9);
      
      await axios.put(`http://localhost:5000/api/staff/${c.session.staffId}`, {
        ...staffAccount,
        phone: formattedPhone,
      });
      await c.reloadStaff();
      setEditingPhone(false);
      setPhoneError('');
      c.notify('Phone number updated.');
    } catch (error) {
      console.error('Error updating phone:', error);
      c.notify('Failed to update phone number.');
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
              {editingPhone && !c.isGuest ? (
                <div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '4px' }}
                  />
                  {phoneError && <p className="form-error" style={{ fontSize: '12px' }}>{phoneError}</p>}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      className="button primary"
                      onClick={savePhone}
                      disabled={busy || phoneError}
                      style={{ padding: '4px 12px', fontSize: '14px' }}
                    >
                      {busy ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setEditingPhone(false);
                        setPhone(staffAccount?.phone || '');
                        setPhoneError('');
                      }}
                      style={{ padding: '4px 12px', fontSize: '14px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>{c.isGuest ? (g?.phone || 'Not provided') : (staffAccount?.phone || 'Not provided')}</strong>
                  {!c.isGuest && (
                    <button
                      className="icon-button"
                      onClick={startEditingPhone}
                      style={{ padding: '4px' }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              )}
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
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={twoFactorEnabled}
                onChange={async (e) => {
                  setTwoFactorEnabled(e.target.checked);
                  if (c.isGuest) {
                    c.setGuests(c.guests.map(g => g.id === c.session.guestId ? { ...g, twoFactorEnabled: e.target.checked } : g));
                  } else {
                    await axios.put(`http://localhost:5000/api/staff/${c.session.staffId}`, {
                      ...staffAccount,
                      twoFactorEnabled: e.target.checked,
                    });
                    await c.reloadStaff();
                  }
                  c.notify(e.target.checked ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled');
                }}
                style={{ width: '18px', height: '18px' }}
              />
              <span>Enable two-factor authentication</span>
            </label>
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
              showStrength={false}
              maxLength={64}
              value={passwords.current}
              onChange={updatePassword('current')}
            />
            <div className="form-grid">
              <PasswordField
                label="New password"
                minLength={8}
                autoComplete="new-password"
                maxLength={64}
                value={passwords.next}
                onChange={updatePassword('next')}
              />
              <PasswordField
                label="Confirm password"
                minLength={8}
                autoComplete="new-password"
                showStrength={false}
                maxLength={64}
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
              {busy ? 'Updating...' : 'Change password (will logout)'}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
