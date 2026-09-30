import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button className="icon-button" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
