# Rainmaker

Windows desktop widget that displays boat and home metrics directly on the desktop wallpaper layer.

![Electron](https://img.shields.io/badge/Electron-33-blue) ![React](https://img.shields.io/badge/React-18-blue) ![Windows](https://img.shields.io/badge/Windows-11-blue)

## Features

- **Desktop embedded** — widget sits on the wallpaper layer (below windows, above wallpaper) using the Windows WorkerW/Progman technique
- **Boat metrics** — battery, solar, wind power, temperatures, sea level, etc. from a remote API
- **Netatmo integration** — OAuth2 flow with auto-refresh for home weather station data (temperature, humidity, CO2, noise, pressure)
- **Sensor picker** — system tray icon with settings UI to choose which sensors to display
- **Dark transparent theme** — semi-transparent dark background that works on any wallpaper

## Setup

1. Clone and install dependencies:
   ```
   git clone https://github.com/dahla1973/rainmaker.git
   cd rainmaker
   npm install
   ```

2. Copy and edit the config:
   ```
   cp config.example.json config.json
   ```
   Edit `config.json` with your Netatmo `clientId` and `clientSecret` from [dev.netatmo.com](https://dev.netatmo.com). Set the redirect URI in your Netatmo app to `http://localhost:9876/callback`.

3. Build the renderer and run:
   ```
   npm run build:renderer
   npm start
   ```

4. On first launch, a browser window opens for Netatmo authorization. After authorizing, tokens are saved to `netatmo-tokens.json` and refresh automatically.

## Configuration

Edit `config.json` to customize:

- `refreshInterval` — data fetch interval in ms (default 30000)
- `position` — widget position on screen `{ x, y }`
- `size` — widget dimensions `{ width, height }`
- `sources.boat.url` — boat API endpoint
- `sources.boat.metrics` — selected boat sensors `[{ id, name }]`
- `sources.netatmo.metrics` — selected Netatmo sensors `[{ id, name }]`

Use the system tray icon > **Configure Sensors** to select which sensors to display.

## Development

Run the Vite dev server and Electron separately:
```
VITE_DEV=1 npm run dev:renderer   # terminal 1
npm start                          # terminal 2
```

## Project Structure

```
src/
  main/
    main.js              # Electron entry, window, tray, IPC
    desktop-embed.js     # Win32 WorkerW embedding via koffi
    fetcher.js           # Periodic metric fetcher
    source-boat.js       # Boat API data source
    source-netatmo.js    # Netatmo OAuth2 + weather data
    preload.js           # IPC bridge
  renderer/
    App.jsx              # Widget UI
    MetricGroup.jsx      # Group header + metric list
    MetricRow.jsx        # Single metric row
    Settings.jsx         # Sensor picker with tabs
    styles.css           # Widget dark theme
    settings.css         # Settings window theme
```
