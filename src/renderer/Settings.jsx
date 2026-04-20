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

function AccountTab() {
  const [status, setStatus] = useState({ signedIn: false, email: null });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function refresh() {
    setStatus(await window.rainmaker.firebaseStatus());
  }

  useEffect(() => { refresh(); }, []);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await window.rainmaker.firebaseSignIn(email, password);
    setBusy(false);
    if (res.ok) {
      setEmail('');
      setPassword('');
      refresh();
    } else {
      setError(res.error || 'Sign-in failed');
    }
  }

  async function signOut() {
    await window.rainmaker.firebaseSignOut();
    refresh();
  }

  if (status.signedIn) {
    return (
      <div className="account-signed-in">
        <p className="settings-hint">Signed in as <strong>{status.email}</strong></p>
        <p className="settings-hint">Rainmaker uses this account's Firebase ID token to read from the Zandrom API.</p>
        <div className="settings-footer">
          <button className="save-btn" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <form className="account-signin" onSubmit={signIn}>
      <p className="settings-hint">
        Sign in with a Firebase account (non-admin recommended — rainmaker only needs reads).
      </p>
      <label className="account-field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label className="account-field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p className="account-error">{error}</p>}
      <div className="settings-footer">
        <button type="submit" className="save-btn" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    </form>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('boat');

  return (
    <div className="settings">
      <div className="tab-bar">
        <button className={`tab ${tab === 'boat' ? 'active' : ''}`} onClick={() => setTab('boat')}>Boat</button>
        <button className={`tab ${tab === 'netatmo' ? 'active' : ''}`} onClick={() => setTab('netatmo')}>Home (Netatmo)</button>
        <button className={`tab ${tab === 'account' ? 'active' : ''}`} onClick={() => setTab('account')}>Account</button>
      </div>
      <div className="tab-content">
        {tab === 'boat' && <SensorList source="boat" label="Boat" />}
        {tab === 'netatmo' && <SensorList source="netatmo" label="Netatmo" />}
        {tab === 'account' && <AccountTab />}
      </div>
    </div>
  );
}
