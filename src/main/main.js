const { app, BrowserWindow, ipcMain, Tray, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { MetricFetcher } = require('./fetcher');

const isDev = !app.isPackaged;
const configDir = path.join(__dirname, '..', '..');
const configPath = path.join(configDir, 'config.json');

const WIDGET_WIDTH = 320;
const WIDGET_HEIGHT = 600;

function loadConfig() {
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

function saveConfig(cfg) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

let mainWindow;
let settingsWindow;
let fetcher;
let tray;
let config;

function getDisplaysSortedByPosition() {
  return screen.getAllDisplays().sort((a, b) => a.bounds.x - b.bounds.x);
}

function getTargetDisplay() {
  const displays = screen.getAllDisplays();
  if (config.displayId) {
    const found = displays.find((d) => d.id === config.displayId);
    if (found) return found;
  }
  return screen.getPrimaryDisplay();
}

function createWidget(config) {
  const display = getTargetDisplay();
  const offsetX = config.position?.x ?? 50;
  const offsetY = config.position?.y ?? 50;

  mainWindow = new BrowserWindow({
    x: display.workArea.x + offsetX,
    y: display.workArea.y + offsetY,
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    useContentSize: true,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    focusable: true,
    show: true,
    hasShadow: false,
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

  mainWindow.webContents.on('did-finish-load', () => {
    try {
      const { embedWindow, keepAtBottom } = require('./desktop-embed');
      const hwndBuf = mainWindow.getNativeWindowHandle();
      embedWindow(hwndBuf);

      // Periodically push to bottom of z-order so it stays behind other windows
      const bottomInterval = setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          keepAtBottom(mainWindow.getNativeWindowHandle());
        } else {
          clearInterval(bottomInterval);
        }
      }, 2000);
    } catch (err) {
      console.error('Desktop embedding failed:', err.message);
    }
  });

  // Handle drag via IPC from renderer
  ipcMain.on('widget-drag', (_event, deltaX, deltaY) => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    // Use setBounds to set position AND size together, preventing Windows
    // from rescaling the window when crossing DPI boundaries
    mainWindow.setBounds({
      x: x + deltaX,
      y: y + deltaY,
      width: WIDGET_WIDTH,
      height: WIDGET_HEIGHT,
    });
  });

  ipcMain.on('widget-drag-end', () => {
    if (!mainWindow) return;
    mainWindow.setContentSize(WIDGET_WIDTH, WIDGET_HEIGHT);
    const [wx, wy] = mainWindow.getPosition();
    const display = screen.getDisplayNearestPoint({ x: wx, y: wy });
    config.displayId = display.id;
    config.position = {
      x: wx - display.workArea.x,
      y: wy - display.workArea.y,
    };
    saveConfig(config);
    buildTrayMenu();
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

function moveToDisplay(display) {
  if (!mainWindow) return;
  const offsetX = config.position?.x ?? 50;
  const offsetY = config.position?.y ?? 50;
  mainWindow.setPosition(display.workArea.x + offsetX, display.workArea.y + offsetY);
  // Force correct size after cross-DPI move
  mainWindow.setContentSize(WIDGET_WIDTH, WIDGET_HEIGHT);

  config.displayId = display.id;
  saveConfig(config);
  buildTrayMenu();
}

function buildTrayMenu() {
  const displays = getDisplaysSortedByPosition();
  const primary = screen.getPrimaryDisplay();

  const posLabels = displays.length === 3
    ? ['Left', 'Center', 'Right']
    : displays.length === 2
      ? ['Left', 'Right']
      : ['Display'];

  const displayItems = displays.map((display, i) => {
    const pw = Math.round(display.size.width * display.scaleFactor);
    const ph = Math.round(display.size.height * display.scaleFactor);
    const isPrimary = display.id === primary.id;
    const label = `${posLabels[i]} — ${pw}x${ph}${isPrimary ? ' (Primary)' : ''}`;
    const isCurrent = config.displayId === display.id || (!config.displayId && isPrimary);
    return {
      label,
      type: 'radio',
      checked: isCurrent,
      click: () => moveToDisplay(display),
    };
  });

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Configure Sensors...', click: openSettings },
    { type: 'separator' },
    { label: 'Move to Display', submenu: displayItems },
    { type: 'separator' },
    { label: 'Refresh Now', click: () => { if (fetcher) fetcher.tick(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  const iconPath = path.join(configDir, 'assets', 'icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('Rainmaker');
  buildTrayMenu();

  screen.on('display-added', buildTrayMenu);
  screen.on('display-removed', buildTrayMenu);
}

app.whenReady().then(() => {
  config = loadConfig();

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
    if (source === 'netatmo') {
      config.sources.netatmo.metrics = selectedSensors;
    } else {
      config.sources.boat.metrics = selectedSensors;
    }
    saveConfig(config);

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
  if (!mainWindow) {
    if (fetcher) fetcher.stop();
    app.quit();
  }
});
