import React, { useState, useEffect, useRef } from 'react';

function playAlarmSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // Two-tone alert: 880 Hz then 660 Hz, ~500ms total
    [[880, 0], [660, 0.22]].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.22);
    });
    setTimeout(() => ctx.close(), 800);
  } catch (e) {
    console.error('Alarm sound failed:', e);
  }
}

export default function AlarmBadges({ alarms }) {
  const [expanded, setExpanded] = useState(false);
  const prevErrorCount = useRef(0);

  const errors = alarms.filter((a) => a.alarmType === 'Error');
  const warnings = alarms.filter((a) => a.alarmType === 'Warning');

  useEffect(() => {
    if (window.rainmaker?.onNewAlarms) {
      window.rainmaker.onNewAlarms(() => playAlarmSound());
    }
  }, []);

  useEffect(() => {
    if (errors.length > prevErrorCount.current && prevErrorCount.current !== 0) {
      playAlarmSound();
    }
    prevErrorCount.current = errors.length;
  }, [errors.length]);

  const total = errors.length + warnings.length;
  if (total === 0) return null;

  return (
    <div className="alarm-badges-wrap">
      <button
        className="alarm-badges"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setExpanded((v) => !v)}
        title={`${errors.length} alarm${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`}
      >
        {errors.length > 0 && (
          <span className="badge badge-error">
            <span className="badge-icon">!</span>
            <span className="badge-count">{errors.length}</span>
          </span>
        )}
        {warnings.length > 0 && (
          <span className="badge badge-warning">
            <span className="badge-icon">△</span>
            <span className="badge-count">{warnings.length}</span>
          </span>
        )}
      </button>
      {expanded && (
        <div className="alarm-panel">
          {errors.concat(warnings).map((a) => (
            <div
              key={`${a.name}-${a.start ?? 0}`}
              className={`alarm-item alarm-${a.alarmType.toLowerCase()}`}
            >
              <div className="alarm-name">{a.name}</div>
              <div className="alarm-meta">
                <span className="alarm-current">{a.currentValue}</span>
                {a.triggerValue && (
                  <span className="alarm-trigger">trigger {a.triggerValue}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
