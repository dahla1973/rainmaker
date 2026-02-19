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

async function fetchBoatMetrics(config) {
  const { url, metrics: metricDefs } = config;

  try {
    const json = await fetchJSON(url);
    const sensorMap = {};
    for (const sensor of json.sensors) {
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
    };
  }
}

async function fetchAllSensors(url) {
  try {
    const json = await fetchJSON(url);
    return json.sensors.map((s) => ({
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
