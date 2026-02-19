import React from 'react';

export default function MetricRow({ metric }) {
  const hasError = metric.error !== null;

  return (
    <div className={`metric-row ${hasError ? 'metric-error' : ''}`}>
      <span className="metric-name">{metric.name}</span>
      <span className="metric-value">
        {metric.value}
        {metric.unit && <span className="metric-unit"> {metric.unit}</span>}
      </span>
    </div>
  );
}
