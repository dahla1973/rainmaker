const { fetchBoatMetrics } = require('./source-boat');
const { NetatmoSource } = require('./source-netatmo');

class MetricFetcher {
  constructor(config, configDir, sendToRenderer) {
    this.config = config;
    this.sendToRenderer = sendToRenderer;
    this.timer = null;

    // Initialize Netatmo source if configured
    if (config.sources.netatmo?.clientId) {
      this.netatmo = new NetatmoSource(config.sources.netatmo, configDir);
    }
  }

  async tick() {
    const groups = [];

    // Fetch boat data
    if (this.config.sources.boat) {
      const boatData = await fetchBoatMetrics(this.config.sources.boat);
      groups.push(boatData);
    }

    // Fetch Netatmo data
    if (this.netatmo) {
      const homeData = await this.netatmo.fetchMetrics();
      groups.push(homeData);
    }

    this.sendToRenderer(groups);
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
