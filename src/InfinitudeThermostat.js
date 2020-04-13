const Characteristic = require('hap-nodejs').Characteristic;
const Thermostat = require('hap-nodejs').Service.Thermostat;

module.exports = class InfinitudeThermostat {
  constructor(name, zoneId, client, log, platformAccessory) {
    this.name = name;
    this.zoneId = zoneId;
    this.client = client;
    this.log = log;
    this.initialize(platformAccessory.getService(Thermostat));
  }

  initialize(thermostatService) {
    thermostatService.setCharacteristic(
      Characteristic.TemperatureDisplayUnits,
      Characteristic.TemperatureDisplayUnits.FAHRENHEIT
    );

    thermostatService.getCharacteristic(Characteristic.CurrentTemperature).on(
      'get',
      function(callback) {
        this.getCurrentTemperature().then(function(currentTemperature) {
          callback(null, currentTemperature);
        });
      }.bind(this)
    );

    thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).on(
      'get',
      function(callback) {
        this.getCurrentHeatingCoolingState().then(function(state) {
          callback(null, state);
        });
      }.bind(this)
    );

    thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on(
        'get',
        function(callback) {
          this.getTargetHeatingCoolingState().then(function(state) {
            callback(null, state);
          });
        }.bind(this)
      )
      .on(
        'set',
        function(targetHeatingCoolingState, callback) {
          switch (targetHeatingCoolingState) {
            case Characteristic.TargetHeatingCoolingState.OFF:
              return this.client.setActivity(this.zoneId, 'away', callback);
            case Characteristic.TargetHeatingCoolingState.AUTO:
              return this.client.setActivity(this.zoneId, 'manual', callback);
            default:
              this.log.warn(`Unsupported state ${targetHeatingCoolingState} for ${this.name}`);
              callback('The only supported states are OFF or AUTO');
              break;
          }
        }.bind(this)
      );

    thermostatService
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .on(
        'get',
        function(callback) {
          this.getTargetTemperatures().then(
            function(targetTemperatures) {
              callback(null, targetTemperatures.htsp);
            }.bind(this)
          );
        }.bind(this)
      )
      .on(
        'set',
        function(thresholdTemperature, callback) {
          return this.client.setTargetTemperature(
            this.zoneId,
            'manual',
            InfinitudeThermostat.convertToHomeKit(thresholdTemperature),
            'htsp',
            callback
          );
        }.bind(this)
      );

    thermostatService
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .on(
        'get',
        function(callback) {
          this.getTargetTemperatures().then(function(targetTemperatures) {
            callback(null, targetTemperatures.clsp);
          });
        }.bind(this)
      )
      .on(
        'set',
        function(thresholdTemperature, callback) {
          return this.client.setTargetTemperature(
            this.zoneId,
            'manual',
            InfinitudeThermostat.convertToHomeKit(thresholdTemperature),
            'clsp',
            callback
          );
        }.bind(this)
      );

    thermostatService.getCharacteristic(Characteristic.CurrentRelativeHumidity).on(
      'get',
      function(callback) {
        this.getCurrentRelativeHumidity().then(function(humidity) {
          callback(null, humidity);
        });
      }.bind(this)
    );
  }

  getTargetTemperatures() {
    return this.getZoneTarget().then(
      function(zoneTarget) {
        const targetActivity = zoneTarget['holdActivity'][0];
        const activityTarget = zoneTarget['activities'][0]['activity'].find(
          activity => activity['id'] === targetActivity
        );
        return {
          htsp: InfinitudeThermostat.convertInfinitudeTemperature(activityTarget.htsp[0]),
          clsp: InfinitudeThermostat.convertInfinitudeTemperature(activityTarget.clsp[0])
        };
      }.bind(this)
    );
  }

  getCurrentHeatingCoolingState() {
    return this.getZoneStatus().then(function(status) {
      switch (status['zoneconditioning']) {
        case 'idle':
          return Characteristic.CurrentHeatingCoolingState.OFF;
        case 'active_heat':
          return Characteristic.CurrentHeatingCoolingState.HEAT;
        default:
          return Characteristic.CurrentHeatingCoolingState.COOL;
      }
    });
  }

  getCurrentRelativeHumidity() {
    return this.getZoneStatus().then(function(status) {
      return parseFloat(status['rh']);
    });
  }

  getTargetHeatingCoolingState() {
    return this.getZoneTarget().then(
      function(zoneTarget) {
        const targetActivity = zoneTarget['holdActivity'][0];
        switch (targetActivity) {
          case 'manual':
            return Characteristic.TargetHeatingCoolingState.AUTO;
          default:
            return Characteristic.TargetHeatingCoolingState.OFF;
        }
      }.bind(this)
    );
  }

  getCurrentTemperature(property = 'rt') {
    return this.getZoneStatus().then(function(zoneStatus) {
      return InfinitudeThermostat.convertInfinitudeTemperature(zoneStatus[property]);
    });
  }

  getZoneStatus() {
    return this.client.getStatus().then(
      function(status) {
        return status.zones.zone.find(zone => zone['id'] === this.zoneId);
      }.bind(this)
    );
  }

  getZoneTarget() {
    return this.client.getSystems().then(
      function(systems) {
        return systems['system'][0]['config'][0]['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
      }.bind(this)
    );
  }

  static fahrenheitToCelsius(temperature) {
    return (temperature - 32) / 1.8;
  }

  static celsiusToFahrenheit(temperature) {
    return temperature * 1.8 + 32;
  }

  static convertToHomeKit(temperature) {
    return Math.round(this.celsiusToFahrenheit(temperature)).toFixed(1);
  }

  static convertInfinitudeTemperature(temperature) {
    return this.fahrenheitToCelsius(temperature);
  }
};
