let Characteristic, Service;

module.exports = class InfinitudeFan {
  constructor(name, zoneId, client, log, config, platformAccessory, service, characteristic) {
    this.name = name;
    this.zoneId = zoneId;
    this.client = client;
    this.log = log;;
    this.config = config;

    Service = service;
    Characteristic = characteristic;

    this.initialize(platformAccessory.getService(Service.Fanv2));
  }

  initialize(FanService) {
    FanService
      .getCharacteristic(Characteristic.CurrentFanState)
      .on(
        'get',
        function (callback) {
          this.getCurrentFanState().then(function (currentFanState) {
            callback(null, currentFanState);
          });
        }.bind(this)
      );
  }

getCurrentFanState() {
    return this.getZoneStatus().then(function (status) {
      switch (status['fan'][0]) {
        case 'off':
          return Characteristic.CurrentFanState.IDLE;
        default:
          return Characteristic.CurrentFanState.BLOWING_AIR;
      }
};
  getZoneTarget() {
    return this.client.getSystems().then(
      function(systems) {
        return systems['system'][0]['config'][0]['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
      }.bind(this)
    );
  }
};
