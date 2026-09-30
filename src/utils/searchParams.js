import { day } from '../data.js';

export function readStaySearch(params) {
  const start = params.get('start');
  const end = params.get('end');
  const count = Number(params.get('guests'));
  const validDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (
    !validDate(start) ||
    !validDate(end) ||
    start < day() ||
    end <= start ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 4
  )
    return null;
  return { start, end, count };
}
