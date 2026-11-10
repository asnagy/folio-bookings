const pad = (n) => String(n).padStart(2, '0');

// ISO instant -> value for <input type="datetime-local"> (local time)
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// datetime-local value -> ISO instant (UTC)
export const toIso = (local) => (local ? new Date(local).toISOString() : undefined);
