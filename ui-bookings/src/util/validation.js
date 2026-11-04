/**
 * validation.js
 * Final-form field validators for the Bookings app.
 */

export const validateRequired = (value) => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return 'ui-bookings.validation.required';
  }
  return undefined;
};

export const validateDateOrder = (startDate, endDate) => {
  if (!startDate || !endDate) return undefined;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (s >= e) return 'ui-bookings.validation.endAfterStart';
  return undefined;
};

export const validateUUID = (value) => {
  if (!value) return undefined;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(value)) return 'ui-bookings.validation.invalidUUID';
  return undefined;
};
