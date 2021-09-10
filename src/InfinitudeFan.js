let Characteristic, Service;

module.exports = class InfinitudeFan {
  constructor(name, zoneId, client, log, config, platformAccessory, service, characteristic) {
    this.name = name;
    this.client = client;
    this.log = log;
    this.config = config;
    this.zoneId = zoneId;

    Service = service;
    Characteristic = characteristic;

    this.initialize(platformAccessory.getService(Service.Fanv2));
  }

  initialize(FanService) {
    FanService.getCharacteristic(Characteristic.Active)
      .on(
        'get',
        function (callback) {
          this.getActiveState().then(function (state) {
            callback(null, state);
          });
        }.bind(this)
      );

    FanService.getCharacteristic(Characteristic.TargetFanState)
      .on(
        'get',
        function (callback) {
          this.getTargetFanState().then(function (targetFanState) {
            callback(null, targetFanState);
          });
        }.bind(this)
      );

    FanService.getCharacteristic(Characteristic.CurrentFanState)
      .on(
        'get',
        function (callback) {
          this.getCurrentState().then(function (currentFanState) {
            callback(null, currentFanState);
          });
        }.bind(this)
      );
  }

  getCurrentState() {
    return this.getZoneStatus().then(function (status) {
      switch (status['fan'][0]) {
        case 'off':
          return Characteristic.CurrentFanState.IDLE;
        default:
          return Characteristic.CurrentFanState.BLOWING_AIR;
      }
    }.bind(this));
  }

  getActiveState() {
    return this.getZoneStatus().then(function (status) {
      switch (status['fan'][0]) {
        case 'off':
          return Characteristic.Active.INACTIVE;
        default:
          return Characteristic.Active.ACTIVE;
      }
    }.bind(this));
  }

  getTargetFanState() {
    return this.getScheduledActivity().then(function (status) {
      switch (status['fan'][0]) {
        case 'auto':
          return Characteristic.TargetFanState.AUTO;
        default:
          return Characteristic.TargetFanState.MANUAL;
      }
    }.bind(this));
  }
  getZoneStatus() {
    return this.client.getStatus().then(
      function (status) {
        return status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
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
};
