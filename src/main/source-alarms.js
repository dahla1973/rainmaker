const http = require('http');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function deriveAlarmsUrl(sensorsUrl) {
  const u = new URL(sensorsUrl);
  return `${u.origin}/api/v1/alarms`;
}

async function fetchAlarms(sensorsUrl) {
  try {
    const url = deriveAlarmsUrl(sensorsUrl);
    const alarms = await fetchJSON(url);
    return Array.isArray(alarms) ? alarms : [];
  } catch (err) {
    console.error('Failed to fetch alarms:', err.message);
    return [];
  }
}

module.exports = { fetchAlarms };
