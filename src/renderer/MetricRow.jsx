import React from 'react';

export default function MetricRow({ metric }) {
  const hasError = metric.error !== null;
  const isOld = metric.old === true;

  return (
    <div className={`metric-row ${hasError ? 'metric-error' : ''} ${isOld ? 'metric-old' : ''}`}>
      <span className="metric-name">{metric.name}</span>
      <span
        className="metric-value"
        title={isOld && metric.lastUpdated ? `Stale — last updated ${metric.lastUpdated}` : undefined}
      >
        {metric.value}
        {metric.unit && <span className="metric-unit"> {metric.unit}</span>}
      </span>
    </div>
  );
}
