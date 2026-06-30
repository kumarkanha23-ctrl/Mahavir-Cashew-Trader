export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function parseDateInput(value) {
  if (!value) return todayISO();
  return value.slice(0, 10);
}

export function isWithinRange(isoDate, from, to) {
  if (!isoDate) return false;
  const d = isoDate.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function timestampISO() {
  return new Date().toISOString();
}
