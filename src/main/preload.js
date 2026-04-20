const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rainmaker', {
  onMetricsUpdate: (callback) => {
    ipcRenderer.on('metrics-update', (_event, data) => callback(data));
  },
  onNewAlarms: (callback) => {
    ipcRenderer.on('alarms-new', (_event, alarms) => callback(alarms));
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  getAvailableSensors: (source) => ipcRenderer.invoke('get-available-sensors', source),
  saveSensorSelection: (source, ids) => ipcRenderer.invoke('save-sensor-selection', source, ids),
  drag: (deltaX, deltaY) => ipcRenderer.send('widget-drag', deltaX, deltaY),
  dragEnd: () => ipcRenderer.send('widget-drag-end'),
  firebaseStatus: () => ipcRenderer.invoke('firebase-status'),
  firebaseSignIn: (email, password) => ipcRenderer.invoke('firebase-signin', email, password),
  firebaseSignOut: () => ipcRenderer.invoke('firebase-signout'),
});
