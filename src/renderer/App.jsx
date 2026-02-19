import React, { useState, useEffect, useRef, useCallback } from 'react';
import MetricGroup from './MetricGroup';

export default function App() {
  const [groups, setGroups] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef(null);

  useEffect(() => {
    if (window.rainmaker) {
      window.rainmaker.onMetricsUpdate((data) => {
        setGroups(data);
        setLastUpdate(new Date());
      });
    }
  }, []);

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setDragging(true);
    lastPos.current = { x: e.screenX, y: e.screenY };
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e) => {
      if (!lastPos.current || !window.rainmaker) return;
      const dx = e.screenX - lastPos.current.x;
      const dy = e.screenY - lastPos.current.y;
      lastPos.current = { x: e.screenX, y: e.screenY };
      window.rainmaker.drag(dx, dy);
    };

    const onMouseUp = () => {
      setDragging(false);
      lastPos.current = null;
      if (window.rainmaker) window.rainmaker.dragEnd();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  return (
    <div className="widget">
      <div
        className="widget-header"
        onMouseDown={onMouseDown}
        style={dragging ? { cursor: 'grabbing' } : undefined}
      >
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
