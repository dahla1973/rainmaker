const { fetchJSON, resolveUrl } = require('./api');

async function fetchAlarms(config, token) {
  try {
    const url = await resolveUrl(config, '/api/v1/alarms');
    const alarms = await fetchJSON(url, token);
    return Array.isArray(alarms) ? alarms : [];
  } catch (err) {
    if (!err.authFailed) console.error('Failed to fetch alarms:', err.message);
    return [];
  }
}

module.exports = { fetchAlarms };
