import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordField({ label = 'Password', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="password-input">
        <input {...props} type={visible ? 'text' : 'password'} required />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );
}
