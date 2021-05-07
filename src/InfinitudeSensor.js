let Characteristic, Service;

module.exports = class InfinitudeSensor {
  constructor(name, zoneId, client, log, config, platformAccessory, service, characteristic) {
    this.name = name;
    this.zoneId = zoneId;
    this.client = client;
    this.log = log;;
    this.config = config;

    Service = service;
    Characteristic = characteristic;

    this.initialize(platformAccessory.getService(Service.TemperatureSensor));
  }
  
  initialize(TemperatureSensorService) {
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
      return parseFloat(status['oat'][0]);
    });
  }

  getZoneStatus() {
    return this.client.getStatus().then(
      function(status) {
        return status['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
      }.bind(this)
    );
  }

  getZoneTarget() {
    return this.client.getConfig().then(
      function(config) {
        return config['zones'][0]['zone'].find(zone => zone['id'] === this.zoneId);
      }.bind(this)
    );
  }
};
