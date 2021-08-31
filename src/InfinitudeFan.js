let Characteristic, Service;

module.exports = class InfinitudeFan {
  constructor(name, zoneId, client, log, config, platformAccessory, service, characteristic) {
    this.name = name;
    this.zoneId = zoneId;
    this.client = client;
    this.log = log;
    this.config = config;

    Service = service;
    Characteristic = characteristic;

    this.initialize(platformAccessory.getService(Service.Fanv2));
  }

  initialize(FanService) {
    FanService
      .getCharacteristic(Characteristic.Active).on(
        'get',
      function (callback) {
        this.getActiveState().then(function (state) {
            callback (null, state);
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
  }

	getActiveState() {
        return this.getZoneStatus().then(function (status) {
        switch (status['fan'][0]) {
        case 'off':
          return Characteristic.Active.INACTIVE;
        case 'med':
          return Characteristic.Active.ACTIVE;
}
});
}

        getTargetFanState() { return this.getZoneStatus().then(function (status) {
        switch (status['fan'][0]) {
        case 'off':
          return Characteristic.TargetFanState.OFF;
        default:
          return Characteristic.TargetFanState.AUTO;
}
});
}
	getZoneStatus() {
    return this.client.getStatus().then(
      function (status) {
        return status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
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
};
