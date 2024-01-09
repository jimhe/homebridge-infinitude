let Characteristic, Service;

let MIN_COOL_C = 10;
let MAX_COOL_C = 35;
let MIN_HEAT_C = 0;
let MAX_HEAT_C = 25;

module.exports = class InfinitudeThermostat {
  constructor(name, zoneId, client, log, config, platformAccessory, service, characteristic) {
    this.name = name;
    this.zoneId = zoneId;
    this.client = client;
    this.log = log;
    this.config = config;

    Service = service;
    Characteristic = characteristic;

    this.initialize(platformAccessory.getService(Service.Thermostat));
    this.bindInformation(platformAccessory.getService(Service.AccessoryInformation));
  }

  bindInformation(service) {
    if (this.config.advancedDetails != undefined) {
      service
        .setCharacteristic(Characteristic.Manufacturer, this.config.advancedDetails.manufacturer)
        .setCharacteristic(Characteristic.Model, this.config.advancedDetails.model)
        .setCharacteristic(Characteristic.SerialNumber, `${this.config.advancedDetails.serial}-s`);
    }
  }

  initialize(service) {
    service.setCharacteristic(
      Characteristic.TemperatureDisplayUnits,
      Characteristic.TemperatureDisplayUnits.FAHRENHEIT
    );

    service.getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    service.getCharacteristic(Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this));

    service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    service
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .onGet(this.getCoolingThresholdTemperature.bind(this))
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    service.getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this));

    service.getCharacteristic(Characteristic.FilterChangeIndication)
      .onGet(this.getFilterChangeIndication.bind(this));

    service.getCharacteristic(Characteristic.FilterLifeLevel)
      .onGet(this.getFilterLifeLevel.bind(this));
  }

  async getCurrentTemperature() {
    var tempScale = await this.client.getTemperatureScale();
    var zoneStatus = await this.client.getZoneStatus(this.zoneId);

    var currentTemp = parseFloat(zoneStatus['rt'][0]);
    return this.convertToHomeKit(currentTemp, tempScale);
  }

  async getTargetTemperature() {
    var targets = await this.getTemperatures();

    if (targets.mode === 'heat') {
      return targets.htsp
    } else if (targets.mode === 'cool') {
      return targets.clsp;
    } else {
      return targets.currentTemp;
    }
  }

  async setTargetTemperature(value) {
    var tempScale = await this.client.getTemperatureScale();
    var nextActivityTime = await this.getNextActivityTime();

    let activity = "manual";

    if (!nextActivityTime) {
      nextActivityTime = this.config.holdUntil ? this.config.holdUntil : 'forever';
    }

    await this.client.setActivity(this.zoneId, activity, nextActivityTime, null);


    var state = await this.getTargetHeatingCoolingState();

    const mode = state === Characteristic.TargetHeatingCoolingState.HEAT ? 'htsp' : 'clsp';
    const temp = this.convertToInfinitude(value, tempScale);

    this.log.info(`Set thermostat to ${temp}${tempScale} until ${nextActivityTime}`);

    return this.client.setTargetTemperature(this.zoneId,
      temp,
      mode,
      activity,
      null
    );

  }

  async setTargetHeatingCoolingState(value) {
    await this.client.removeHold(this.zoneId);
    var mode = "notset";

    switch (value) {
      case Characteristic.TargetHeatingCoolingState.OFF:
        if (this.config.shutOffAway) {
          return this.setSystemModeShutOffAway();
        } else {
          mode = "off";
        }
        break;
      case Characteristic.TargetHeatingCoolingState.AUTO:
        mode = "auto";
        break;
      case Characteristic.TargetHeatingCoolingState.HEAT:
        mode = "heat";
        break;
      case Characteristic.TargetHeatingCoolingState.COOL:
        mode = "cool";
        break;
    }

    this.log.info(`Set system mode to ${mode}`);
    return this.client.setSystemMode(mode);
  }

  async setSystemModeShutOffAway() {
    this.log.verbose("setting thermostat to away because the system was turned off, and shutOffAway is true");

    if (this.config.holdUntilNextActivity) {
      var nextActivityTime = await this.getNextActivityTime();
      const time = nextActivityTime ?? "forever";

      this.log.verbose(`Set system to away until ${time}`);

      if (!nextActivityTime) {
        return this.client.setActivity(this.zoneId, 'away', 'forever', null);
      } else {
        return this.client.setActivity(this.zoneId, 'away', nextActivityTime, null);
      }
    } else {
      return this.client.setActivity(this.zoneId, 'away', 'forever', null);
    }
  }

  async getHeatingThresholdTemperature() {
    var targetTemperatures = await this.getTemperatures();
    return targetTemperatures.htsp;
  }

  async setHeatingThresholdTemperature(value) {
    return this.setThresholdTemperature(value, "htsp");
  }

  async getCoolingThresholdTemperature() {
    var targetTemperatures = await this.getTemperatures();
    return targetTemperatures.clsp;
  }

  async setCoolingThresholdTemperature(value) {
    return this.setThresholdTemperature(value, "clsp");
  }

  async setThresholdTemperature(value, mode) {
    var tempScale = await this.client.getTemperatureScale();
    var temp = this.convertToHomeKit(value, tempScale);

    this.log.info(`Set target ${mode} temperature to ${temp}`);

    return this.client.setTargetTemperature(this.zoneId, temp, mode, "manual", null);
  }

  async getTemperatures() {
    const tempScale = await this.client.getTemperatureScale();
    const system = await this.client.getSystem();
    const currentTemperature = await this.getCurrentTemperature();

    var zoneStatus = system.status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);

    this.log.verbose(`GetTemperatures(): Found zone with ID ${this.zoneId}: ${JSON.stringify(zoneStatus)}`);

    const htsp = parseFloat(zoneStatus['htsp'][0]);
    const clsp = parseFloat(zoneStatus['clsp'][0]);

    var response = {
      htsp: this.clamp(this.convertToHomeKit(htsp, tempScale), MIN_HEAT_C, MAX_HEAT_C),
      clsp: this.clamp(this.convertToHomeKit(clsp, tempScale), MIN_COOL_C, MAX_COOL_C),
      currentTemp: currentTemperature,
      mode: system.config['mode'][0]
    };

    this.log.verbose(`GetTemperatures(): Response to HomeKit ${JSON.stringify(response)}`);

    return response;

  }

  async getCurrentHeatingCoolingState() {
    const status = await this.client.getZoneStatus(this.zoneId);

    switch (status['zoneconditioning'][0]) {
      case 'idle':
        return Characteristic.CurrentHeatingCoolingState.OFF;
      case 'active_heat':
        return Characteristic.CurrentHeatingCoolingState.HEAT;
      default:
        return Characteristic.CurrentHeatingCoolingState.COOL;
    }
  }

  async getCurrentRelativeHumidity() {
    const status = await this.client.getZoneStatus(this.zoneId);
    return parseFloat(status['rh'][0]);
  }

  async getTargetHeatingCoolingState() {
    const system = await this.client.getSystem()
    var zone = system.status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);

    if (zone['hold'][0] == 'on' && zone['currentActivity'][0] == 'away') {
      return Characteristic.TargetHeatingCoolingState.OFF;
    } else {
      const systemMode = system.config['mode'][0];

      switch (systemMode) {
        case 'auto':
          return Characteristic.TargetHeatingCoolingState.AUTO;
        case 'heat':
        case 'hpheat':
          return Characteristic.TargetHeatingCoolingState.HEAT;
        case 'cool':
          return Characteristic.TargetHeatingCoolingState.COOL;
        default:
          return Characteristic.TargetHeatingCoolingState.OFF;
      }
    }
  }

  async getScheduledActivity() {
    const system = await this.client.getSystem();

    var localTime = system.status['localTime'][0].substring(0, 19);
    var systemDate = new Date(localTime);
    var dayOfWeek = systemDate.getDay();
    var time = systemDate.getHours() * 100 + systemDate.getMinutes();
    var zoneConfig = system.config['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
    var activePeriods = zoneConfig['program'][0]['day'][dayOfWeek]['period'].filter(p => {
      var timePieces = p['time'][0].split(':');
      var periodTime = timePieces[0] * 100 + timePieces[1] * 1;
      return p['enabled'][0] === 'on' && periodTime <= time;
    });

    var activityName = 'home';
    if (activePeriods.length > 0) {
      activityName = activePeriods[activePeriods.length - 1]['activity'][0];
    } else {
      var zoneStatus = system.status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
      activityName = zoneStatus['currentActivity'][0];
    }

    var activity = zoneConfig['activities'][0]['activity'].find(act => act['id'] === activityName);
    return activity;
  }

  async getNextActivityTime() {
    const system = await this.client.getSystem();

    var localTime = system.status['localTime'][0].substring(0, 19);
    var systemDate = new Date(localTime);
    var dayOfWeek = systemDate.getDay();
    var time = systemDate.getHours() * 100 + systemDate.getMinutes();
    var zoneConfig = system.config['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);

    var activePeriod = zoneConfig['program'][0]['day'][dayOfWeek]['period'].find(p => {
      var timePieces = p['time'][0].split(':');
      var periodTime = timePieces[0] * 100 + timePieces[1] * 1;
      return p['enabled'][0] === 'on' && periodTime > time;
    });

    //if no activity for current day, check the rest of the week.
    //if no activities found, return null
    const initialDayOfWeek = dayOfWeek;
    while (!activePeriod) {
      dayOfWeek++;
      if (dayOfWeek == 7) {
        dayOfWeek = 0;
      }

      if (dayOfWeek === initialDayOfWeek) {
        return null;
      }

      activePeriod = zoneConfig['program'][0]['day'][dayOfWeek]['period'].find(p => {
        return p['enabled'][0] === 'on';
      });
    }

    return activePeriod['time'][0];
  }

  async getFilterChangeIndication() {
    var filterLifeLevel = await this.getFilterLifeLevel();
    // Determine filter change indication based on FilterLifeLevel value
    // For example, consider filter needs changing when FilterLifeLevel drops below 10%
    return filterLifeLevel < 10; // Adjust the threshold as needed
  }

  async getFilterLifeLevel() {
    var filterLevel = await this.client.getStatus('filtrlvl');
    var filterValue = parseFloat(filterLevel);

    return 100 - filterValue;
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  convertToInfinitude(temperature, scale) {
    let t = temperature;

    if (scale === 'F') {
      t = this.client.celsiusToFahrenheit(temperature);
    }

    return parseFloat(t).toFixed(1);
  }

  convertToHomeKit(temperature, scale) {
    let t = temperature;

    if (scale === 'F') {
      t = this.client.fahrenheitToCelsius(temperature);
    }

    return parseFloat(t).toFixed(1);
  }
};
