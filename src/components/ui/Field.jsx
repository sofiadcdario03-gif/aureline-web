import React from 'react';

export default function Field({ label, required = false, children, ...props }) {
  const { required: _required, ...inputProps } = props;
  return (
    <label className="field">
      <span>{label}{required && <span className="required">*</span>}</span>
      {children || <input {...inputProps} />}
    </label>
  );
}
