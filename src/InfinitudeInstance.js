const { pluginName, platformName } = require('./constants');

const InfinitudeClient = require('./InfinitudeClient');
const InfinitudeThermostat = require('./InfinitudeThermostat');
const InfinitudeSensor = require('./InfinitudeSensor');
const InfinitudeFan = require('./InfinitudeFan');

let AccessoryCategories, Thermostat, TemperatureSensor, Fanv2;

module.exports = class InfinitudeInstance {
  constructor(id, log, config, api) {
    log.info(`Creating instance ${id}...`);

    Thermostat = api.hap.Service.Thermostat;
    AccessoryCategories = api.hap.Accessory.Categories;
    TemperatureSensor = api.hap.Service.TemperatureSensor;
    Fanv2 = api.hap.Service.Fanv2;
    this.outsideUuid = api.hap.uuid.generate(id + '_outsideZone');

    this.id = id;
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
  }

  async initializeZones(create = true) {
    if (this.initialized) {
      this.log.info('Instance initialized');
      return;
    }

    return this.client.getStatus().then(
      function(status) {
        const enabledZones = status['zones'][0]['zone'].filter(zone => zone['enabled'][0] === 'on');

        for (const zone of enabledZones) {
          const zoneId = zone.id;
          const zoneName = zone.name;
          const tUuid = this.api.hap.uuid.generate(this.id + '_' + zoneId + '_tstat');
          const fUuid = this.api.hap.uuid.generate(this.id + '_' + zoneId + '_fan');

          this.zoneIds[tUuid] = zoneId;
          this.zoneIds[fUuid] = zoneId;
          this.zoneNames[tUuid] = `${this.config.name} ${zoneName} Thermostat`;
          this.zoneNames[fUuid] = `${this.config.name} ${zoneName} Fan`;

          if (create) {
            this.accessories[tUuid] = this.accessories[tUuid] || this.createZoneAccessory(this.zoneNames[tUuid], tUuid);

            if (this.config.useFan) {
              this.accessories[fUuid] =
                this.accessories[fUuid] || this.createFanAccessory(this.zoneNames[fUuid], fUuid);
            }
            if (this.config.useOutdoorTemperatureSensor) {
              this.accessories[this.outsideUuid] =
                this.accessories[this.outsideUuid] || this.createSensorAccessory(this.outsideUuid);
            }
          }
        }

        this.initialized = true;
      }.bind(this)
    );
  }

  createZoneAccessory(zoneName, uuid) {
    const zoneAccessory = new this.api.platformAccessory(zoneName, uuid, AccessoryCategories.THERMOSTAT);
    this.log.info(`Creating new thermostat in zone: ${zoneName} ${uuid}`);
    zoneAccessory.addService(Thermostat, zoneName);
    this.api.registerPlatformAccessories(pluginName, platformName, [zoneAccessory]);
    this.configureThermostatAccessory(zoneAccessory);
    return zoneAccessory;
  }

  configureThermostatAccessory(accessory) {
    const thermostatName = this.getAccessoryName(accessory);
    const zoneId = this.getZoneId(accessory);

    this.log.info(`configuring ${thermostatName}`);
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
    const sensorAccessory = new this.api.platformAccessory(
      this.getSensorName(),
      uuid,
      AccessoryCategories.TEMPERATURESENSOR
    );
    this.log.info(`Creating outdoor temperature sensor with uuid ${uuid}`);
    sensorAccessory.addService(TemperatureSensor);
    this.api.registerPlatformAccessories(pluginName, platformName, [sensorAccessory]);
    this.configureSensorAccessory(sensorAccessory);
    return sensorAccessory;
  }

  configureSensorAccessory(accessory) {
    const sensorName = this.getSensorName(accessory);
    this.log.info(`configuring ${sensorName}`);
    new InfinitudeSensor(sensorName, this.client, this.log, this.config, accessory, this.Service, this.Characteristic);
  }

  createFanAccessory(fanName, uuid) {
    const fanAccessory = new this.api.platformAccessory(fanName, uuid, AccessoryCategories.FAN);
    this.log.info(`Creating Fan Service`);
    fanAccessory.addService(Fanv2, fanName);
    this.api.registerPlatformAccessories(pluginName, platformName, [fanAccessory]);
    this.configureFanAccessory(fanAccessory);
    return fanAccessory;
  }

  configureFanAccessory(accessory) {
    const fanName = this.getAccessoryName(accessory);
    const zoneId = this.getZoneId(accessory);
    this.log.info(`configuring ${fanName}`);
    new InfinitudeFan(
      fanName,
      zoneId,
      this.client,
      this.log,
      this.config,
      accessory,
      this.Service,
      this.Characteristic
    );
  }

  getSensorName(accessory) {
    return 'Outdoor';
  }

  getZoneId(accessory) {
    return this.zoneIds[accessory.UUID];
  }
};
