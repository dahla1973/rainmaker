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

async function fetchBoatMetrics(config, token) {
  const { url, metrics: metricDefs } = config;

  try {
    const sensors = await fetchJSON(url, token);
    const sensorMap = {};
    for (const sensor of sensors) {
      sensorMap[sensor.id] = sensor;
    }

    const metrics = metricDefs.map((def) => {
      const sensor = sensorMap[def.id];
      if (!sensor) {
        return { name: def.name, value: '—', unit: '', error: 'not found' };
      }
      return {
        name: def.name,
        value: sensor.formattedValue || '—',
        unit: '',
        error: null,
      };
    });

    return { name: 'Boat', metrics };
  } catch (err) {
    return {
      name: 'Boat',
      metrics: metricDefs.map((def) => ({
        name: def.name,
        value: '—',
        unit: '',
        error: err.message,
      })),
      authFailed: err.authFailed === true,
    };
  }
}

async function fetchAllSensors(url, token) {
  try {
    const sensors = await fetchJSON(url, token);
    return sensors.map((s) => ({
      id: s.id,
      label: s.label,
      unit: s.unit,
      value: s.formattedValue || '—',
    }));
  } catch (err) {
    console.error('Failed to fetch sensors:', err.message);
    return [];
  }
}

module.exports = { fetchBoatMetrics, fetchAllSensors };
