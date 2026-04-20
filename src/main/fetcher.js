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
        fetchAlarms(this.config.sources.boat.url, token),
      ]);
      groups.push(boatData);
      alarms = boatAlarms;
      if (boatData.authFailed) needsAuth = true;
    }

    if (this.netatmo) {
      const homeData = await this.netatmo.fetchMetrics();
      groups.push(homeData);
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
