import React from 'react';

export default function Badge({ children }) {
  return (
    <span className={`badge badge-${String(children).toLowerCase().replaceAll(' ', '-')}`}>
      {children}
    </span>
  );
}
