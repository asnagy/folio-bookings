#!/usr/bin/env node
/**
 * Local development gateway for the Bookings modules.
 *
 * Stands in for the FOLIO gateway on your laptop:
 *   /bookings/*          -> mod-bookings-bl   (BL_URL)
 *   /bookings-storage/*  -> mod-bookings      (STORAGE_URL)
 *   everything else      -> your real FOLIO   (TARGET_URL): login, users, inventory, circulation...
 *
 * Point Stripes at this gateway (okapi.url = http://localhost:9130). The Bookings modules call
 * Users, Inventory and Circulation back through this same gateway, so they use the signed-in
 * user's own credentials on the real FOLIO.
 *
 * Zero dependencies; Node 18+.
 */
const http = require('http');
const https = require('https');

const PORT = Number(process.env.PORT || 9130);
const TARGET_URL = process.env.TARGET_URL;
const BL_URL = process.env.BL_URL || 'http://localhost:8082';
const STORAGE_URL = process.env.STORAGE_URL || 'http://localhost:8081';

if (!TARGET_URL) {
  console.error('Set TARGET_URL to your FOLIO gateway URL (the okapi.url your platform used before).');
  process.exit(1);
}

const upstreams = {
  bl: new URL(BL_URL),
  storage: new URL(STORAGE_URL),
  folio: new URL(TARGET_URL),
};

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

const pick = (path) => {
  if (path.startsWith('/bookings-storage/')) return { name: 'storage', up: upstreams.storage };
  if (path.startsWith('/bookings/')) return { name: 'bl', up: upstreams.bl };
  return { name: 'folio', up: upstreams.folio };
};

function forward(req, res, { name, up }) {
  const client = up.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: up.host };
  if (name === 'folio') {
    // Real FOLIO is a different origin than the browser's; hide the browser origin from it
    delete headers.origin;
    delete headers.referer;
  }
  delete headers['accept-encoding'];

  const proxied = client.request(
    { hostname: up.hostname, port: up.port || undefined, path: req.url, method: req.method, headers },
    (r) => {
      const out = { ...r.headers };
      for (const h of Object.keys(out)) {
        if (h.startsWith('access-control-')) delete out[h];
      }
      if (out['set-cookie']) {
        // Make FOLIO's cookies usable on http://localhost
        out['set-cookie'] = [].concat(out['set-cookie']).map((c) => c
          .replace(/;\s*Domain=[^;]*/i, '')
          .replace(/;\s*Secure/i, '')
          .replace(/;\s*SameSite=[^;]*/i, '; SameSite=Lax'));
      }
      cors(req, res);
      res.writeHead(r.statusCode, out);
      r.pipe(res);
    },
  );
  proxied.on('error', (e) => {
    cors(req, res);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ errors: [{ message: `Gateway could not reach ${name}: ${e.message}` }] }));
  });
  req.pipe(proxied);
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    cors(req, res);
    res.writeHead(204);
    return res.end();
  }
  const route = pick(req.url.split('?')[0]);
  return forward(req, res, route);
}).listen(PORT, () => {
  console.log(`Dev gateway on :${PORT}  bookings->${BL_URL}  storage->${STORAGE_URL}  other->${TARGET_URL}`);
});
