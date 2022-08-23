const { pluginName, platformName } = require('./constants');

const configSchema = require('./configSchema');
const InfinitudeInstance = require('./InfinitudeInstance');


let thermostats = [];

module.exports = class InfinitudePlatform {
  constructor(log, config, api) {
    log.info('Plugin initializing...');

    if (!config) {
      log.error('Plugin not configured.');
      return;
    }

    const result = configSchema.validate(config);
    if (result.error) {
      log.error('Invalid config.', result.error.message);
      return;
    }

    if (config.thermostats.length > 0) {
      for (var i = 0; i < config.thermostats.length; i++) {
        this.thermostats.push(new InfinitudeInstance(log, config.thermostats[i], api));
      }
    }

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }
};
