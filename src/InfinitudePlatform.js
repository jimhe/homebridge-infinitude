const { pluginName, platformName } = require('./constants');

const InfinitudeInstance = require('./InfinitudeInstance');
const fs = require('fs');

const thermostats = [];

module.exports = class InfinitudePlatform {
  constructor(log, config, api) {
    log.info('Plugin initializing...');

    // if (!config) {
    //   log.error('Plugin not configured.');
    //   return;
    // }

    // const result = configSchema.validate(config);
    // if (result.error) {
    //   log.error('Invalid config.', result.error.message);
    //   return;
    // }
    this.api = api;
    this.config = config;
    this.log = log;
    this.pluginPath = `${this.api.user.storagePath()}/${pluginName}.cache`;
    this.mapPath = `${this.pluginPath}/accessoryMap.json`;

    if (!fs.existsSync(this.pluginPath)) {
      fs.mkdirSync(this.pluginPath);
    }

    if (fs.existsSync(this.mapPath)) {
      var mapJson = fs.readFileSync(this.mapPath, 'utf8');
      this.accessoryMap = JSON.parse(mapJson);
    } else {
      this.accessoryMap = [];
    }

    if (config.thermostats.length > 0) {
      for (var i = 0; i < config.thermostats.length; i++) {
        thermostats[i] = new InfinitudeInstance(i, log, config.thermostats[i], api);
      }
    }

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  async didFinishLaunching() {
    setTimeout(
      function() {
        for (var i = 0; i < thermostats.length; i++) {
          const t = thermostats[i];
          t.initializeZones(true).then(x => {
            var uuids = Object.keys(t.accessories);
            for (var j = 0; j < uuids.length; j++) {
              const a = uuids[j];
              this.accessoryMap.push({ accessoryUuid: a, instanceId: t.id });
            }
            const json = JSON.stringify(this.accessoryMap);
            this.log.info(`Writing to cache ${json}`);
            fs.writeFileSync(this.mapPath, json, 'utf8');
          });
        }

        this.api.emit('didFinishInit');
      }.bind(this),
      // wait 5 seconds to allow for existing accessories to be configured
      5000
    );
  }

  configureAccessory(accessory) {
    var map = this.accessoryMap.find(x => x.accessoryUuid == accessory.UUID);
    if (map != null) {
      var thermostat = thermostats.find(x => x.id == map.instanceId);
      if (thermostat != null) {
        thermostat.initializeZones(false).then(
          function() {
            if (accessory.category == AccessoryCategories.TEMPERATURESENSOR) {
              thermostat.configureSensorAccessory(accessory);
            } else if (accessory.category == AccessoryCategories.FAN) {
              thermostat.configureFanAccessory(accessory);
            } else if (accessory.category == AccessoryCategories.THERMOSTAT) {
              thermostat.configureThermostatAccessory(accessory);
            }
          }.bind(this)
        );
      } else {
        this.log.info(`Unable to find instance with id ${map.instanceId}.`);
      }
    } else {
      this.log.info(`Unable to find accessory map with id ${accessory.UUID}.`);
    }
  }
};
