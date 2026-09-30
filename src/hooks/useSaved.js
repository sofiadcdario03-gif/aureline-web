import { useEffect, useState } from 'react';

export default function useSaved(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initialValue : JSON.parse(stored);
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Preserve in-memory state when browser storage is unavailable. */
    }
  }, [key, value]);
  return [value, setValue];
}
