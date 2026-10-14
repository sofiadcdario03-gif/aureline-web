import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

function getPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  return strength;
}

function getStrengthColor(strength) {
  switch (strength) {
    case 0: return '#e0e0e0';
    case 1: return '#ff4d4f';
    case 2: return '#ff7a45';
    case 3: return '#ffc53d';
    case 4: return '#73d13d';
    case 5: return '#52c41a';
    default: return '#e0e0e0';
  }
}

function getStrengthLabel(strength) {
  switch (strength) {
    case 0: return '';
    case 1: return 'Weak';
    case 2: return 'Fair';
    case 3: return 'Good';
    case 4: return 'Strong';
    case 5: return 'Very Strong';
    default: return '';
  }
}

export default function PasswordField({ label = 'Password', showStrength = true, required = false, ...props }) {
  const [visible, setVisible] = useState(false);
  const strength = getPasswordStrength(props.value || '');
  const strengthColor = getStrengthColor(strength);
  const strengthLabel = getStrengthLabel(strength);

  const handleKeyDown = (e) => {
    if (e.key === ' ') {
      e.preventDefault();
    }
    if (props.onKeyDown) {
      props.onKeyDown(e);
    }
  };

  const { required: _required, ...inputProps } = props;

  return (
    <label className="field">
      <span>{label}{required && <span className="required">*</span>}</span>
      <div className="password-input">
        <input {...inputProps} type={visible ? 'text' : 'password'} required={required} maxLength={props.maxLength} onKeyDown={handleKeyDown} />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {showStrength && props.value && props.value.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div
            style={{
              height: '4px',
              borderRadius: '2px',
              backgroundColor: strengthColor,
              transition: 'background-color 0.3s ease',
              width: `${(strength / 5) * 100}%`,
            }}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            {strengthLabel}
          </div>
        </div>
      )}
    </label>
  );
}
