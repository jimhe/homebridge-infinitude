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

    service.getCharacteristic(Characteristic.CurrentTemperature).on(
      'get',
      function (callback) {
        this.getCurrentTemperature().then(function (currentTemperature) {
          callback(null, currentTemperature);
        });
      }.bind(this)
    );

    service
      .getCharacteristic(Characteristic.TargetTemperature)
      .on(
        'get',
        function (callback) {
          this.getTemperatures().then(
            function (targets) {
              if (targets.mode === 'heat') {
                callback(null, targets.htsp);
              } else if (targets.mode === 'cool') {
                callback(null, targets.clsp);
              } else {
                callback(null, targets.currentTemp);
              }
            }.bind(this)
          );
        }.bind(this)
      )
      .on(
        'set',
        function (thresholdTemperature, callback) {
          return this.client.getTemperatureScale().then(
            function (tempScale) {
              return this.getNextActivityTime().then(
                function (time) {
                  let activity = null;

                  if (!time) {
                    let holdDuration = this.config.holdUntil ? this.config.holdUntil : 'forever';
                    this.client.setActivity(this.zoneId, 'manual', holdDuration, null);
                    activity = 'manual';
                  }

                  return this.getTargetHeatingCoolingState().then(
                    function (state) {
                      const mode = state === Characteristic.TargetHeatingCoolingState.HEAT ? 'htsp' : 'clsp';
                      return this.client.setTargetTemperature(
                        this.zoneId,
                        this.convertToInfinitude(thresholdTemperature, tempScale),
                        mode,
                        activity,
                        callback
                      );
                    }.bind(this)
                  );
                }.bind(this)
              );
            }.bind(this)
          );
        }.bind(this)
      );

    service.getCharacteristic(Characteristic.CurrentHeatingCoolingState).on(
      'get',
      function (callback) {
        this.getCurrentHeatingCoolingState().then(function (state) {
          callback(null, state);
        });
      }.bind(this)
    );

    service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on(
        'get',
        function (callback) {
          this.getTargetHeatingCoolingState().then(function (state) {
            callback(null, state);
          });
        }.bind(this)
      )
      .on(
        'set',
        function (targetHeatingCoolingState, callback) {
          switch (targetHeatingCoolingState) {
            case Characteristic.TargetHeatingCoolingState.OFF:
              if (this.config.shutOffAway) {
                if (this.config.holdUntilNextActivity) {
                  return this.getNextActivityTime().then(
                    function (time) {
                      if (!time) {
                        return this.client.setActivity(this.zoneId, 'away', 'forever', callback);
                      } else {
                        return this.client.setActivity(this.zoneId, 'away', time, callback);
                      }
                    }.bind(this)
                  );
                } else {
                  return this.client.setActivity(this.zoneId, 'away', 'forever', callback);
                }
              } else {
                return this.client.removeHold(this.zoneId).then(
                  function () {
                    return this.client.setSystemMode('off', callback);
                  }.bind(this)
                );
              }
            case Characteristic.TargetHeatingCoolingState.AUTO:
              return this.client.removeHold(this.zoneId).then(
                function () {
                  return this.client.setSystemMode('auto', callback);
                }.bind(this)
              );
            case Characteristic.TargetHeatingCoolingState.HEAT:
              return this.client.removeHold(this.zoneId).then(
                function () {
                  return this.client.setSystemMode('heat', callback);
                }.bind(this)
              );
            case Characteristic.TargetHeatingCoolingState.COOL:
              return this.client.removeHold(this.zoneId).then(
                function () {
                  return this.client.setSystemMode('cool', callback);
                }.bind(this)
              );
          }
        }.bind(this)
      );

    service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .on(
        'get',
        function (callback) {
          this.getTemperatures().then(
            function (targetTemperatures) {
              callback(null, targetTemperatures.htsp);
            }.bind(this)
          );
        }.bind(this)
      )
      .on(
        'set',
        function (thresholdTemperature, callback) {
          return this.client.getTemperatureScale().then(
            function (tempScale) {
              return this.client.setTargetTemperature(
                this.zoneId,
                this.convertToHomeKit(thresholdTemperature, tempScale),
                'htsp',
                null,
                callback
              );
            }.bind(this)
          );
        }.bind(this)
      );

    service
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .on(
        'get',
        function (callback) {
          this.getTemperatures().then(function (targetTemperatures) {
            callback(null, targetTemperatures.clsp);
          });
        }.bind(this)
      )
      .on(
        'set',
        function (thresholdTemperature, callback) {
          return this.client.getTemperatureScale().then(
            function (tempScale) {
              return this.client.setTargetTemperature(
                this.zoneId,
                this.convertToHomeKit(thresholdTemperature, tempScale),
                'clsp',
                null,
                callback
              );
            }.bind(this)
          );
        }.bind(this)
      );

    service.getCharacteristic(Characteristic.CurrentRelativeHumidity).on(
      'get',
      function (callback) {
        this.getCurrentRelativeHumidity().then(function (humidity) {
          callback(null, humidity);
        });
      }.bind(this)
    );

   service.getCharacteristic(Characteristic.FilterChangeIndication).on(
      'get',
      function (callback) {
        this.getFilterChangeIndication().then(function (filterChangeIndication) {
          callback(null, filterChangeIndication);
        });
      }.bind(this)
    );
  
    service.getCharacteristic(Characteristic.FilterLifeLevel).on(
      'get',
      function (callback) {
        this.getFilterLifeLevel().then(function (filterlevel) {
          //reverses filter level to make it more user intuitive. 100 means new, 0 means needs to be replaced.
          filterlevel = 100 - filterlevel;
          callback(null, filterlevel);
        });
      }.bind(this)
    );
  }

  getTemperatures() {
    return this.client.getTemperatureScale().then(
      function (tempScale) {
        return this.client.getSystem().then(
          function (system) {
            var zoneStatus = system.status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);

            this.log.verbose(`GetTemperatures(): Found zone with ID ${this.zoneId}: ${JSON.stringify(zoneStatus)}`);

            const htsp = zoneStatus['htsp'][0];
            const clsp = zoneStatus['clsp'][0];

            var response = {
              htsp: this.clamp(this.convertToHomeKit(htsp, tempScale), MIN_HEAT_C, MAX_HEAT_C),
              clsp: this.clamp(this.convertToHomeKit(clsp, tempScale), MIN_COOL_C, MAX_COOL_C),
              currentTemp: this.getCurrentTemperature(),
              mode: system.config['mode'][0]
            };

            this.log.verbose(`GetTemperatures(): Response to HomeKit ${JSON.stringify(response)}`);

            return response;
          }.bind(this)
        );
      }.bind(this)
    );
  }

  getCurrentHeatingCoolingState() {
    return this.client.getZoneStatus(this.zoneId).then(function (status) {
      switch (status['zoneconditioning'][0]) {
        case 'idle':
          return Characteristic.CurrentHeatingCoolingState.OFF;
        case 'active_heat':
          return Characteristic.CurrentHeatingCoolingState.HEAT;
        default:
          return Characteristic.CurrentHeatingCoolingState.COOL;
      }
    }.bind(this));
  }

  getCurrentRelativeHumidity() {
    return this.client.getZoneStatus(this.zoneId).then(function (status) {
      return parseFloat(status['rh'][0]);
    });
  }

  getTargetHeatingCoolingState() {
    return this.client.getSystem().then(
      function (system) {
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
      }.bind(this)
    );
  }

  getScheduledActivity() {
    return this.client.getSystem().then(
      function (system) {
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
      }.bind(this)
    );
  }

  getNextActivityTime() {
    return this.client.getSystem().then(
      function (system) {
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
      }.bind(this)
    );
  }

  getFilterChangeIndication() {
    return this.getFilterLifeLevel().then(function (filterLifeLevel) {
      // Determine filter change indication based on FilterLifeLevel value
      // For example, consider filter needs changing when FilterLifeLevel drops below 10%
      const filterNeedsChanging = filterLifeLevel < 10; // Adjust the threshold as needed
      return filterNeedsChanging;
    });
  }

  getFilterLifeLevel() {
    return this.client.getStatus('filtrlvl').then(function (filterLevel) {
      return parseFloat(filterLevel);
    });
  }

  getCurrentTemperature(property = 'rt') {
    return this.client.getTemperatureScale().then(
      function (tempScale) {
        return this.client.getZoneStatus(this.zoneId).then(
          function (zoneStatus) {
            return this.convertToHomeKit(zoneStatus[property][0], tempScale);
          }.bind(this)
        );
      }.bind(this)
    );
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
