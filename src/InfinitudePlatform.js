const { pluginName, platformName } = require('./constants');
const Joi = require('joi');

const configSchema = require('./configSchema');
const InfinitudeClient = require('./InfinitudeClient');
const InfinitudeThermostat = require('./InfinitudeThermostat');
const InfinitudeThermostatSwitch = require('./InfinitudeThermostatSwitch');

let AccessoryCategories, Thermostat, Switch;

module.exports = class InfinitudePlatform {
  constructor(log, config, api) {
    log.info('Initializing...');

    if (!config) {
      log.info('Plugin not configured.');
      return;
    }

    const result = Joi.validate(config, configSchema);
    if (result.error) {
      log.error('Invalid config.', result.error.message);
      return;
    }
    log.info(result);

    Thermostat = api.hap.Service.Thermostat;
    Switch = api.hap.Service.Switch;
    AccessoryCategories = api.hap.Accessory.Categories;

    this.log = log;
    this.api = api;
    this.accessories = {};
    this.zoneIds = {};
    this.zoneNames = {};
    this.initialized = false;
    this.client = new InfinitudeClient(config.url, this.log);

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  configureAccessory(accessory) {
    this.log.info('Configuring accessory...');

    this.initializeZones(false).then(
      function() {
        this.accessories[accessory.UUID] = accessory;
        this.configureThermostatAccessory(accessory);
      }.bind(this)
    );
  }

  async didFinishLaunching() {
    setTimeout(
      function() {
        this.initializeZones();
      }.bind(this),
      // wait 5 seconds to allow for existing accessories to be configured
      5000
    );
  }

  async initializeZones(create = true) {
    if (this.initialized) {
      this.log.info('INITIALIZED!');
      return;
    }

    return this.client.getStatus().then(
      function(status) {
        const enabledZones = status['zones']['zone'].filter(zone => zone['enabled'] === 'on');

        for (const zone of enabledZones) {
          const zoneId = zone.id;
          const zoneName = `${zone.name} Thermostat`;
          const tUuid = this.api.hap.uuid.generate(zoneId);
          this.zoneIds[tUuid] = zoneId;
          this.zoneNames[tUuid] = zoneName;
          if (create) {
            this.accessories[tUuid] = this.accessories[tUuid] || this.createZoneAccessory(zoneName, tUuid);
          }
        }

        this.initialized = true;
        this.api.emit('didFinishInit');
      }.bind(this)
    );
  }

  createZoneAccessory(zoneName, uuid) {
    const zoneAccessory = new this.api.platformAccessory(zoneName, uuid, AccessoryCategories.THERMOSTAT);
    this.log.info(`Creating new thermostat in zone: ${zoneName}`);
    zoneAccessory.addService(Thermostat, zoneName);
    this.log.info(`Creating new switch in zone: ${zoneName}`);
    zoneAccessory.addService(Switch, zoneName);
    this.api.registerPlatformAccessories(pluginName, platformName, [zoneAccessory]);
    this.configureThermostatAccessory(zoneAccessory);
    return zoneAccessory;
  }

  configureThermostatAccessory(accessory) {
    const thermostatName = this.getThermostatName(accessory);
    const zoneId = this.getZoneId(accessory);
    new InfinitudeThermostat(thermostatName, zoneId, this.client, this.log, accessory);
    new InfinitudeThermostatSwitch(thermostatName, zoneId, this.client, this.log, accessory);
  }

  getValue(service, characteristic) {
    return new Promise((resolve, reject) => {
      service.getCharacteristic(characteristic).getValue(function(error, value) {
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      });
    });
  }

  setValue(service, characteristic, newValue) {
    return new Promise((resolve, reject) => {
      service.getCharacteristic(characteristic).setValue(newValue, function(error) {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  getThermostatName(accessory) {
    return this.zoneNames[accessory.UUID];
  }

  getZoneId(accessory) {
    return this.zoneIds[accessory.UUID];
  }
};
