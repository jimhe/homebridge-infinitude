const { pluginName, platformName } = require('./constants');

const configSchema = require('./configSchema');
const InfinitudeClient = require('./InfinitudeClient');
const InfinitudeThermostat = require('./InfinitudeThermostat');
const InfinitudeSensor = require('./InfinitudeSensor');

let AccessoryCategories, Thermostat,Sensor;

module.exports = class InfinitudePlatform {
  constructor(log, config, api) {
    log.info('Initializing...');

    if (!config) {
      log.error('Plugin not configured.');
      return;
    }

    const result = configSchema.validate(config);
    if (result.error) {
      log.error('Invalid config.', result.error.message);
      return;
    }
	
    //FilterMaintenance = api.hap.Service.FilterMaintenance;
    Sensor = api.hap.Service.TemperatureSensor;
    Thermostat = api.hap.Service.Thermostat;
    AccessoryCategories = api.hap.Accessory.Categories;

    this.log = log;
    this.api = api;
    this.accessories = {};
    this.sensors = {};
    this.zoneIds = {};
    this.zoneNames = {};
    this.initialized = false;
    this.client = new InfinitudeClient(config.url, config.holdUntil, this.log);

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  configureAccessory(accessory) {
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
        this.initializeZones(true);
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
	    this.sensors[sUuid] = this.sensors[sUuid] || this.createSensorAccessory(sUuid);
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
    this.api.registerPlatformAccessories(pluginName, platformName, [zoneAccessory]);
    this.configureThermostatAccessory(zoneAccessory);
    return zoneAccessory;
  }

  configureThermostatAccessory(accessory) {
    const thermostatName = this.getThermostatName(accessory);
    const zoneId = this.getZoneId(accessory);
    new InfinitudeThermostat(thermostatName, zoneId, this.client, this.log, accessory);
  }
  
  createSensorAccessory(uuid) {
    const SensorAccessory = new this.api.platformAccessory('OAT', uuid, AccessoryCategories.SENSOR);
    this.log.info(`Creating new Sensor for OAT`);
    SensorAccessory.addService(TemperatureSensor);
    this.api.registerPlatformAccessories(pluginName, platformName, [SensorAccessory]);
    this.configureSensorAccessory(SensorAccessory);
    return SensorAccessory;
  }
  
    configureSensorAccessory(accessory) {
    const sensorName = 'Outside Temperature';
    new InfinitudeSensor(sensorName, this.client, this.log, accessory);
  }
  
  getThermostatName(accessory) {
    return this.zoneNames[accessory.UUID];
  }

  getZoneId(accessory) {
    return this.zoneIds[accessory.UUID];
  }
};
