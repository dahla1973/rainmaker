const { fetchJSON, resolveUrl } = require('./api');

async function fetchBoatMetrics(config, token) {
  const { metrics: metricDefs } = config;

  try {
    const url = await resolveUrl(config);
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

async function fetchAllSensors(config, token) {
  try {
    const url = await resolveUrl(config);
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
