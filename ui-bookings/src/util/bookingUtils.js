/**
 * bookingUtils.js
 * Shared utility functions for the ui-bookings module.
 */

/**
 * Format an ISO date-time string for display in the UI.
 * Returns a locale-aware date + time string, or '—' if falsy.
 */
export const formatDateTimeDisplay = (isoString) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      year:   'numeric',
      month:  '2-digit',
      day:    '2-digit',
      hour:   '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
};

/**
 * Map a booking status code to its i18n message id.
 * Use <FormattedMessage> in components; this returns the raw key
 * for contexts where intl.formatMessage is available.
 */
export const getBookingStatusLabel = (status) => {
  if (!status) return '';
  // Callers can pass this key to intl.formatMessage
  return `ui-bookings.status.${status.toLowerCase()}`;
};

/**
 * Returns true when a booking has one or more items requiring recall.
 */
export const hasRecallItems = (booking) => {
  if (!booking?.items) return false;
  return booking.items.some(
    item => item.recallStatus === 'REQUIRED' || item.recallStatus === 'TRIGGERED'
  );
};

/**
 * Returns true when a booking can be manually activated.
 */
export const canActivateBooking = (booking) => {
  const activatableStatuses = ['PENDING', 'CONFIRMED', 'RECALL_TRIGGERED'];
  return activatableStatuses.includes(booking?.status);
};

/**
 * Build a CQL query fragment for booking search.
 */
export const buildBookingSearchQuery = ({ query, filters, sort } = {}) => {
  const parts = [];

  if (query?.trim()) {
    // Search across patron name representation and booking notes
    parts.push(`(notes="*${query.trim()}*")`);
  }

  if (filters?.trim()) {
    parts.push(filters);
  }

  const cql = parts.length > 0 ? parts.join(' AND ') : 'cql.allRecords=1';
  return sort ? `${cql} sortby ${sort}` : cql;
};

/**
 * Path in the Inventory app for a booked item: the item's record view when the booking item carries
 * the instance, holdings and item ids, otherwise (e.g. bookings saved before the ids were recorded)
 * an Inventory search for its barcode. Null when neither is possible.
 */
export const inventoryItemPath = (item) => {
  if (!item) return null;
  if (item.instanceId && item.holdingsRecordId && item.itemId) {
    return `/inventory/view/${item.instanceId}/${item.holdingsRecordId}/${item.itemId}`;
  }
  return item.itemBarcode
    ? `/inventory?qindex=items.barcode&query=${encodeURIComponent(item.itemBarcode)}`
    : null;
};
