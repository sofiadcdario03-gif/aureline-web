import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import Modal from '../ui/Modal.jsx';

export default function OTPModal({ email, purpose, onVerified, onClose }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    sendOTP();
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const sendOTP = async () => {
    try {
      await api.post('/otp/send', {
        email,
        purpose,
      });
      setError('');
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    }
  };

  const handleResend = async () => {
    setBusy(true);
    await sendOTP();
    setTimeLeft(60);
    setCanResend(false);
    setOtp(['', '', '', '', '', '']);
    setError('');
    setBusy(false);
    inputRefs.current[0]?.focus();
  };

  const handleInputChange = (index, value) => {
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only take last character
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    const newOtp = pastedData.split('').slice(0, 6);
    setOtp([...newOtp, ...Array(6 - newOtp.length).fill('')]);
    inputRefs.current[Math.min(newOtp.length, 5)]?.focus();
  };

  const handleVerify = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post('/otp/verify', {
        email,
        otp: otpValue,
      });

      if (data.message === 'OTP verified successfully') {
        await onVerified(data);
        onClose();
      }
    } catch (err) {
      setError('Invalid or expired OTP');
    } finally {
      setBusy(false);
    }
  };

  const isComplete = otp.every((digit) => digit !== '');

  return (
    <Modal
      title="Verify your email"
      subtitle={`Enter the 6-digit code sent to ${email}`}
      onClose={onClose}
    >
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            style={{
              width: '50px',
              height: '60px',
              fontSize: '24px',
              textAlign: 'center',
              borderRadius: '8px',
              border: '1px solid #ccc',
              fontWeight: 'bold',
            }}
          />
        ))}
      </div>

      {error && (
        <p className="form-error" style={{ textAlign: 'center' }}>
          {error}
        </p>
      )}

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        {timeLeft > 0 ? (
          <p style={{ color: '#666' }}>
            Code expires in{' '}
            <strong>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </strong>
          </p>
        ) : (
          <button
            type="button"
            className="text-button"
            onClick={handleResend}
            disabled={busy}
            style={{ fontSize: '14px' }}
          >
            {busy ? 'Sending...' : 'Resend code'}
          </button>
        )}
      </div>

      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary" onClick={handleVerify} disabled={busy || !isComplete}>
          {busy ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    </Modal>
  );
}
