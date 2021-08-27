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
      .getCharacteristic(Characteristic.Active)
    .on(
        'get',
      function (callback) {
        this.getActiveState().then(function (fanActiveState) {
            callback (null, fanActiveState);
        });
      }.bind(this)
      );
    
      FanService.getCharacteristic(Characteristic.CurrentFanState)
      .on(
        'get',
        function (callback) {
          this.getCurrentFanState().then(function (currentFanState) {
            callback(null, currentFanState);
          });
        }.bind(this)
      );
  }

	getActiveState() {
  	return this.getZoneStatus().then(function (status) {
          if (status['fan'][0] == 'off') {
          return Characteristic.Active.INACTIVE;
        }
        else {
          return Characteristic.Active.ACTIVE;
  }}).bind(this)}
    
	getCurrentFanState() {
	return this.getZoneStatus().then(function (status) {
      if (status['fan'][0] == 'off') {
          return Characteristic.CurrentFanState.IDLE;
          }
    else {
          return Characteristic.CurrentFanState.BLOWING_AIR;
      }
}).bind(this)}
    

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
