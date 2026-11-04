/**
 * manifest.js
 *
 * Centralised stripes-connect manifest for ui-bookings.
 * All Okapi resource definitions live here so they can be shared
 * across connected components without duplication.
 */

export const BOOKINGS_RESOURCE = {
  type: 'okapi',
  path: 'bookings/bookings',
  records: 'bookings',
  recordsRequired: '%{resultCount}',
  perRequest: 100,
  GET: {
    params: {
      query: (queryParams, pathComponents, resourceValues) => {
        const { query, filters, sort } = resourceValues.query || {};
        const parts = [];
        if (query) parts.push(`(title="*${query}*" OR patronName="*${query}*")`);
        if (filters) parts.push(filters);
        const cql = parts.length ? parts.join(' AND ') : 'cql.allRecords=1';
        return sort ? `${cql} sortby ${sort}` : cql;
      },
    },
  },
};

export const BOOKING_RESOURCE = {
  type: 'okapi',
  path: 'bookings/bookings/!{bookingId}',
  records: 'bookings',
};

export const USERS_RESOURCE = {
  type: 'okapi',
  path: 'users',
  records: 'users',
  accumulate: true,
};

export const INVENTORY_ITEMS_RESOURCE = {
  type: 'okapi',
  path: 'inventory/items',
  records: 'items',
  accumulate: true,
  fetch: false,
};

export const SERVICE_POINTS_RESOURCE = {
  type: 'okapi',
  path: 'service-points',
  records: 'servicepoints',
};
