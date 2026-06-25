const { fetchBoatMetrics } = require('./source-boat');
const { fetchAlarms } = require('./source-alarms');
const { NetatmoSource } = require('./source-netatmo');

function alarmKey(a) {
  return `${a.name}\u0000${a.start ?? ''}`;
}

class MetricFetcher {
  constructor(config, configDir, sendToRenderer, onNewErrorAlarms, auth) {
    this.config = config;
    this.sendToRenderer = sendToRenderer;
    this.onNewErrorAlarms = onNewErrorAlarms;
    this.auth = auth;
    this.timer = null;
    this.previousAlarmKeys = null;

    // Netatmo data only changes server-side every ~10 min and its API is
    // rate-limited, so it is fetched on a slower cadence than the boat tick and
    // its last result is reused in between.
    this.netatmoInterval = config.netatmoRefreshInterval ?? 300000;
    this.cachedNetatmoGroup = null;
    this.lastNetatmoFetch = 0;

    if (config.sources.netatmo?.clientId) {
      this.netatmo = new NetatmoSource(config.sources.netatmo, configDir);
    }
  }

  async tick() {
    const groups = [];
    let alarms = [];
    let needsAuth = false;

    if (this.config.sources.boat) {
      let token = null;
      if (this.auth?.isSignedIn()) {
        try {
          token = await this.auth.getIdToken();
        } catch (e) {
          console.error('Token refresh failed:', e.message);
          needsAuth = true;
        }
      } else {
        needsAuth = true;
      }

      const [boatData, boatAlarms] = await Promise.all([
        fetchBoatMetrics(this.config.sources.boat, token),
        fetchAlarms(this.config.sources.boat, token),
      ]);
      groups.push(boatData);
      alarms = boatAlarms;
      if (boatData.authFailed) needsAuth = true;
    }

    if (this.netatmo) {
      const now = Date.now();
      if (!this.cachedNetatmoGroup || now - this.lastNetatmoFetch >= this.netatmoInterval) {
        this.cachedNetatmoGroup = await this.netatmo.fetchMetrics();
        this.lastNetatmoFetch = now;
      }
      groups.push(this.cachedNetatmoGroup);
    }

    this.detectNewAlarms(alarms);
    this.sendToRenderer({ groups, alarms, needsAuth });
  }

  detectNewAlarms(alarms) {
    const currentKeys = new Set(alarms.map(alarmKey));
    if (this.previousAlarmKeys !== null && this.onNewErrorAlarms) {
      const newOnes = alarms.filter(
        (a) => a.alarmType === 'Error' && !this.previousAlarmKeys.has(alarmKey(a))
      );
      if (newOnes.length > 0) this.onNewErrorAlarms(newOnes);
    }
    this.previousAlarmKeys = currentKeys;
  }

  start() {
    this.tick();
    this.timer = setInterval(() => this.tick(), this.config.refreshInterval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = { MetricFetcher };
