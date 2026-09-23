export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function localDateTime(date = new Date()) {
  return `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function toInstant(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Ngày giờ không hợp lệ.');
  return date.toISOString();
}
