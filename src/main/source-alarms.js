const http = require('http');

function fetchJSON(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.get({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 10000,
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

function deriveAlarmsUrl(sensorsUrl) {
  const u = new URL(sensorsUrl);
  return `${u.origin}/api/v1/alarms`;
}

async function fetchAlarms(sensorsUrl, token) {
  try {
    const url = deriveAlarmsUrl(sensorsUrl);
    const alarms = await fetchJSON(url, token);
    return Array.isArray(alarms) ? alarms : [];
  } catch (err) {
    if (!err.authFailed) console.error('Failed to fetch alarms:', err.message);
    return [];
  }
}

module.exports = { fetchAlarms };
