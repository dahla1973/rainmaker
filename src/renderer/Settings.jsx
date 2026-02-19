import React, { useState, useEffect } from 'react';

function SensorList({ source, label }) {
  const [sensors, setSensors] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [allSensors, config] = await Promise.all([
        window.rainmaker.getAvailableSensors(source),
        window.rainmaker.getConfig(),
      ]);

      setSensors(allSensors);

      const sourceConfig = config.sources?.[source];
      const currentIds = new Set(
        (sourceConfig?.metrics || []).map((m) => m.id)
      );
      // If no metrics configured, select all by default
      if (currentIds.size === 0 && allSensors.length > 0) {
        setSelected(new Set(allSensors.map((s) => s.id)));
      } else {
        setSelected(currentIds);
      }
      setLoading(false);
    }
    load();
  }, [source]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(sensors.map((s) => s.id))); }
  function selectNone() { setSelected(new Set()); }

  async function save() {
    setSaving(true);
    // Send {id, name} pairs so the widget shows friendly names
    const selection = sensors
      .filter((s) => selected.has(s.id))
      .map((s) => ({ id: s.id, name: s.label }));
    await window.rainmaker.saveSensorSelection(source, selection);
    setSaving(false);
  }

  if (loading) {
    return <p className="settings-loading">Loading {label} sensors...</p>;
  }

  if (sensors.length === 0) {
    return <p className="settings-loading">No {label} sensors found</p>;
  }

  return (
    <>
      <p className="settings-hint">{selected.size} of {sensors.length} selected</p>
      <div className="settings-actions">
        <button onClick={selectAll}>Select All</button>
        <button onClick={selectNone}>Select None</button>
      </div>
      <div className="sensor-list">
        {sensors.map((sensor) => (
          <label key={sensor.id} className="sensor-item">
            <input
              type="checkbox"
              checked={selected.has(sensor.id)}
              onChange={() => toggle(sensor.id)}
            />
            <span className="sensor-label">{sensor.label}</span>
            <span className="sensor-preview">{sensor.value}</span>
          </label>
        ))}
      </div>
      <div className="settings-footer">
        <button className="save-btn" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Apply'}
        </button>
      </div>
    </>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('boat');

  return (
    <div className="settings">
      <div className="tab-bar">
        <button className={`tab ${tab === 'boat' ? 'active' : ''}`} onClick={() => setTab('boat')}>Boat</button>
        <button className={`tab ${tab === 'netatmo' ? 'active' : ''}`} onClick={() => setTab('netatmo')}>Home (Netatmo)</button>
      </div>
      <div className="tab-content">
        {tab === 'boat' && <SensorList source="boat" label="Boat" />}
        {tab === 'netatmo' && <SensorList source="netatmo" label="Netatmo" />}
      </div>
    </div>
  );
}
