let Characteristic, Service;

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
  }

  initialize(thermostatService) {
    thermostatService.setCharacteristic(
      Characteristic.TemperatureDisplayUnits,
      Characteristic.TemperatureDisplayUnits.FAHRENHEIT
    );

    thermostatService.getCharacteristic(Characteristic.CurrentTemperature).on(
      'get',
      function (callback) {
        this.getCurrentTemperature().then(function (currentTemperature) {
          callback(null, currentTemperature);
        });
      }.bind(this)
    );

    thermostatService.getCharacteristic(Characteristic.TargetTemperature).on(
      'get',
      function (callback) {
        this.getTemperatures().then(function (targets) {
          if (targets.mode === 'heat') {
            callback(null, targets.htsp);
          }
          else if (targets.mode === 'cool') {
            callback(null, targets.clsp);
          }
          else {
            callback(null, targets.currentTemp);
          }
        }.bind(this));
      }.bind(this)
    ).on(
      'set',
      function (thresholdTemperature, callback) {
        return this.client.getTemperatureScale().then(
          function (tempScale) {
            return this.getNextActivityTime().then(
              function (time) {
                let activity = null;

                if (!time) {
                  let holdDuration = this.config.holdUntil ? this.config.holdUntil : "forever";
                  this.client.setActivity(this.zoneId, "manual", holdDuration, null);
                  activity = "manual";
                }

                return this.getTargetHeatingCoolingState().then(function (state) {
                  const mode = (state === Characteristic.TargetHeatingCoolingState.HEAT) ? "htsp" : "clsp";
                  return this.client.setTargetTemperature(
                    this.zoneId,
                    this.client.convertToInfinitude(thresholdTemperature, tempScale),
                    mode,
                    activity,
                    callback
                  );
                }.bind(this))
              }.bind(this))
          }.bind(this))
      }.bind(this)
    );

    thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).on(
      'get',
      function (callback) {
        this.getCurrentHeatingCoolingState().then(function (state) {
          callback(null, state);
        });
      }.bind(this)
    );

    thermostatService
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
                        return this.client.setActivity(this.zoneId, "away", "forever", callback);
                      }
                      else {
                        return this.client.setActivity(this.zoneId, "away", time, callback);
                      }
                    }.bind(this)
                  )
                }
                else {
                  return this.client.setActivity(this.zoneId, "away", "forever", callback);
                }
              }
              else {
                return this.client.removeHold(this.zoneId).then(
                  function () {
                    return this.client.setSystemMode('off', callback);
                  }.bind(this)
                )

              }
            case Characteristic.TargetHeatingCoolingState.AUTO:
              return this.client.removeHold(this.zoneId).then(
                function () {
                  return this.client.setSystemMode('auto', callback);
                }.bind(this)
              )
            case Characteristic.TargetHeatingCoolingState.HEAT:
              return this.client.removeHold(this.zoneId).then(
                function () {
                  return this.client.setSystemMode('heat', callback);
                }.bind(this)
              )
            case Characteristic.TargetHeatingCoolingState.COOL:
              return this.client.removeHold(this.zoneId).then(
                function () {
                  return this.client.setSystemMode('cool', callback);
                }.bind(this)
              )
          }
        }.bind(this)
      );

    thermostatService
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
                this.client.convertToHomeKit(thresholdTemperature, tempScale),
                'htsp',
                null,
                callback
              );
            }.bind(this))
        }.bind(this)
      );

    thermostatService
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
          return this.getTemperatureScale().then(
            function (tempScale) {
              return this.client.setTargetTemperature(
                this.zoneId,
                this.client.convertToHomeKit(thresholdTemperature, tempScale),
                'clsp',
                null,
                callback
              );
            }.bind(this))
        }.bind(this)
      );

    thermostatService.getCharacteristic(Characteristic.CurrentRelativeHumidity).on(
      'get',
      function (callback) {
        this.getCurrentRelativeHumidity().then(function (humidity) {
          callback(null, humidity);
        });
      }.bind(this)
    );

    thermostatService.getCharacteristic(Characteristic.FilterLifeLevel).on(
      'get',
      function (callback) {
        this.getFilterLifeLevel().then(function (filterlevel) {
          //reverses filter level to make it more user intuitive. 100 means new, 0 means needs to be replaced.
          filterlevel = 100-filterlevel;
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
            return this.getScheduledActivity().then(
              function (activity) {
                var zoneStatus = system.status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
                var htsp = activity['htsp'][0];
                var clsp = activity['clsp'][0];

                if (zoneStatus['hold'][0] == 'on' && zoneStatus['currentActivity'][0] == 'away') {
                  htsp = zoneStatus['htsp'][0];
                  clsp = zoneStatus['clsp'][0];
                }

                return {
                  htsp: this.client.convertToHomeKit(htsp, tempScale),
                  clsp: this.client.convertToHomeKit(clsp, tempScale),
                  currentTemp: this.getCurrentTemperature(),
                  mode: system.config['mode'][0]
                };
              }.bind(this))
          }.bind(this))
      }.bind(this));
  }

  getCurrentHeatingCoolingState() {
    return this.getZoneStatus().then(function (status) {
      switch (status['zoneconditioning'][0]) {
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
    return this.getZoneStatus().then(function (status) {
      return parseFloat(status['rh'][0]);
    });
  }

  getTargetHeatingCoolingState() {
    return this.client.getSystem().then(
      function (system) {
        var zone = system.status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);

        if (zone['hold'][0] == 'on' && zone['currentActivity'][0] == 'away') {
          return Characteristic.TargetHeatingCoolingState.OFF;
        }
        else {
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
        var time = (systemDate.getHours() * 100) + systemDate.getMinutes();
        var zoneConfig = system.config['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
        var activePeriods = zoneConfig['program'][0]['day'][dayOfWeek]['period'].filter(p => {
          var timePieces = p['time'][0].split(':');
          var periodTime = timePieces[0] * 100 + timePieces[1] * 1;
          return p['enabled'][0] === 'on' && periodTime <= time
        });

        var activityName = 'home';
        if (activePeriods.length > 0) {
          activityName = activePeriods[activePeriods.length - 1]['activity'][0];
        }
        else {
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
        var time = (systemDate.getHours() * 100) + systemDate.getMinutes();
        var zoneConfig = system.config['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);

        var activePeriod = zoneConfig['program'][0]['day'][dayOfWeek]['period'].find(p => {
          var timePieces = p['time'][0].split(':');
          var periodTime = timePieces[0] * 100 + timePieces[1] * 1;
          return p['enabled'][0] === 'on' && periodTime > time
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

  getFilterLifeLevel() {
    return this.client.getStatus().then(function (status) {
      return parseFloat(status['filtrlvl'][0]);
    });
  }

  getCurrentTemperature(property = 'rt') {
    return this.getTemperatureScale().then(
      function (tempScale) {
        return this.getZoneStatus().then(function (zoneStatus) {
          return InfinitudeThermostat.convertToHomeKit(zoneStatus[property][0], tempScale);
        });
      }.bind(this))
  }

  getZoneStatus() {
    return this.client.getStatus().then(
      function (status) {
        return status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
      }.bind(this)
    );
  }

  getZoneTarget() {
    return this.client.getConfig().then(
      function (config) {
        return config['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
      }.bind(this)
    );
  }

  getFilterLifeLevel() {
    return this.client.getStatus().then(function (status) {
      return parseFloat(status['filtrlvl'][0]);
    });
  }

  getCurrentTemperature(property = 'rt') {
    return this.client.getTemperatureScale().then(
      function (tempScale) {
        return this.getZoneStatus().then(function (zoneStatus) {
          return this.client.convertToHomeKit(zoneStatus[property][0], tempScale);
        }.bind(this));
      }.bind(this))
  }
};
