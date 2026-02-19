const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { MetricFetcher } = require('./fetcher');

const isDev = !app.isPackaged;
const configDir = path.join(__dirname, '..', '..');
const configPath = path.join(configDir, 'config.json');

function loadConfig() {
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

let mainWindow;
let settingsWindow;
let fetcher;
let tray;
let config;

function createWidget(config) {
  const { position, size } = config;

  mainWindow = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: size?.width || 320,
    height: size?.height || 600,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env.VITE_DEV) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'index.html'));
  }

  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const { embedWindow } = require('./desktop-embed');
      const hwndBuf = mainWindow.getNativeWindowHandle();
      await embedWindow(hwndBuf);
    } catch (err) {
      console.error('Desktop embedding failed:', err.message);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    frame: true,
    resizable: true,
    title: 'Rainmaker Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dist', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function createTray() {
  const iconPath = path.join(configDir, 'assets', 'icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('Rainmaker');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Configure Sensors...', click: openSettings },
    { type: 'separator' },
    { label: 'Refresh Now', click: () => { if (fetcher) fetcher.tick(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  config = loadConfig();

  // IPC handlers
  ipcMain.handle('get-config', () => config);

  ipcMain.handle('get-available-sensors', async (_event, source) => {
    if (source === 'netatmo') {
      const { NetatmoSource } = require('./source-netatmo');
      const netatmo = new NetatmoSource(config.sources.netatmo, configDir);
      return await netatmo.fetchAvailableSensors();
    }
    const { fetchAllSensors } = require('./source-boat');
    return await fetchAllSensors(config.sources.boat.url);
  });

  ipcMain.handle('save-sensor-selection', (_event, source, selectedSensors) => {
    // selectedSensors is an array of { id, name } objects
    if (source === 'netatmo') {
      config.sources.netatmo.metrics = selectedSensors;
    } else {
      config.sources.boat.metrics = selectedSensors;
    }
    saveConfig(config);

    // Restart fetcher with new config
    if (fetcher) {
      fetcher.stop();
      fetcher = new MetricFetcher(config, configDir, sendToWidget);
      fetcher.start();
    }

    return true;
  });

  function sendToWidget(data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('metrics-update', data);
    }
  }

  createTray();
  createWidget(config);

  fetcher = new MetricFetcher(config, configDir, sendToWidget);
  fetcher.start();
});

app.on('window-all-closed', (e) => {
  // Don't quit when settings window is closed — keep tray alive
  if (!mainWindow) {
    if (fetcher) fetcher.stop();
    app.quit();
  }
});
