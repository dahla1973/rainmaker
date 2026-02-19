import React, { useState, useEffect } from 'react';
import MetricGroup from './MetricGroup';

export default function App() {
  const [groups, setGroups] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    if (window.rainmaker) {
      window.rainmaker.onMetricsUpdate((data) => {
        setGroups(data);
        setLastUpdate(new Date());
      });
    }
  }, []);

  return (
    <div className="widget">
      <div className="widget-header">
        <span className="widget-title">Rainmaker</span>
        {lastUpdate && (
          <span className="widget-time">
            {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div className="widget-body">
        {groups.length === 0 && (
          <div className="widget-loading">Connecting...</div>
        )}
        {groups.map((group) => (
          <MetricGroup key={group.name} group={group} />
        ))}
      </div>
    </div>
  );
}
