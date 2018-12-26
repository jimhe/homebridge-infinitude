const { pluginName, platformName } = require('./constants');
const Joi = require('joi');

const configSchema = require('./configSchema');
const InfinitudeClient = require('./InfinitudeClient');

let Characteristic;

module.exports = class InfinitudePlatform {
  constructor(log, config, api) {
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

    Characteristic = api.hap.Characteristic;

    this.log = log;
    this.api = api;
    this.accessories = {};
    this.lastStatus = {};
    this.zoneIds = {};
    this.client = new InfinitudeClient(config['url'], this.log);

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  configureAccessory(accessory) {
    this.accessories[accessory.UUID] = accessory;
  }

  async didFinishLaunching() {
    setInterval(() => this.refreshThermostats(), 30 * 1000);
    this.refreshThermostats();
    for (const uuid in this.accessories) {
      this.configureThermostatAccessory(this.accessories[uuid]);
    }
  }

  async refreshThermostats() {
    const status = await this.client.getStatus();

    if (status === undefined) {
      return;
    }

    this.lastStatus = status;
    const enabledZones = status['status']['zones']['zone'].filter(
      zone => zone['enabled'] === 'on'
    );

    for (const zone of enabledZones) {
      const zoneId = zone['id'];
      const tUuid = this.api.hap.uuid.generate(zoneId);
      const accessory =
        this.accessories[tUuid] || this.createThermostatAccessory(zone, tUuid);
      this.accessories[tUuid] = accessory;
      this.zoneIds[tUuid] = zoneId;
      this.lastStatus[tUuid] = zone;
    }
  }

  createThermostatAccessory(zone, uuid) {
    const accessoryName = `${zone['name']} Thermostat`;
    const newAccessory = new this.api.platformAccessory(accessoryName, uuid);
    newAccessory.addService(this.api.hap.Service.Thermostat, accessoryName);
    this.api.registerPlatformAccessories(pluginName, platformName, [
      newAccessory
    ]);
    this.configureThermostatAccessory(newAccessory);
    return newAccessory;
  }

  configureThermostatAccessory(accessory) {
    const thermostatService = accessory.getService(
      this.api.hap.Service.Thermostat
    );

    thermostatService.setCharacteristic(
      Characteristic.TemperatureDisplayUnits,
      Characteristic.TemperatureDisplayUnits.FAHRENHEIT
    );

    thermostatService.getCharacteristic(Characteristic.CurrentTemperature).on(
      'get',
      function(callback) {
        if (callback) callback(null, this.getCurrentTemperature(accessory));
      }.bind(this)
    );

    thermostatService
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .on(
        'get',
        function(callback) {
          if (callback)
            callback(null, this.getCurrentTemperature(accessory, 'clsp'));
        }.bind(this)
      );

    thermostatService
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .on(
        'get',
        function(callback) {
          if (callback)
            callback(null, this.getCurrentTemperature(accessory, 'htsp'));
        }.bind(this)
      );

    thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on(
        'get',
        function(callback) {
          if (callback)
            callback(null, this.getCurrentHeatingCoolingState(accessory));
        }.bind(this)
      );

    thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on(
        'get',
        function(callback) {
          if (callback)
            callback(null, this.getTargetHeatingCoolingState(accessory));
        }.bind(this)
      )
      .on(
        'set',
        function(targetHeatingCoolingState, callback) {
          switch (targetHeatingCoolingState) {
            case Characteristic.TargetHeatingCoolingState.OFF:
              this.client.setActivity(
                this.getZoneId(accessory),
                'away',
                callback
              );
              break;
            case Characteristic.TargetHeatingCoolingState.HEAT:
              this.client.setActivity(
                this.getZoneId(accessory),
                'manual',
                callback
              );
              break;
            case Characteristic.TargetHeatingCoolingState.COOL:
              this.client.setActivity(
                this.getZoneId(accessory),
                'manual',
                callback
              );
              break;
            case Characteristic.TargetHeatingCoolingState.AUTO:
              this.client.setActivity(
                this.getZoneId(accessory),
                'home',
                callback
              );
              callback(null);
              break;
          }
        }.bind(this)
      );

    thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .on(
        'get',
        function(callback) {
          const targetState = this.getTargetHeatingCoolingState(accessory);
          const currentState = this.getCurrentHeatingCoolingState(accessory);
          let targetTemperature;
          switch (targetState) {
            case Characteristic.TargetHeatingCoolingState.OFF:
              targetTemperature = this.getCurrentTemperature(accessory);
              break;
            case Characteristic.TargetHeatingCoolingState.HEAT:
              targetTemperature = this.getCurrentTemperature(accessory, 'htsp');
              break;
            case Characteristic.TargetHeatingCoolingState.COOL:
              targetTemperature = this.getCurrentTemperature(accessory, 'clsp');
              break;
            case Characteristic.TargetHeatingCoolingState.AUTO:
              switch (currentState) {
                case Characteristic.CurrentHeatingCoolingState.OFF:
                  targetTemperature = this.getCurrentTemperature(accessory);
                  break;
                case Characteristic.CurrentHeatingCoolingState.HEAT:
                  targetTemperature = this.getCurrentTemperature(
                    accessory,
                    'htsp'
                  );
                  break;
                case Characteristic.CurrentHeatingCoolingState.COOL:
                  targetTemperature = this.getCurrentTemperature(
                    accessory,
                    'clsp'
                  );
                  break;
                default:
                  this.log.error(
                    `Unexpected CurrentHeatingCoolingState: ${currentState}`
                  );
              }
              break;
            default:
              this.log.error(
                `Unexpected TargetHeatingCoolingState: ${targetState}`
              );
          }
          if (callback) callback(null, targetTemperature);
        }.bind(this)
      )
      .on(
        'set',
        function(targetTemperature, callback) {
          this.client.updateTemperature(
            this.getZoneId(accessory),
            this.celsiusToFahrenheit(targetTemperature),
            callback
          );
        }.bind(this)
      );

    thermostatService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on(
        'get',
        function(callback) {
          if (callback)
            callback(null, this.getCurrentRelativeHumidity(accessory));
        }.bind(this)
      );
  }

  fahrenheitToCelsius(temperature) {
    return (temperature - 32) / 1.8;
  }

  celsiusToFahrenheit(temperature) {
    return temperature * 1.8 + 32;
  }

  getZoneId(accessory) {
    return this.zoneIds[accessory.UUID];
  }

  getCurrentTemperature(accessory, property = 'rt') {
    return this.fahrenheitToCelsius(
      parseFloat(this.lastStatus[accessory.UUID][property])
    );
  }

  getCurrentHeatingCoolingState(accessory) {
    var currentState;
    switch (this.lastStatus[accessory.UUID]['zoneconditioning']) {
      case 'idle':
        currentState = Characteristic.CurrentHeatingCoolingState.OFF;
        break;
      case 'active_heat':
        currentState = Characteristic.CurrentHeatingCoolingState.HEAT;
        break;
      default:
        currentState = Characteristic.CurrentHeatingCoolingState.COOL;
        break;
    }
    return currentState;
  }

  getTargetHeatingCoolingState(accessory) {
    var targetState;
    const currentTemperature = this.getCurrentTemperature(accessory);
    const targetTemperature = this.getCurrentTemperature(accessory, 'htsp');
    switch (this.lastStatus[accessory.UUID]['currentActivity']) {
      case 'away':
        targetState = Characteristic.TargetHeatingCoolingState.OFF;
        break;
      case 'home':
      case 'sleep':
      case 'awake':
        targetState = Characteristic.TargetHeatingCoolingState.AUTO;
        break;
      case 'manual':
        if (currentTemperature > targetTemperature) {
          targetState = Characteristic.TargetHeatingCoolingState.COOL;
        } else if (currentTemperature < targetTemperature) {
          targetState = Characteristic.TargetHeatingCoolingState.HEAT;
        } else {
          targetState = Characteristic.TargetHeatingCoolingState.OFF;
        }
        break;
    }
    return targetState;
  }

  getCurrentRelativeHumidity(accessory) {
    return parseFloat(this.lastStatus[accessory.UUID]['rh']);
  }
};
