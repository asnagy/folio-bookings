export const DEFAULT_RECALL_LEAD_DAYS = 3;
export const DEFAULT_CHECKOUT_LEAD_MINUTES = 0;

/** "" -> null (not set); "3" -> 3; anything else that is not a whole number >= 0 -> null as well. */
export const parseLimit = (text) => {
  const trimmed = String(text ?? '').trim();
  return /^\d{1,6}$/.test(trimmed) ? parseInt(trimmed, 10) : null;
};

/**
 * Builds the "limits" settings value. Blank group fields are left out so the default applies.
 * Shape is read by mod-bookings-bl: { defaultLimit, byPatronGroup: { <groupId>: n }, allowOverride }.
 */
export const serializeLimits = ({ defaultLimit, byGroup, allowOverride }) => {
  const byPatronGroup = {};
  Object.entries(byGroup || {}).forEach(([groupId, text]) => {
    const limit = parseLimit(text);
    if (limit !== null) byPatronGroup[groupId] = limit;
  });
  const value = { byPatronGroup, allowOverride: Boolean(allowOverride) };
  const def = parseLimit(defaultLimit);
  if (def !== null) value.defaultLimit = def;
  return value;
};
