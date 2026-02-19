import React from 'react';
import MetricRow from './MetricRow';

export default function MetricGroup({ group }) {
  return (
    <div className="metric-group">
      <div className="group-header">{group.name}</div>
      <div className="group-metrics">
        {group.metrics.map((metric) => (
          <MetricRow key={metric.name} metric={metric} />
        ))}
      </div>
    </div>
  );
}
