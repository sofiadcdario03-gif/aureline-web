import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, subtitle, children, onClose, wide = false }) {
  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', fn);
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">AURELINE HOTEL</div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={21} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
