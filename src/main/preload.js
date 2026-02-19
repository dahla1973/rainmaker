const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rainmaker', {
  onMetricsUpdate: (callback) => {
    ipcRenderer.on('metrics-update', (_event, data) => callback(data));
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  getAvailableSensors: (source) => ipcRenderer.invoke('get-available-sensors', source),
  saveSensorSelection: (source, ids) => ipcRenderer.invoke('save-sensor-selection', source, ids),
});
