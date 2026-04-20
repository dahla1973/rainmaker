const { fetchBoatMetrics } = require('./source-boat');
const { fetchAlarms } = require('./source-alarms');
const { NetatmoSource } = require('./source-netatmo');

function alarmKey(a) {
  return `${a.name}\u0000${a.start ?? ''}`;
}

class MetricFetcher {
  constructor(config, configDir, sendToRenderer, onNewErrorAlarms) {
    this.config = config;
    this.sendToRenderer = sendToRenderer;
    this.onNewErrorAlarms = onNewErrorAlarms;
    this.timer = null;
    this.previousAlarmKeys = null;

    if (config.sources.netatmo?.clientId) {
      this.netatmo = new NetatmoSource(config.sources.netatmo, configDir);
    }
  }

  async tick() {
    const groups = [];
    let alarms = [];

    if (this.config.sources.boat) {
      const [boatData, boatAlarms] = await Promise.all([
        fetchBoatMetrics(this.config.sources.boat),
        fetchAlarms(this.config.sources.boat.url),
      ]);
      groups.push(boatData);
      alarms = boatAlarms;
    }

    if (this.netatmo) {
      const homeData = await this.netatmo.fetchMetrics();
      groups.push(homeData);
    }

    this.detectNewAlarms(alarms);
    this.sendToRenderer({ groups, alarms });
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
