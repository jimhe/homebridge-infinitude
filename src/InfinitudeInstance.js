const { pluginName, platformName } = require('./constants');

const InfinitudeClient = require('./InfinitudeClient');
const InfinitudeThermostat = require('./InfinitudeThermostat');
const InfinitudeSensor = require('./InfinitudeSensor');
const InfinitudeFan = require('./InfinitudeFan');
const InfinitudeLog = require('./InfinitudeLog');

let AccessoryCategories, AccessoryInformation, Thermostat, TemperatureSensor, Fanv2;

module.exports = class InfinitudeInstance {
  constructor(id, log, config, api) {
    log.info(`Creating instance ${id}...`);

    Thermostat = api.hap.Service.Thermostat;
    AccessoryCategories = api.hap.Accessory.Categories;
    AccessoryInformation = api.hap.Service.AccessoryInformation;
    TemperatureSensor = api.hap.Service.TemperatureSensor;
    Fanv2 = api.hap.Service.Fanv2;

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

    this.log.verbose(`Instance ${id} received config ${JSON.stringify(config)}`);
  }

  async initializeZones(create = true) {
    if (this.initialized) {
      this.log.info(`${this.config.name} initialized`);
      return;
    }

    return this.client.getStatus('zones').then(
      function (zones) {
        const enabledZones = zones['zone'].filter(zone => zone['enabled'][0] === 'on');
        const outsideUuid = this.api.hap.uuid.generate(this.id + '_outsideZone');

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
            this.accessories[tUuid] =
              this.accessories[tUuid] || this.createZoneThermostat(this.zoneNames[tUuid], tUuid);
          }
        }

        if (create) {
          if (this.config.useFan) {
            this.accessories[fUuid] = this.accessories[fUuid] || this.createFan(this.zoneNames[fUuid], fUuid);
          }
          if (this.config.useOutdoorTemperatureSensor) {
            this.accessories[outsideUuid] =
              this.accessories[outsideUuid] || this.createTemperatureSensor(`Outdoor`, outsideUuid);
          }
        }

        this.initialized = true;
      }.bind(this)
    );
  }

  createZoneThermostat(zoneName, uuid) {
    const zoneAccessory = new this.api.platformAccessory(zoneName, uuid, AccessoryCategories.THERMOSTAT);
    this.log.info(`Creating new thermostat in zone: ${zoneName}`);

    zoneAccessory.addService(Thermostat, zoneName);

    this.api.registerPlatformAccessories(pluginName, platformName, [zoneAccessory]);
    this.configureZoneThermostat(zoneAccessory);
    return zoneAccessory;
  }

  createTemperatureSensor(sensorName, uuid) {
    this.log.info(`Creating outdoor temperature sensor with name: ${sensorName}, uuid: ${uuid}`);
    const sensorAccessory = new this.api.platformAccessory(sensorName, uuid, AccessoryCategories.TEMPERATURESENSOR);


    sensorAccessory.addService(TemperatureSensor);
    this.api.registerPlatformAccessories(pluginName, platformName, [sensorAccessory]);
    this.configureTemperatureSensor(sensorAccessory);
    return sensorAccessory;
  }

  createFan(fanName, uuid) {
    const fanAccessory = new this.api.platformAccessory(fanName, uuid, AccessoryCategories.FAN);
    this.log.info(`Creating fan with uuid ${uuid}`);
    fanAccessory.addService(Fanv2, fanName);
    this.api.registerPlatformAccessories(pluginName, platformName, [fanAccessory]);
    this.configureFan(fanAccessory);
    return fanAccessory;
  }

  configureZoneThermostat(accessory) {
    const thermostatName = this.zoneNames[accessory.UUID];
    const zoneId = this.zoneIds[accessory.UUID];

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

  configureTemperatureSensor(accessory) {
    const sensorName = `Outdoor`;
    this.log.debug(`configuring ${sensorName}`);

    new InfinitudeSensor(sensorName, this.client, this.log, this.config, accessory, this.Service, this.Characteristic);
  }

  configureFan(accessory) {
    const fanName = this.zoneNames[accessory.UUID];
    const zoneId = this.zoneIds[accessory.UUID];
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
    );
  }
};
