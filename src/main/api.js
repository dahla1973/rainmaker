const http = require('http');
const https = require('https');

// Protocol-aware JSON GET. Picks http/https from the URL so the same code can
// talk to the LAN host (http://fitpc.yoda.nu) and the public host
// (https://sofiacarolina.yoda.nu).
function fetchJSON(url, token, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const isHttps = u.protocol === 'https:';
    const mod = isHttps ? https : http;
    const req = mod.get({
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          const err = new Error(`Auth failed (${res.statusCode})`);
          err.authFailed = true;
          reject(err);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

// Returns true if the origin answers the ping endpoint at all. Any HTTP
// response (even 401) means the host is reachable; only network
// errors/timeouts count as unreachable.
function isReachable(origin, timeout = 2500) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL('/api/v1/system/ping', origin);
    } catch {
      resolve(false);
      return;
    }
    const isHttps = u.protocol === 'https:';
    const mod = isHttps ? https : http;
    const req = mod.get({
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname,
      timeout,
    }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// Cache the resolved origin briefly so we don't ping on every metric tick.
const RESOLVE_TTL_MS = 30_000;
let cachedOrigin = null;
let cachedAt = 0;

// Picks the active API origin: prefer the LAN host, fall back to the public
// host when the LAN host is unreachable. With no publicUrl configured this
// just returns the primary origin.
async function resolveOrigin(boatConfig) {
  const lanOrigin = new URL(boatConfig.url).origin;
  const publicOrigin = boatConfig.publicUrl ? new URL(boatConfig.publicUrl).origin : null;
  if (!publicOrigin) return lanOrigin;

  const now = Date.now();
  if (cachedOrigin && now - cachedAt < RESOLVE_TTL_MS) return cachedOrigin;

  const lanUp = await isReachable(lanOrigin);
  cachedOrigin = lanUp ? lanOrigin : publicOrigin;
  cachedAt = now;
  return cachedOrigin;
}

// Builds an endpoint URL on the active origin, carrying the path+query from a
// template URL (the configured sensors URL) when no explicit path is given.
async function resolveUrl(boatConfig, path) {
  const origin = await resolveOrigin(boatConfig);
  if (path) return origin + path;
  const template = new URL(boatConfig.url);
  return origin + template.pathname + template.search;
}

module.exports = { fetchJSON, resolveUrl };
