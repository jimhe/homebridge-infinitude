const { pluginName, platformName } = require('./constants');

const InfinitudeClient = require('./InfinitudeClient');
const InfinitudeThermostat = require('./InfinitudeThermostat');
const InfinitudeSensor = require('./InfinitudeSensor');
const InfinitudeFan = require('./InfinitudeFan');
const InfinitudeSwitch = require('./InfinitudeSwitch');

let AccessoryCategories, Service, AccessoryInformation, Thermostat, TemperatureSensor, Fanv2, Switch;

module.exports = class InfinitudeInstance {
  constructor(id, log, config, api) {
    log.info(`Creating instance ${id}...`);

    Thermostat = api.hap.Service.Thermostat;
    AccessoryCategories = api.hap.Accessory.Categories;
    AccessoryInformation = api.hap.Service.AccessoryInformation;
    TemperatureSensor = api.hap.Service.TemperatureSensor;
    Fanv2 = api.hap.Service.Fanv2;
    Switch = api.hap.Service.Switch;
    Service = api.hap.Service;
    this.id = id;
    this.log = log;
    this.api = api;
    this.accessories = {};
    this.enabledZones = [];
    this.zoneIds = {};
    this.zoneNames = {};
    this.switchActivities = {};
    this.initialized = false;
    this.client = new InfinitudeClient(config.url, this.log);
    this.config = config;
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.verbose(`Instance ${id} received config ${JSON.stringify(config)}`);
  }

  async initialize() {
    if (this.initialized) {
      this.log.info(`${this.config.name} initialized`);
      return;
    }
    this.log.info(`${this.config.name} initializing...`);
    return this.client.getStatus('zones').then(
      function (zones) {
        this.enabledZones = zones['zone'].filter(zone => zone['enabled'][0] === 'on');

        for (const zone of this.enabledZones) {
          const zoneId = zone.id;
          const zoneName = zone.name;
          const tUuid = this.api.hap.uuid.generate(this.id + '_' + zoneId + '_tstat');
          const fUuid = this.api.hap.uuid.generate(this.id + '_' + zoneId + '_fan');


          this.zoneIds[tUuid] = zoneId;
          this.zoneIds[fUuid] = zoneId;


          this.zoneNames[tUuid] = `${this.config.name} ${zoneName} Thermostat`;
          this.zoneNames[fUuid] = `${this.config.name} ${zoneName} Fan`;


          if (this.config.useModeSwitches) {
            const switchUuid = this.api.hap.uuid.generate(this.id + '_' + zoneId + '_controller');

            this.zoneIds[switchUuid] = zoneId;
            this.zoneNames[switchUuid] = `${this.config.name} ${zoneName} Controller`;
          }

        }

        this.initialized = true;
      }.bind(this)
    );
  }

  createAccessories() {
    const outsideUuid = this.api.hap.uuid.generate(this.id + '_outsideZone');

    for (const zone of this.enabledZones) {
      const zoneId = zone.id;
      const tUuid = this.api.hap.uuid.generate(this.id + '_' + zoneId + '_tstat');
      const fUuid = this.api.hap.uuid.generate(this.id + '_' + zoneId + '_fan');

      const switchUuid = this.api.hap.uuid.generate(this.id + '_' + zoneId + '_controller');

      if (this.accessories[tUuid] == null) {
        this.accessories[tUuid] = this.createZoneThermostat(this.zoneNames[tUuid], tUuid);
      }
      if (this.config.useModeSwitches && this.accessories[switchUuid] == null) {
        this.accessories[switchUuid] = this.createSwitch(this.zoneNames[switchUuid], switchUuid);
      }
      if (this.config.useFan && this.accessories[fUuid] == null) {
        this.accessories[fUuid] = this.createFan(this.zoneNames[fUuid], fUuid);
      }
      if (this.config.useOutdoorTemperatureSensor && this.accessories[outsideUuid] == null) {
        this.accessories[outsideUuid] = this.createTemperatureSensor(`Outdoor`, outsideUuid);
      }
    }
  }

  createZoneThermostat(zoneName, uuid) {
    const zoneAccessory = new this.api.platformAccessory(zoneName, uuid, AccessoryCategories.THERMOSTAT);
    this.log.info(`Creating new thermostat in zone: ${zoneName}`);

    zoneAccessory.addService(Thermostat, zoneName);

    this.api.registerPlatformAccessories(pluginName, platformName, [zoneAccessory]);
    this.configureZoneThermostat(zoneAccessory);
    return zoneAccessory;
  }

  createSwitch(switchName, uuid) {
    this.log.info(`Creating switch with name: ${switchName}, uuid: ${uuid}`);
    const switchAccessory = new this.api.platformAccessory(switchName, uuid, AccessoryCategories.SWITCH);

    const homeService = new Service.Switch("Home", "H" + switchAccessory.id);
    switchAccessory.addService(homeService);
    const awayService = new Service.Switch("Away", "A" + switchAccessory.id);
    switchAccessory.addService(awayService);
    const wakeService = new Service.Switch("Wake", "W" + switchAccessory.id);
    switchAccessory.addService(wakeService);
    const sleepService = new Service.Switch("Sleep", "S" + switchAccessory.id);
    switchAccessory.addService(sleepService);

    this.api.registerPlatformAccessories(pluginName, platformName, [switchAccessory]);
    this.configureSwitch(switchAccessory);
    return switchAccessory;
  }

  createTemperatureSensor(sensorName, uuid) {
    this.log.info(`Creating outdoor temperature sensor with name: ${sensorName}, uuid: ${uuid}`);
    const sensorAccessory = new this.api.platformAccessory(sensorName, uuid, AccessoryCategories.SENSOR);


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
    this.accessories[accessory.UUID] = accessory;
    const thermostatName = this.zoneNames[accessory.UUID];
    const zoneId = this.zoneIds[accessory.UUID];

    this.log.verbose(`configuring ${thermostatName}`);
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
    this.accessories[accessory.UUID] = accessory;
    const sensorName = `Outdoor`;
    this.log.verbose(`configuring ${sensorName}`);

    new InfinitudeSensor(sensorName, this.client, this.log, this.config, accessory, this.Service, this.Characteristic);
  }

  configureSwitch(accessory) {
    this.accessories[accessory.UUID] = accessory;
    const name = this.zoneNames[accessory.UUID];
    const zoneId = this.zoneIds[accessory.UUID];

    this.log.verbose(`configuring ${name} - ${zoneId}`);

    new InfinitudeSwitch(name, this.client, this.log, this.config, accessory, this.Service, this.Characteristic, zoneId);
  }

  configureFan(accessory) {
    this.accessories[accessory.UUID] = accessory;
    const fanName = this.zoneNames[accessory.UUID];
    const zoneId = this.zoneIds[accessory.UUID];
    this.log.verbose(`configuring ${fanName}`);

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
