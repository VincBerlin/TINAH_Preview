const DAY = 86400000;

export function todayISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return NaN;
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : NaN;
}

export function nextDay(value) {
  const timestamp = dateValue(value);
  return Number.isFinite(timestamp) ? new Date(timestamp + DAY).toISOString().slice(0, 10) : '';
}

export function validateStay({ guests, arrival, departure }, today = todayISO()) {
  if (!Number.isSafeInteger(Number(guests)) || Number(guests) < 1) {
    return { field: 'guests', message: 'Please enter the number of guests (at least 1).' };
  }
  if (!Number.isFinite(dateValue(arrival))) return { field: 'arrival', message: 'Please choose your arrival date.' };
  if (arrival < today) return { field: 'arrival', message: 'Please choose today or a future arrival date.' };
  if (!Number.isFinite(dateValue(departure))) return { field: 'departure', message: 'Please choose your departure date.' };
  if (departure <= arrival) return { field: 'departure', message: 'Departure must be after arrival.' };
  return null;
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(dateValue(value)));
}

export function stayDescription({ guests, arrival, departure }) {
  const nights = (dateValue(departure) - dateValue(arrival)) / DAY;
  return `Guests: ${guests}\nArrival: ${formatDate(arrival)}\nDeparture: ${formatDate(departure)}\nLength of stay: ${nights} ${nights === 1 ? 'night' : 'nights'}`;
}
