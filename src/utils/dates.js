export const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const nights = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
export const dateLabel = (date, options = { month: 'short', day: 'numeric' }) =>
  new Date(date + 'T12:00:00').toLocaleDateString('en-US', options);
