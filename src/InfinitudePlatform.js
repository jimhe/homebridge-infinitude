const { pluginName, platformName } = require('./constants');

const InfinitudeInstance = require('./InfinitudeInstance');
const InfinitudeLog = require('./InfinitudeLog');
const fs = require('fs');

const thermostats = [];

let AccessoryCategories;

module.exports = class InfinitudePlatform {
  constructor(log, config, api) {
    log.info('Plugin initializing...');

    AccessoryCategories = api.hap.Accessory.Categories;

    this.api = api;
    this.config = config;
    this.log = new InfinitudeLog(log, config.verbose);
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

    if (this.validConfig(config)) {
      for (var i = 0; i < config.thermostats.length; i++) {
        thermostats[i] = new InfinitudeInstance(i, this.log, this.config.thermostats[i], this.api);
      }

      this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
    } else {
      this.log.warn(`${pluginName} is not configured correctly, check the config and restart the homebridge`);
    }
  }

  validConfig(config) {
    return config.thermostats != null && config.thermostats.length > 0;
  }

  async didFinishLaunching() {
    setTimeout(
      function () {
        for (var i = 0; i < thermostats.length; i++) {
          const t = thermostats[i];
          t.initializeZones(true).then(x => {
            var uuids = Object.keys(t.accessories);
            for (var j = 0; j < uuids.length; j++) {
              const a = uuids[j];
              this.accessoryMap.push({ accessoryUuid: a, instanceId: t.id });
            }
            const json = JSON.stringify(this.accessoryMap);
            this.log.debug(`Writing to cache ${json}`);
            fs.writeFileSync(this.mapPath, json, 'utf8');
          });
        }
        this.log.info("Platform initialized.");

        this.api.emit('didFinishInit');
      }.bind(this),
      // wait 5 seconds to allow for existing accessories to be configured
      5000
    );
  }

  configureAccessory(accessory) {
    var map = this.accessoryMap.find(x => x.accessoryUuid == accessory.UUID);
    var thermostat = thermostats.find(x => x.id == map.instanceId);
    if (map != null && thermostat != null) {
      this.log.info(`loading accessory: ${accessory.name} ${accessory.category}`);
      if (accessory.category == AccessoryCategories.THERMOSTAT) {
        thermostat.initializeZones(false).then(() => thermostat.configureZoneThermostat(accessory));
      } else if (accessory.category == AccessoryCategories.SENSOR || accessory.category == AccessoryCategories.OTHER) {
        thermostat.configureTemperatureSensor(accessory);
      } else if (accessory.category == AccessoryCategories.FAN) {
        thermostat.configureFan(accessory);
      } else {
        this.log.info(`Unable to find instance with id ${map.instanceId}.`);
      }
    } else {
      this.log.info(`Unable to find accessory map with id ${accessory.UUID}.`);
    }
  }
};
