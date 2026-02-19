const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

const TOKEN_URL = 'https://api.netatmo.com/oauth2/token';
const AUTH_URL = 'https://api.netatmo.com/oauth2/authorize';
const STATIONS_URL = 'https://api.netatmo.com/api/getstationsdata';

class NetatmoSource {
  constructor(config, configDir) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectPort = config.redirectPort || 9876;
    this.tokenPath = path.join(configDir, config.tokenFile || 'netatmo-tokens.json');
    this.tokens = null;
    this.selectedMetrics = config.metrics || [];
  }

  loadTokens() {
    try {
      const raw = fs.readFileSync(this.tokenPath, 'utf-8');
      this.tokens = JSON.parse(raw);
      return true;
    } catch {
      return false;
    }
  }

  saveTokens() {
    fs.writeFileSync(this.tokenPath, JSON.stringify(this.tokens, null, 2));
  }

  httpsPost(url, body) {
    return new Promise((resolve, reject) => {
      const data = new URLSearchParams(body).toString();
      const parsed = new URL(url);
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
        },
      };
      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(responseData));
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${responseData.slice(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  httpsGet(url, accessToken) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: { Authorization: `Bearer ${accessToken}` },
      };
      https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`));
          }
        });
      }).on('error', reject);
    });
  }

  // One-time OAuth authorization flow
  async authorize() {
    return new Promise((resolve, reject) => {
      const redirectUri = `http://localhost:${this.redirectPort}/callback`;

      // Start a local HTTP server to receive the callback
      const server = http.createServer(async (req, res) => {
        const reqUrl = new URL(req.url, `http://localhost:${this.redirectPort}`);

        if (reqUrl.pathname === '/callback') {
          const code = reqUrl.searchParams.get('code');
          const error = reqUrl.searchParams.get('error');

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h2>Authorization failed: ${error}</h2><p>You can close this window.</p></body></html>`);
            server.close();
            reject(new Error(`Netatmo auth failed: ${error}`));
            return;
          }

          if (code) {
            try {
              // Exchange code for tokens
              const tokenResponse = await this.httpsPost(TOKEN_URL, {
                grant_type: 'authorization_code',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                redirect_uri: redirectUri,
                scope: 'read_station',
              });

              if (tokenResponse.error) {
                throw new Error(tokenResponse.error);
              }

              this.tokens = {
                access_token: tokenResponse.access_token,
                refresh_token: tokenResponse.refresh_token,
                expires_at: Date.now() + (tokenResponse.expires_in * 1000),
              };
              this.saveTokens();

              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<html><body><h2>Netatmo authorized successfully!</h2><p>You can close this window and return to Rainmaker.</p></body></html>');
              server.close();
              resolve();
            } catch (err) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`<html><body><h2>Token exchange failed</h2><p>${err.message}</p></body></html>`);
              server.close();
              reject(err);
            }
            return;
          }
        }

        res.writeHead(404);
        res.end('Not found');
      });

      server.listen(this.redirectPort, () => {
        const authUrl = `${AUTH_URL}?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read_station&state=rainmaker`;
        console.log(`Opening browser for Netatmo authorization...`);
        console.log(`Auth URL: ${authUrl}`);
        shell.openExternal(authUrl);
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Netatmo authorization timed out'));
      }, 120000);
    });
  }

  async ensureTokens() {
    if (!this.tokens) {
      if (!this.loadTokens()) {
        if (!this.clientId || !this.clientSecret) {
          throw new Error('Netatmo client_id and client_secret required in config');
        }
        await this.authorize();
      }
    }

    // Refresh if expired (with 5 min buffer)
    if (this.tokens.expires_at < Date.now() + 300000) {
      console.log('Refreshing Netatmo access token...');
      const response = await this.httpsPost(TOKEN_URL, {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.tokens.refresh_token,
      });

      if (response.error) {
        // Token invalid, need to re-authorize
        console.log('Refresh token expired, re-authorizing...');
        this.tokens = null;
        await this.authorize();
        return;
      }

      this.tokens = {
        access_token: response.access_token,
        refresh_token: response.refresh_token,
        expires_at: Date.now() + (response.expires_in * 1000),
      };
      this.saveTokens();
    }
  }

  // Extract all available sensors from the raw API response
  extractAllSensors(data) {
    const sensors = [];
    const devices = data.body?.devices || [];

    // Only show these meaningful measurement keys
    const METRICS = {
      Temperature: { label: 'Temp', unit: '°C' },
      Humidity:    { label: 'Humidity', unit: '%' },
      CO2:         { label: 'CO2', unit: ' ppm' },
      Noise:       { label: 'Noise', unit: ' dB' },
      Pressure:    { label: 'Pressure', unit: ' mbar' },
      Rain:        { label: 'Rain', unit: ' mm' },
      sum_rain_1:  { label: 'Rain 1h', unit: ' mm' },
      sum_rain_24: { label: 'Rain 24h', unit: ' mm' },
      WindStrength:  { label: 'Wind', unit: ' km/h' },
      GustStrength:  { label: 'Gust', unit: ' km/h' },
      WindAngle:     { label: 'Wind Dir', unit: '°' },
      GustAngle:     { label: 'Gust Dir', unit: '°' },
    };

    function addSensors(moduleId, moduleName, dashboard) {
      if (!dashboard) return;
      for (const [key, val] of Object.entries(dashboard)) {
        const meta = METRICS[key];
        if (meta && typeof val === 'number') {
          const id = `${moduleId}:${key}`;
          const label = `${moduleName} ${meta.label}`;
          sensors.push({ id, label, value: `${val}${meta.unit}`, unit: meta.unit });
        }
      }
    }

    for (const device of devices) {
      const devName = device.module_name || device.station_name || 'Station';
      addSensors(device._id, devName, device.dashboard_data);

      for (const mod of device.modules || []) {
        const modName = mod.module_name || devName;
        addSensors(mod._id, modName, mod.dashboard_data);
      }
    }
    return sensors;
  }

  async fetchAvailableSensors() {
    try {
      await this.ensureTokens();
      const data = await this.httpsGet(STATIONS_URL, this.tokens.access_token);
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      return this.extractAllSensors(data);
    } catch (err) {
      console.error('Netatmo sensor discovery error:', err.message);
      return [];
    }
  }

  async fetchMetrics() {
    try {
      await this.ensureTokens();
      const data = await this.httpsGet(STATIONS_URL, this.tokens.access_token);
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      const allSensors = this.extractAllSensors(data);
      const selectedIds = this.selectedMetrics;

      let metrics;
      if (selectedIds && selectedIds.length > 0) {
        // Show only selected sensors
        const sensorMap = {};
        for (const s of allSensors) sensorMap[s.id] = s;
        metrics = selectedIds.map((sel) => {
          const s = sensorMap[sel.id];
          if (!s) return { name: sel.name, value: '—', unit: '', error: 'not found' };
          return { name: sel.name, value: s.value, unit: '', error: null };
        });
      } else {
        // Show all sensors
        metrics = allSensors.map((s) => ({
          name: s.label, value: s.value, unit: '', error: null,
        }));
      }

      if (metrics.length === 0) {
        metrics.push({ name: 'Status', value: 'No data', unit: '', error: 'No devices found' });
      }

      return { name: 'Home', metrics };
    } catch (err) {
      console.error('Netatmo fetch error:', err.message);
      return {
        name: 'Home',
        metrics: [{ name: 'Status', value: '—', unit: '', error: err.message }],
      };
    }
  }
}

module.exports = { NetatmoSource };
