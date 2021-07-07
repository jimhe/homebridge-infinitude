let Characteristic, Service;

module.exports = class InfinitudeSensor {
  constructor(name, client, log, config, platformAccessory, service, characteristic) {
    this.name = name;
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
        function (callback) {
          this.getCurrentOutdoorTemperature().then(function (currentTemperature) {
            callback(null, currentTemperature);
          });
        }.bind(this)
      );
  }

  getCurrentOutdoorTemperature() {
    return this.client.getStatus().then(
      function (status) {
        return this.client.fahrenheitToCelsius(parseFloat(status['oat'][0]), this.client.getTemperatureScale());
      }.bind(this)
    );
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
