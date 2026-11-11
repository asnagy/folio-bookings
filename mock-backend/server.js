#!/usr/bin/env node
/**
 * Mock Bookings backend + pass-through proxy (for UI testing only).
 *
 *   TARGET=https://your-okapi-or-gateway-url node server.js
 *
 * - Requests under /bookings/* are answered from memory (sample data, resets on restart).
 * - Everything else is forwarded unchanged to TARGET (login, users, inventory, ...).
 * - Point Stripes at http://localhost:9130 (okapi.url in stripes.config.js.local).
 *
 * Zero dependencies; needs Node 18+.
 */
const http = require('http');
const https = require('https');
const { randomUUID } = require('crypto');

const TARGET = process.env.TARGET;
const PORT = Number(process.env.PORT || 9130);
if (!TARGET) {
  console.error('Set TARGET to the real FOLIO gateway URL, e.g. TARGET=https://folio-snapshot-okapi.dev.folio.org node server.js');
  process.exit(1);
}
const target = new URL(TARGET);
const client = target.protocol === 'https:' ? https : http;

// ---------------------------------------------------------------- data
const now = Date.now();
const day = 86400000;
const iso = (t) => new Date(t).toISOString();
const bookings = new Map();
const events = new Map();

const seed = [
  { userId: 'seed-1', patron: { firstName: 'Ada', lastName: 'Lovelace', barcode: '1001', patronGroup: 'staff' }, start: now + day, end: now + 3 * day, status: 'PENDING', notes: 'Conference loan',
    items: [{ itemId: randomUUID(), itemBarcode: '39001', itemTitle: 'The Analytical Engine', callNumber: 'QA76 .L68', itemStatus: 'Available', recallStatus: 'NOT_REQUIRED' }] },
  { userId: 'seed-2', patron: { firstName: 'Grace', lastName: 'Hopper', barcode: '1002', patronGroup: 'faculty' }, start: now + 2 * day, end: now + 5 * day, status: 'RECALL_TRIGGERED', notes: 'Class reserve',
    items: [{ itemId: randomUUID(), itemBarcode: '39002', itemTitle: 'Compilers', callNumber: 'QA76.76 .C65', itemStatus: 'Checked out', recallStatus: 'TRIGGERED' },
            { itemId: randomUUID(), itemBarcode: '39003', itemTitle: 'Programming Languages', callNumber: 'QA76.7', itemStatus: 'Available', recallStatus: 'NOT_REQUIRED' }] },
  { userId: 'seed-3', patron: { firstName: 'Alan', lastName: 'Turing', barcode: '1003', patronGroup: 'graduate' }, start: now - 2 * day, end: now + day, status: 'ACTIVE', notes: '',
    items: [{ itemId: randomUUID(), itemBarcode: '39004', itemTitle: 'Computability and Unsolvability', callNumber: 'QA9.59', itemStatus: 'Checked out', recallStatus: 'NOT_REQUIRED' }] },
  { userId: 'seed-4', patron: { firstName: 'Edsger', lastName: 'Dijkstra', barcode: '1004', patronGroup: 'faculty' }, start: now + 4 * day, end: now + 6 * day, status: 'RECALL_REQUIRED', notes: 'Needs recall before pickup',
    items: [{ itemId: randomUUID(), itemBarcode: '39005', itemTitle: 'A Discipline of Programming', callNumber: 'QA76.6', itemStatus: 'Checked out', recallStatus: 'REQUIRED' }] },
];
seed.forEach((s) => {
  const id = randomUUID();
  bookings.set(id, { id, userId: s.userId, patron: s.patron, startDate: iso(s.start), endDate: iso(s.end),
    status: s.status, notes: s.notes, items: s.items, metadata: { createdDate: iso(now), updatedDate: iso(now) } });
});

// ---------------------------------------------------------------- helpers
const cors = (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '600');
};

const json = (req, res, code, body) => {
  cors(req, res);
  if (body === undefined) { res.writeHead(code); res.end(); return; }
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { resolve({}); }
  });
});

// Forward a small JSON GET to the real backend using the caller's credentials.
const upstreamGet = (req, path) => new Promise((resolve) => {
  const headers = {};
  ['cookie', 'x-okapi-token', 'x-okapi-tenant', 'authorization'].forEach((h) => { if (req.headers[h]) headers[h] = req.headers[h]; });
  const r = client.request({ hostname: target.hostname, port: target.port || undefined, path, method: 'GET', headers }, (up) => {
    const chunks = [];
    up.on('data', (c) => chunks.push(c));
    up.on('end', () => {
      try { resolve(up.statusCode < 300 ? JSON.parse(Buffer.concat(chunks).toString()) : null); } catch (e) { resolve(null); }
    });
  });
  r.on('error', () => resolve(null));
  r.end();
});

const hasRecall = (b) => b.items.some((i) => i.recallStatus === 'REQUIRED' || i.recallStatus === 'TRIGGERED');

const deriveStatus = (b) => {
  if (['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(b.status)) return b.status;
  if (b.items.some((i) => i.recallStatus === 'REQUIRED')) return 'RECALL_REQUIRED';
  if (b.items.some((i) => i.recallStatus === 'TRIGGERED')) return 'RECALL_TRIGGERED';
  return 'PENDING';
};

const buildItems = async (req, itemIds = []) => Promise.all(itemIds.map(async (itemId) => {
  const it = await upstreamGet(req, `/inventory/items/${itemId}`);
  const status = it?.status?.name || 'Available';
  return {
    itemId,
    instanceId: it?.instanceId,
    holdingsRecordId: it?.holdingsRecordId,
    itemBarcode: it?.barcode || '',
    itemTitle: it?.title || it?.instanceTitle || 'Item',
    callNumber: it?.effectiveCallNumberComponents?.callNumber || '',
    itemStatus: status,
    recallStatus: status === 'Checked out' ? 'REQUIRED' : 'NOT_REQUIRED',
  };
}));

const buildPatron = async (req, userId) => {
  const u = await upstreamGet(req, `/users/${userId}`);
  if (!u) return { firstName: '', lastName: userId };
  return { firstName: u.personal?.firstName || '', lastName: u.personal?.lastName || u.username || userId, barcode: u.barcode, patronGroup: u.patronGroup };
};

// Very small CQL understanding: free text, status==(...), recallRequired==..., sortby
const listBookings = (cql = '') => {
  let rows = [...bookings.values()];
  const text = [...cql.matchAll(/(?:title|patronName)="\*([^*"]*)\*"/g)][0]?.[1];
  if (text) {
    const q = text.toLowerCase();
    rows = rows.filter((b) => JSON.stringify([b.patron, b.notes, b.items.map((i) => [i.itemTitle, i.itemBarcode])]).toLowerCase().includes(q));
  }
  const st = cql.match(/status==(\([^)]*\)|"[^"]*")/);
  if (st) {
    const wanted = [...st[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    rows = rows.filter((b) => wanted.includes(b.status));
  }
  const ev = cql.match(/eventId=="?([0-9a-f-]{36})"?/);
  if (ev) rows = rows.filter((b) => b.eventId === ev[1]);
  if (/recallRequired=="true"/.test(cql)) rows = rows.filter(hasRecall);
  const sort = cql.match(/sortby\s+(\S+)(?:\/sort\.(ascending|descending))?/);
  if (sort) {
    let key = sort[1];
    let desc = sort[2] === 'descending';
    if (key.startsWith('-')) { key = key.slice(1); desc = true; }
    const val = (b) => (key === 'patronName' ? `${b.patron?.lastName}` : key === 'itemCount' ? b.items.length : b[key]);
    rows.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (desc ? -1 : 1));
  }
  return rows;
};

// ---------------------------------------------------------------- bookings API
async function handleBookings(req, res, url) {
  const parts = url.pathname.replace(/^\/bookings\/bookings\/?/, '').split('/').filter(Boolean);
  const [id, action] = parts;

  if (!id && req.method === 'GET') {
    const rows = listBookings(url.searchParams.get('query') || '');
    const limit = Number(url.searchParams.get('limit') || 100);
    const offset = Number(url.searchParams.get('offset') || 0);
    return json(req, res, 200, { bookings: rows.slice(offset, offset + limit), totalRecords: rows.length });
  }
  if (!id && req.method === 'POST') {
    const p = await readBody(req);
    const items = await buildItems(req, p.itemIds);
    const b = {
      id: randomUUID(), userId: p.userId, patron: await buildPatron(req, p.userId),
      startDate: p.startDate, endDate: p.endDate, notes: p.notes, pickupServicePointId: p.delivered ? undefined : p.pickupServicePointId,
      delivered: Boolean(p.delivered), deliveryLocation: p.delivered ? p.deliveryLocation : undefined,
      pickupByUserId: p.pickupByUserId, eventId: p.eventId, eventName: events.get(p.eventId)?.name,
      items, status: 'PENDING', metadata: { createdDate: iso(Date.now()), updatedDate: iso(Date.now()) },
    };
    b.status = deriveStatus(b);
    bookings.set(b.id, b);
    return json(req, res, 201, b);
  }
  const b = bookings.get(id);
  if (!b) return json(req, res, 404, { errors: [{ message: 'Booking not found' }] });

  if (req.method === 'GET' && !action) return json(req, res, 200, b);
  if (req.method === 'DELETE') { bookings.delete(id); return json(req, res, 204); }
  if (req.method === 'PUT') {
    const p = await readBody(req);
    if (p.userId !== b.userId) { b.userId = p.userId; b.patron = await buildPatron(req, p.userId); }
    const keep = new Map(b.items.map((i) => [i.itemId, i]));
    b.items = await Promise.all((p.itemIds || []).map(async (iid) => keep.get(iid) || (await buildItems(req, [iid]))[0]));
    Object.assign(b, { startDate: p.startDate, endDate: p.endDate, notes: p.notes,
      pickupServicePointId: p.delivered ? undefined : p.pickupServicePointId,
      delivered: Boolean(p.delivered), deliveryLocation: p.delivered ? p.deliveryLocation : undefined,
      pickupByUserId: p.pickupByUserId, eventId: p.eventId, eventName: events.get(p.eventId)?.name });
    b.status = deriveStatus(b);
    b.metadata.updatedDate = iso(Date.now());
    return json(req, res, 204);
  }
  if (req.method === 'POST' && action === 'activate') {
    b.status = 'ACTIVE';
    b.items.forEach((i) => { i.itemStatus = 'Checked out'; });
    b.metadata.updatedDate = iso(Date.now());
    return json(req, res, 200, b);
  }
  return json(req, res, 404, { errors: [{ message: 'Not found' }] });
}

// ---------------------------------------------------------------- events API
async function handleEvents(req, res, url) {
  const [id] = url.pathname.replace(/^\/bookings\/events\/?/, '').split('/').filter(Boolean);
  if (!id && req.method === 'GET') {
    const rows = [...events.values()].sort((a, b) => a.name.localeCompare(b.name));
    return json(req, res, 200, { events: rows, totalRecords: rows.length });
  }
  if (!id && req.method === 'POST') {
    const p = await readBody(req);
    if (!p.name) return json(req, res, 422, { errors: [{ message: 'name is required' }] });
    const ev = { id: randomUUID(), name: p.name, description: p.description, startDate: p.startDate, endDate: p.endDate };
    events.set(ev.id, ev);
    return json(req, res, 201, ev);
  }
  const ev = events.get(id);
  if (!ev) return json(req, res, 404, { errors: [{ message: 'Event not found' }] });
  if (req.method === 'GET') return json(req, res, 200, ev);
  if (req.method === 'PUT') { Object.assign(ev, await readBody(req), { id }); return json(req, res, 204); }
  if (req.method === 'DELETE') {
    if ([...bookings.values()].some((b) => b.eventId === id)) {
      return json(req, res, 422, { errors: [{ message: 'Event is used by bookings and cannot be deleted' }] });
    }
    events.delete(id);
    return json(req, res, 204);
  }
  return json(req, res, 404, { errors: [{ message: 'Not found' }] });
}

// ---------------------------------------------------------------- proxy
function proxy(req, res) {
  const headers = { ...req.headers, host: target.host };
  delete headers.origin; delete headers.referer; delete headers['accept-encoding'];
  const up = client.request({ hostname: target.hostname, port: target.port || undefined, path: req.url, method: req.method, headers }, (r) => {
    const out = { ...r.headers };
    delete out['access-control-allow-origin']; delete out['access-control-allow-credentials'];
    delete out['access-control-expose-headers']; delete out['access-control-allow-headers']; delete out['access-control-allow-methods'];
    if (out['set-cookie']) {
      // Make upstream cookies usable on http://localhost
      out['set-cookie'] = [].concat(out['set-cookie']).map((c) => c
        .replace(/;\s*Domain=[^;]*/i, '')
        .replace(/;\s*Secure/i, '')
        .replace(/;\s*SameSite=[^;]*/i, '; SameSite=Lax'));
    }
    cors(req, res);
    res.writeHead(r.statusCode, out);
    r.pipe(res);
  });
  up.on('error', (e) => json(req, res, 502, { errors: [{ message: `Proxy error: ${e.message}` }] }));
  req.pipe(up);
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { cors(req, res); res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/bookings/events')) {
    return handleEvents(req, res, url).catch((e) => json(req, res, 500, { errors: [{ message: e.message }] }));
  }
  if (url.pathname.startsWith('/bookings/bookings')) {
    return handleBookings(req, res, url).catch((e) => json(req, res, 500, { errors: [{ message: e.message }] }));
  }
  return proxy(req, res);
}).listen(PORT, () => console.log(`Mock bookings backend on http://localhost:${PORT}, forwarding the rest to ${TARGET}`));
