let Characteristic, Service;

module.exports = class InfinitudeSensor {
  constructor(name, zoneId, client, log, platformAccessory, service, characteristic) {
    this.name = name;
    this.zoneId = zoneId;
    this.client = client;
    this.log = log;

    Service = service;
    Characteristic = characteristic;

    this.initialize(platformAccessory.getService(Service.TemperatureSensor));
  }
  
  initialize(TemperatureSensorService) {
   TemperatureSensorService.setCharacteristic(
      Characteristic.TemperatureDisplayUnits,
      Characteristic.TemperatureDisplayUnits.FAHRENHEIT
    );

    TemperatureSensorService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on(
        'get',
        function(callback) {
          this.getCurrentOutdoorTemperature().then(function(currentTemperature) {
          callback(null, currentTemperature);
        });
      }.bind(this)
    );
  }

  getCurrentOutdoorTemperature() {
    return this.client.getStatus().then(function(status) {
      return parseFloat(status['oat']);
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
};
