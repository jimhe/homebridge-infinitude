const { pluginName, platformName } = require('./constants');

const InfinitudeInstance = require('./InfinitudeInstance');
const InfinitudeLog = require('./InfinitudeLog');
const fs = require('fs');

const instances = [];

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
    this.accessories = [];

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
        instances[i] = new InfinitudeInstance(i, this.log, this.config.thermostats[i], this.api);
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

    for (var i = 0; i < instances.length; i++) {
      const instance = instances[i];
      await instance.initialize();
    }

    this.accessories.forEach(x => this.createAccessory(x));

    for (var i = 0; i < instances.length; i++) {
      const instance = instances[i];
      instance.createAccessories();
      var uuids = Object.keys(instance.accessories);

      for (var j = 0; j < uuids.length; j++) {
        const a = uuids[j];
        this.accessoryMap.push({ accessoryUuid: a, instanceId: instance.id });
      }

      const json = JSON.stringify(this.accessoryMap);
      this.log.debug(`Writing to cache ${json}`);
      fs.writeFileSync(this.mapPath, json, 'utf8');

    }
    this.log.info("Platform initialized.");

    this.api.emit('didFinishInit');

  }

  configureAccessory(accessory) {
    this.accessories.push(accessory);
  }

  createAccessory(accessory) {
    var map = this.accessoryMap.find(x => x.accessoryUuid == accessory.UUID);
    if (map != null) {
      var instance = instances.find(x => x.id == map.instanceId);
      if (instance != null) {
        this.log.info(`loading accessory: ${accessory.name} ${accessory.category}`);
        if (accessory.category == AccessoryCategories.THERMOSTAT) {
          instance.configureZoneThermostat(accessory);
        } else if (accessory.category == AccessoryCategories.SENSOR || accessory.category == AccessoryCategories.OTHER) {
          instance.configureTemperatureSensor(accessory);
        } else if (accessory.category == AccessoryCategories.FAN) {
          instance.configureFan(accessory);
        } else if (accessory.category == AccessoryCategories.SWITCH) {
          instance.configureSwitch(accessory);
        }
      }
      else {
        this.log.info(`Unable to find instance with id ${map.instanceId}.`);
      }
    } else {
      this.log.info(`Unable to find accessory map with id ${accessory.UUID}.`);
    }
  }
};
