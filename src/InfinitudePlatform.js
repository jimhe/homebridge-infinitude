const { pluginName, platformName } = require('./constants');

const configSchema = require('./configSchema');
const InfinitudeClient = require('./InfinitudeClient');
const InfinitudeThermostat = require('./InfinitudeThermostat');
const InfinitudeSensor = require('./InfinitudeSensor');
const InfinitudeFan = require('./InfinitudeFan');

let AccessoryCategories, Thermostat, TemperatureSensor, Fanv2, OutsideUuid;

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

    Thermostat = api.hap.Service.Thermostat;
    AccessoryCategories = api.hap.Accessory.Categories;
    TemperatureSensor = api.hap.Service.TemperatureSensor;
    Fanv2 = api.hap.Service.Fanv2;
    OutsideUuid = api.hap.uuid.generate('outsideZone');

    this.log = log;
    this.api = api;
    this.accessories = {};
    this.zoneIds = {};
    this.zoneNames = {};
    this.initialized = false;
    this.client = new InfinitudeClient(config.url, this.log);
    this.config = config;
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;


    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  configureAccessory(accessory) {
    this.initializeZones(false).then(
      function () {
        this.accessories[accessory.UUID] = accessory;
        if (accessory.category == AccessoryCategories.TEMPERATURESENSOR) {
          this.configureSensorAccessory(accessory);
        }
        else if (accessory.category == AccessoryCategories.FAN) {
          this.configureFanAccessory(accessory);
        }
        else if (accessory.category == AccessoryCategories.THERMOSTAT) {
          this.configureThermostatAccessory(accessory);
        }
      }.bind(this)
    );
  }

  async didFinishLaunching() {
    setTimeout(
      function () {
        this.initializeZones(true);
      }.bind(this),
      // wait 5 seconds to allow for existing accessories to be configured
      5000
    );
  }

  async initializeZones(create = true) {
    if (this.initialized) {
      this.log.info('Plugin initialized');
      return;
    }

    return this.client.getStatus().then(
      function (status) {
        const enabledZones = status['zones'][0]['zone'].filter(zone => zone['enabled'][0] === 'on');

        for (const zone of enabledZones) {
          const zoneId = zone.id;
          const zoneName = zone.name;
          const tUuid = this.api.hap.uuid.generate(zoneId + "_tstat");
          const fUuid = this.api.hap.uuid.generate(zoneId + "_fan");

          this.zoneIds[tUuid] = zoneId;
          this.zoneIds[fUuid] = zoneId;
          this.zoneNames[tUuid] = `${zoneName} Thermostat`;
          this.zoneNames[fUuid] = `${zoneName} Fan`;

          if (create) {
            this.accessories[tUuid] = this.accessories[tUuid] || this.createZoneAccessory(this.zoneNames[tUuid], tUuid);
            this.accessories[fUuid] = this.accessories[fUuid] || this.createFanAccessory(this.zoneNames[fUuid], fUuid);
          }
        }
        if (create && this.config.useOutdoorTemperatureSensor) {
          this.accessories[OutsideUuid] = this.accessories[OutsideUuid] || this.createSensorAccessory(OutsideUuid);
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
    const thermostatName = this.getAccessoryName(accessory);
    const zoneId = this.getZoneId(accessory);

    this.log.debug(`configuring ${thermostatName}`);
    new InfinitudeThermostat(
      thermostatName,
      zoneId,
      this.client,
      this.log,
      this.config,
      accessory,
      this.Service,
      this.Characteristic
    );
  }

  getAccessoryName(accessory) {
    return this.zoneNames[accessory.UUID];
  }

  createSensorAccessory(uuid) {
    const sensorAccessory = new this.api.platformAccessory(this.getSensorName(), uuid, AccessoryCategories.TEMPERATURESENSOR);
    this.log.info(`Creating outdoor temperature sensor`);
    sensorAccessory.addService(TemperatureSensor);
    this.api.registerPlatformAccessories(pluginName, platformName, [sensorAccessory]);
    this.configureSensorAccessory(sensorAccessory);
    return sensorAccessory;
  }

  configureSensorAccessory(accessory) {
    const sensorName = this.getSensorName(accessory);
    this.log.debug(`configuring ${sensorName}`);
    new InfinitudeSensor(
      sensorName,
      this.client,
      this.log,
      this.config,
      accessory,
      this.Service,
      this.Characteristic
    )
  }

  createFanAccessory(fanName, uuid) {
    const fanAccessory = new this.api.platformAccessory(fanName, uuid, AccessoryCategories.FAN);
    this.log.debug(`Creating Fan Service`);
    fanAccessory.addService(Fanv2, fanName);
    this.api.registerPlatformAccessories(pluginName, platformName, [fanAccessory]);
    this.configureFanAccessory(fanAccessory);
    return fanAccessory;
  }

  configureFanAccessory(accessory) {
    const fanName = this.getAccessoryName(accessory);
    const zoneId = this.getZoneId(accessory);
    this.log.debug(`configuring ${fanName}`);
    new InfinitudeFan(
      fanName,
      zoneId,
      this.client,
      this.log,
      this.config,
      accessory,
      this.Service,
      this.Characteristic
    )
  }

  getSensorName(accessory) {
    return 'Outdoor';
  }

  getZoneId(accessory) {
    return this.zoneIds[accessory.UUID];
  }
};
